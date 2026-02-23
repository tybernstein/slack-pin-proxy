import express from 'express';
import axios from 'axios';
import { AsyncSubAgent } from './subagent.js';
import { forwardToWebhook, delayedResponse, httpRequest } from './handlers.js';

const app = express();
app.use(express.json());

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/6723499/ubsafrc/';

// ── Subagent setup ────────────────────────────────────────────────
const agent = new AsyncSubAgent({ concurrency: 5, retries: 2 });

agent.register('forward_webhook', forwardToWebhook);
agent.register('delayed_response', delayedResponse);
agent.register('http_request', httpRequest);

agent.on('task:completed', ({ taskId }) =>
  console.log(`[subagent] task ${taskId} completed`),
);
agent.on('task:failed', ({ taskId, error }) =>
  console.error(`[subagent] task ${taskId} failed: ${error}`),
);

// ── Slack events endpoint (original, now using subagent) ──────────
app.post('/slack/events', (req, res) => {
  const { type, challenge } = req.body;

  if (type === 'url_verification') {
    return res.status(200).json({ challenge });
  }

  const { taskId } = agent.submit('forward_webhook', {
    url: ZAPIER_WEBHOOK_URL,
    body: req.body,
  });

  res.status(202).json({ accepted: true, taskId });
});

// ── Task management API ───────────────────────────────────────────

app.post('/tasks', (req, res) => {
  const { type, payload } = req.body;
  if (!type) {
    return res.status(400).json({ error: 'Missing "type" field' });
  }
  try {
    const { taskId } = agent.submit(type, payload);
    res.status(202).json({ taskId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/tasks/:taskId', (req, res) => {
  const task = agent.getTask(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

app.get('/tasks', (_req, res) => {
  res.json({ tasks: agent.listTasks(), stats: agent.stats });
});

// ── Health ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', subagent: agent.stats });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Slack proxy running on port ${PORT}`));
