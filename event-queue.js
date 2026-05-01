const PRIORITY = { HIGH: 0, NORMAL: 1, LOW: 2 };

class EventQueue {
  constructor({ maxSize = 1000, batchSize = 10, processInterval = 100, concurrency = 1, onProcess, onError, onDrop } = {}) {
    this.queues = [[], [], []];
    this.maxSize = maxSize;
    this.batchSize = batchSize;
    this.concurrency = concurrency;
    this.activeWorkers = 0;
    this.processInterval = processInterval;
    this.onProcess = onProcess || (() => {});
    this.onError = onError || console.error;
    this.onDrop = onDrop || (() => {});
    this.stats = { enqueued: 0, processed: 0, errors: 0, dropped: 0, totalLatencyMs: 0 };
    this._timer = null;
    this._shutdownPromise = null;
  }

  get totalSize() {
    return this.queues.reduce((sum, q) => sum + q.length, 0);
  }

  enqueue(event, priority = PRIORITY.NORMAL) {
    while (this.totalSize >= this.maxSize) {
      for (let p = PRIORITY.LOW; p >= PRIORITY.HIGH; p--) {
        if (this.queues[p].length > 0) {
          const dropped = this.queues[p].shift();
          this.stats.dropped++;
          this.onDrop(dropped);
          break;
        }
      }
    }
    this.queues[priority].push({
      data: event,
      priority,
      enqueuedAt: Date.now(),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
    this.stats.enqueued++;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      for (let i = 0; i < this.concurrency - this.activeWorkers; i++) {
        this._processBatch();
      }
    }, this.processInterval);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async shutdown(timeoutMs = 5000) {
    this.stop();
    if (this._shutdownPromise) return this._shutdownPromise;

    this._shutdownPromise = new Promise(async (resolve) => {
      const deadline = Date.now() + timeoutMs;
      while (this.totalSize > 0 && Date.now() < deadline) {
        await this._processBatch();
      }
      resolve({ drained: this.totalSize === 0, remaining: this.totalSize });
    });
    return this._shutdownPromise;
  }

  _dequeue(count) {
    const items = [];
    for (const queue of this.queues) {
      while (items.length < count && queue.length > 0) {
        items.push(queue.shift());
      }
      if (items.length >= count) break;
    }
    return items;
  }

  async _processBatch() {
    if (this.totalSize === 0) return;
    this.activeWorkers++;

    const batch = this._dequeue(this.batchSize);
    const results = await Promise.allSettled(
      batch.map(item => {
        const latency = Date.now() - item.enqueuedAt;
        this.stats.totalLatencyMs += latency;
        return this.onProcess(item.data, { ...item, latencyMs: latency });
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.stats.processed++;
      } else {
        this.stats.errors++;
        this.onError(result.reason);
      }
    }

    this.activeWorkers--;
  }

  getStats() {
    const avgLatency = this.stats.processed > 0
      ? (this.stats.totalLatencyMs / this.stats.processed).toFixed(1)
      : 0;
    return {
      ...this.stats,
      pending: this.totalSize,
      pendingByPriority: this.queues.map(q => q.length),
      activeWorkers: this.activeWorkers,
      avgLatencyMs: +avgLatency,
    };
  }

  drain() {
    const all = this.queues.flatMap(q => q.splice(0));
    return all;
  }
}

module.exports = { EventQueue, PRIORITY };
