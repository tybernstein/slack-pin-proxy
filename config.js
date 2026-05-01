const REQUIRED_ENV_VARS = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'];
const OPTIONAL_ENV_VARS = ['PORT', 'LOG_LEVEL', 'WEBHOOK_TIMEOUT_MS', 'MAX_RETRY_ATTEMPTS'];

const DEFAULTS = {
  PORT: 3000,
  LOG_LEVEL: 'info',
  WEBHOOK_TIMEOUT_MS: 5000,
  MAX_RETRY_ATTEMPTS: 3,
};

function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  const port = parseInt(process.env.PORT || String(DEFAULTS.PORT), 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }

  const timeoutMs = parseInt(
    process.env.WEBHOOK_TIMEOUT_MS || String(DEFAULTS.WEBHOOK_TIMEOUT_MS),
    10
  );
  if (isNaN(timeoutMs) || timeoutMs < 100) {
    throw new Error(`WEBHOOK_TIMEOUT_MS must be at least 100ms`);
  }

  return { port, timeoutMs };
}

function getConfig() {
  const validated = validateEnvironment();

  return {
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    },
    server: {
      port: validated.port,
      logLevel: process.env.LOG_LEVEL || DEFAULTS.LOG_LEVEL,
    },
    webhook: {
      timeoutMs: validated.timeoutMs,
      maxRetryAttempts: parseInt(
        process.env.MAX_RETRY_ATTEMPTS || String(DEFAULTS.MAX_RETRY_ATTEMPTS),
        10
      ),
    },
  };
}

function maskSecret(value) {
  if (!value || value.length < 8) return '***';
  return value.slice(0, 4) + '...' + value.slice(-4);
}

function printConfig(config) {
  console.log('Configuration:');
  console.log(`  Slack Bot Token: ${maskSecret(config.slack.botToken)}`);
  console.log(`  Signing Secret: ${maskSecret(config.slack.signingSecret)}`);
  console.log(`  Port: ${config.server.port}`);
  console.log(`  Log Level: ${config.server.logLevel}`);
  console.log(`  Webhook Timeout: ${config.webhook.timeoutMs}ms`);
  console.log(`  Max Retries: ${config.webhook.maxRetryAttempts}`);
}

module.exports = { getConfig, validateEnvironment, printConfig, maskSecret, DEFAULTS };
