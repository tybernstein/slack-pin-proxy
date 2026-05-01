async function withRetry(fn, { maxAttempts = 3, delayMs = 1000, backoff = 2 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt === maxAttempts) {
        error.attempts = attempt;
        throw error;
      }
      const wait = delayMs * Math.pow(backoff, attempt - 1);
      const jittered = wait + wait * 0.1 * (Math.random() - 0.5);
      await new Promise(r => setTimeout(r, jittered));
    }
  }
}

async function withTimeout(fn, ms) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fn(ac.signal);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { withRetry, withTimeout };
