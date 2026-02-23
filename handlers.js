import axios from 'axios';

/**
 * Forwards a Slack event payload to a webhook URL.
 */
async function forwardToWebhook(payload) {
  const { url, body } = payload;
  const { data } = await axios.post(url, body);
  return { forwarded: true, response: data };
}

/**
 * Sends delayed follow-up message via Slack response_url.
 */
async function delayedResponse(payload) {
  const { responseUrl, text, delayMs = 0 } = payload;
  if (delayMs > 0) {
    await new Promise((r) => setTimeout(r, delayMs));
  }
  const { data } = await axios.post(responseUrl, { text });
  return { sent: true, response: data };
}

/**
 * Generic HTTP request handler for chaining external API calls.
 */
async function httpRequest(payload) {
  const { method = 'GET', url, headers = {}, data } = payload;
  const response = await axios({ method, url, headers, data });
  return { status: response.status, data: response.data };
}

export { forwardToWebhook, delayedResponse, httpRequest };
