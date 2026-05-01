const { describe, it } = require('node:test');
const assert = require('node:assert');
const { EventQueue, PRIORITY } = require('../event-queue.js');

describe('EventQueue', () => {
  it('should enqueue and process events in order', async () => {
    const processed = [];
    const queue = new EventQueue({
      batchSize: 5,
      processInterval: 10,
      onProcess: (data) => { processed.push(data); },
    });

    queue.enqueue('first');
    queue.enqueue('second');
    queue.enqueue('third');

    queue.start();
    await new Promise(r => setTimeout(r, 100));
    queue.stop();

    assert.deepStrictEqual(processed, ['first', 'second', 'third']);
  });

  it('should respect priority ordering', async () => {
    const processed = [];
    const queue = new EventQueue({
      batchSize: 10,
      processInterval: 10,
      onProcess: (data) => { processed.push(data); },
    });

    queue.enqueue('low1', PRIORITY.LOW);
    queue.enqueue('low2', PRIORITY.LOW);
    queue.enqueue('high1', PRIORITY.HIGH);
    queue.enqueue('normal1', PRIORITY.NORMAL);

    queue.start();
    await new Promise(r => setTimeout(r, 100));
    queue.stop();

    assert.strictEqual(processed[0], 'high1');
    assert.strictEqual(processed[1], 'normal1');
  });

  it('should drop oldest low-priority items when full', () => {
    const dropped = [];
    const queue = new EventQueue({
      maxSize: 3,
      onDrop: (item) => { dropped.push(item.data); },
    });

    queue.enqueue('a', PRIORITY.LOW);
    queue.enqueue('b', PRIORITY.LOW);
    queue.enqueue('c', PRIORITY.NORMAL);
    queue.enqueue('d', PRIORITY.HIGH);

    assert.strictEqual(dropped.length, 1);
    assert.strictEqual(dropped[0], 'a');
    assert.strictEqual(queue.totalSize, 3);
  });

  it('should track stats correctly', async () => {
    let callCount = 0;
    const queue = new EventQueue({
      processInterval: 10,
      onProcess: () => {
        callCount++;
        if (callCount === 2) throw new Error('fail');
      },
    });

    queue.enqueue('ok1');
    queue.enqueue('fail1');
    queue.enqueue('ok2');

    queue.start();
    await new Promise(r => setTimeout(r, 200));
    queue.stop();

    const stats = queue.getStats();
    assert.strictEqual(stats.enqueued, 3);
    assert.strictEqual(stats.processed, 2);
    assert.strictEqual(stats.errors, 1);
    assert.strictEqual(stats.pending, 0);
  });

  it('should drain remaining items', () => {
    const queue = new EventQueue();
    queue.enqueue('x');
    queue.enqueue('y');

    const drained = queue.drain();
    assert.strictEqual(drained.length, 2);
    assert.strictEqual(queue.totalSize, 0);
  });

  it('should shutdown gracefully', async () => {
    const processed = [];
    const queue = new EventQueue({
      processInterval: 10,
      onProcess: async (data) => {
        await new Promise(r => setTimeout(r, 5));
        processed.push(data);
      },
    });

    queue.enqueue('shutdown1');
    queue.enqueue('shutdown2');

    const result = await queue.shutdown(2000);
    assert.strictEqual(result.drained, true);
    assert.strictEqual(processed.length, 2);
  });
});
