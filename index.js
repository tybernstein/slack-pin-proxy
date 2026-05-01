import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { rateLimiter, validateSlackRequest, requestLogger } from './middleware.js';

const app = express();

app.use(express.json({
  verify: (req, buf) => {
    req.rawBody = buf.toString();
  },
}));
app.use(requestLogger);

const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL
  || 'https://hooks.zapier.com/hooks/catch/6723499/ubsafrc/';
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '5000', 10);

function verifySlackSignature(req) {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];

  if (!timestamp || !signature) {
    return false;
  }

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${req.rawBody}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBasestring, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(signature, 'utf8')
  );
}

const startedAt = new Date();
let requestCount = 0;
let errorCount = 0;

app.get('/health', (req, res) => {
  const uptimeMs = Date.now() - startedAt.getTime();
  res.json({
    status: 'ok',
    uptime: `${Math.floor(uptimeMs / 1000)}s`,
    startedAt: startedAt.toISOString(),
    requests: requestCount,
    errors: errorCount,
    memoryMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
  });
});

app.post('/slack/events', rateLimiter, validateSlackRequest, async (req, res) => {
  requestCount++;
  const { type, challenge } = req.body;

  if (type === 'url_verification') {
    return res.status(200).json({ challenge });
  }

  if (SLACK_SIGNING_SECRET && !verifySlackSignature(req)) {
    console.warn('Invalid Slack signature rejected');
    errorCount++;
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const eventType = req.body.event?.type || 'unknown';
  const eventTs = req.body.event?.event_ts || null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    await axios.post(ZAPIER_WEBHOOK_URL, {
      ...req.body,
      _proxy_metadata: {
        receivedAt: new Date().toISOString(),
        eventType,
        eventTs,
      },
    }, {
      signal: controller.signal,
      timeout: REQUEST_TIMEOUT_MS,
    });

    clearTimeout(timeout);
    res.sendStatus(200);
  } catch (err) {
    errorCount++;
    if (err.code === 'ECONNABORTED' || err.name === 'AbortError') {
      console.error(`Webhook timeout after ${REQUEST_TIMEOUT_MS}ms for event ${eventType}`);
      res.status(504).json({ error: 'Webhook timeout' });
    } else {
      console.error('Error forwarding to Zapier:', err.message);
      res.sendStatus(500);
    }
  }
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.stack || err.message);
  errorCount++;
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS || '10000', 10);

const server = app.listen(PORT, () => {
  console.log(`Slack proxy running on port ${PORT} (pid: ${process.pid})`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, starting graceful shutdown...`);

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);

  try {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Server closed, all connections drained');
  } catch (err) {
    console.error('Error during shutdown:', err.message);
  } finally {
    clearTimeout(forceExit);
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
