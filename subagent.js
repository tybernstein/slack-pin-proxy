import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

const TaskStatus = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

class AsyncSubAgent extends EventEmitter {
  #queue = [];
  #activeTasks = 0;
  #tasks = new Map();
  #handlers = new Map();
  #concurrency;
  #retries;

  /**
   * @param {object} opts
   * @param {number} [opts.concurrency=3] Max parallel tasks
   * @param {number} [opts.retries=0]     Retry count on failure
   */
  constructor({ concurrency = 3, retries = 0 } = {}) {
    super();
    this.#concurrency = concurrency;
    this.#retries = retries;
  }

  /**
   * Register a handler for a given task type.
   * The handler receives (payload, context) and should return a result.
   */
  register(type, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`Handler for "${type}" must be a function`);
    }
    this.#handlers.set(type, handler);
    return this;
  }

  /**
   * Submit a task for async processing.
   * @returns {{ taskId: string }} Reference to the enqueued task
   */
  submit(type, payload = {}) {
    if (!this.#handlers.has(type)) {
      throw new Error(`No handler registered for task type "${type}"`);
    }

    const taskId = randomUUID();
    const task = {
      id: taskId,
      type,
      payload,
      status: TaskStatus.PENDING,
      result: null,
      error: null,
      attempts: 0,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
    };

    this.#tasks.set(taskId, task);
    this.#queue.push(task);
    this.emit('task:submitted', { taskId, type });

    this.#drain();

    return { taskId };
  }

  /**
   * Get the current state of a task.
   */
  getTask(taskId) {
    const task = this.#tasks.get(taskId);
    if (!task) return null;
    return { ...task };
  }

  /**
   * Wait for a specific task to finish (resolve or reject).
   */
  waitFor(taskId, timeoutMs = 30_000) {
    const task = this.#tasks.get(taskId);
    if (!task) return Promise.reject(new Error('Unknown task'));

    if (task.status === TaskStatus.COMPLETED) return Promise.resolve(task.result);
    if (task.status === TaskStatus.FAILED) return Promise.reject(task.error);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Task ${taskId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const onComplete = (evt) => {
        if (evt.taskId !== taskId) return;
        cleanup();
        resolve(evt.result);
      };

      const onFailed = (evt) => {
        if (evt.taskId !== taskId) return;
        cleanup();
        reject(new Error(evt.error));
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.off('task:completed', onComplete);
        this.off('task:failed', onFailed);
      };

      this.on('task:completed', onComplete);
      this.on('task:failed', onFailed);
    });
  }

  /**
   * Return a snapshot of all tracked tasks.
   */
  listTasks() {
    return [...this.#tasks.values()].map((t) => ({ ...t }));
  }

  get stats() {
    let pending = 0, running = 0, completed = 0, failed = 0;
    for (const t of this.#tasks.values()) {
      if (t.status === TaskStatus.PENDING) pending++;
      else if (t.status === TaskStatus.RUNNING) running++;
      else if (t.status === TaskStatus.COMPLETED) completed++;
      else if (t.status === TaskStatus.FAILED) failed++;
    }
    return { pending, running, completed, failed, total: this.#tasks.size };
  }

  // --- internals ---

  #drain() {
    while (this.#queue.length > 0 && this.#activeTasks < this.#concurrency) {
      const task = this.#queue.shift();
      this.#run(task);
    }
  }

  async #run(task) {
    this.#activeTasks++;
    task.status = TaskStatus.RUNNING;
    task.startedAt = Date.now();
    task.attempts++;
    this.emit('task:running', { taskId: task.id, attempt: task.attempts });

    try {
      const handler = this.#handlers.get(task.type);
      const result = await handler(task.payload, { taskId: task.id, attempt: task.attempts });
      task.status = TaskStatus.COMPLETED;
      task.result = result;
      task.completedAt = Date.now();
      this.emit('task:completed', { taskId: task.id, result });
    } catch (err) {
      if (task.attempts <= this.#retries) {
        task.status = TaskStatus.PENDING;
        this.#queue.push(task);
        this.emit('task:retry', { taskId: task.id, attempt: task.attempts, error: err.message });
      } else {
        task.status = TaskStatus.FAILED;
        task.error = err.message;
        task.completedAt = Date.now();
        this.emit('task:failed', { taskId: task.id, error: err.message });
      }
    } finally {
      this.#activeTasks--;
      this.#drain();
    }
  }
}

export { AsyncSubAgent, TaskStatus };
