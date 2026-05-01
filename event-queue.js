class EventQueue {
  constructor({ maxSize = 1000, processInterval = 100, onProcess, onError, onDrop } = {}) {
    this.queue = [];
    this.maxSize = maxSize;
    this.processing = false;
    this.processInterval = processInterval;
    this.onProcess = onProcess || (() => {});
    this.onError = onError || console.error;
    this.onDrop = onDrop || (() => {});
    this.stats = { enqueued: 0, processed: 0, errors: 0, dropped: 0 };
    this._timer = null;
  }

  enqueue(event) {
    if (this.queue.length >= this.maxSize) {
      const dropped = this.queue.shift();
      this.stats.dropped++;
      this.onDrop(dropped);
    }
    this.queue.push({
      data: event,
      enqueuedAt: Date.now(),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
    this.stats.enqueued++;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._processBatch(), this.processInterval);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async _processBatch() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const batch = this.queue.splice(0, 10);
    const results = await Promise.allSettled(
      batch.map(item => this.onProcess(item.data, item))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.stats.processed++;
      } else {
        this.stats.errors++;
        this.onError(result.reason);
      }
    }

    this.processing = false;
  }

  getStats() {
    return {
      ...this.stats,
      pending: this.queue.length,
      isProcessing: this.processing,
      oldestItemAge: this.queue.length > 0
        ? Date.now() - this.queue[0].enqueuedAt
        : 0,
    };
  }

  drain() {
    const remaining = [...this.queue];
    this.queue = [];
    return remaining;
  }
}

module.exports = { EventQueue };
