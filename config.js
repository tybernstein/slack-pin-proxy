const DEFAULTS = {
  PORT: 3000,
  LOG_LEVEL: 'info',
  WEBHOOK_TIMEOUT_MS: 5000,
  MAX_RETRY_ATTEMPTS: 3,
};

function getConfig() {
  return {
    slack: {
      signingSecret: process.env.SLACK_SIGNING_SECRET || '',
      verificationToken: process.env.SLACK_VERIFICATION_TOKEN || '',
    },
    server: {
      port: parseIntOrDefault('PORT', DEFAULTS.PORT, 1, 65535),
      logLevel: process.env.LOG_LEVEL || DEFAULTS.LOG_LEVEL,
    },
    webhook: {
      url: process.env.ZAPIER_WEBHOOK_URL || '',
      timeoutMs: parseIntOrDefault('WEBHOOK_TIMEOUT_MS', DEFAULTS.WEBHOOK_TIMEOUT_MS, 100),
      maxRetryAttempts: parseIntOrDefault('MAX_RETRY_ATTEMPTS', DEFAULTS.MAX_RETRY_ATTEMPTS, 0, 10),
    },
  };
}

function parseIntOrDefault(envVar, defaultVal, min = -Infinity, max = Infinity) {
  const raw = process.env[envVar];
  if (!raw) return defaultVal;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    console.warn(`Invalid ${envVar}=${raw}, using default ${defaultVal}`);
    return defaultVal;
  }
  return parsed;
}

module.exports = { getConfig, DEFAULTS };
