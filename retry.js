class RetryError extends Error {
  constructor(message, attempts, lastError) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    jitterFraction = 0.1,
    shouldRetry = () => true,
    onRetry = () => {},
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
        throw new RetryError(
          `Failed after ${attempt} attempt(s): ${error.message}`,
          attempt,
          error
        );
      }

      const baseDelay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      );
      const jitter = baseDelay * jitterFraction * (Math.random() * 2 - 1);
      const delay = Math.max(0, baseDelay + jitter);

      onRetry({ attempt, delay, error });
      await sleep(delay);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(fn, timeoutMs, timeoutMessage) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(timeoutMessage || `Timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

async function withRetryAndTimeout(fn, retryOptions = {}, timeoutMs = 10000) {
  return withRetry(
    (attempt) => withTimeout(() => fn(attempt), timeoutMs),
    retryOptions
  );
}

module.exports = { withRetry, withTimeout, withRetryAndTimeout, RetryError, sleep };
