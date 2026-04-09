import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

app.use(helmet());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

if (!ZAPIER_WEBHOOK_URL) {
  console.error('FATAL: ZAPIER_WEBHOOK_URL environment variable is not set.');
  process.exit(1);
}

if (!SLACK_SIGNING_SECRET) {
  console.error('FATAL: SLACK_SIGNING_SECRET environment variable is not set.');
  process.exit(1);
}

app.post(
  '/slack/events',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req, res) => {
    const timestamp = req.headers['x-slack-request-timestamp'];
    const slackSignature = req.headers['x-slack-signature'];

    if (!timestamp || !slackSignature) {
      return res.sendStatus(401);
    }

    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
    if (parseInt(timestamp, 10) < fiveMinutesAgo) {
      return res.sendStatus(401);
    }

    const rawBody = req.body;
    const sigBasestring = `v0:${timestamp}:${rawBody}`;
    const mySignature =
      'v0=' +
      crypto
        .createHmac('sha256', SLACK_SIGNING_SECRET)
        .update(sigBasestring, 'utf8')
        .digest('hex');

    if (
      !crypto.timingSafeEqual(
        Buffer.from(mySignature, 'utf8'),
        Buffer.from(slackSignature, 'utf8'),
      )
    ) {
      return res.sendStatus(401);
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return res.sendStatus(400);
    }

    if (body.type === 'url_verification') {
      if (typeof body.challenge !== 'string') {
        return res.sendStatus(400);
      }
      return res.status(200).json({ challenge: body.challenge });
    }

    try {
      await axios.post(ZAPIER_WEBHOOK_URL, body, { timeout: 10000 });
      res.sendStatus(200);
    } catch (err) {
      console.error('Error forwarding to Zapier:', err.message);
      res.sendStatus(502);
    }
  },
);

app.use((_req, res) => {
  res.sendStatus(404);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Slack proxy running on port ${PORT}`));
