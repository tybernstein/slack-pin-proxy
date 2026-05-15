const DEFAULT_BASE_DELAY_MS = parseInt(process.env.RETRY_BASE_DELAY_MS || '500', 10);
const DEFAULT_MAX_RETRIES = parseInt(process.env.RETRY_MAX_RETRIES || '3', 10);

/**
 * Retries an async function with exponential backoff.
 *
 * @param {() => Promise<any>} fn - The async function to retry.
 * @param {object} [opts]
 * @param {number} [opts.maxRetries] - Maximum number of retry attempts.
 * @param {number} [opts.baseDelayMs] - Base delay in ms (doubles each attempt).
 * @param {(err: Error, attempt: number) => boolean} [opts.shouldRetry] - Return false to abort early.
 */
async function withRetry(fn, { maxRetries = DEFAULT_MAX_RETRIES, baseDelayMs = DEFAULT_BASE_DELAY_MS, shouldRetry = () => true } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxRetries || !shouldRetry(err, attempt)) {
        break;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt);

      // BUG: the Promise returned by setTimeout wrapper is never awaited,
      // so execution continues immediately — backoff has no effect.
      new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

module.exports = { withRetry };
