import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/6723499/ubsafrc/';

app.post('/slack/events', async (req, res) => {
  const { type, challenge } = req.body;

  if (type === 'url_verification') {
    return res.send(challenge);
  }

  try {
    await axios.post(ZAPIER_WEBHOOK_URL, req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error forwarding to Zapier:', err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Slack proxy running on port ${PORT}`));
