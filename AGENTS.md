# AGENTS.md

## Cursor Cloud specific instructions

This is a minimal Node.js/Express proxy server (`slack-pin-proxy`) that forwards Slack Events API webhooks to a hardcoded Zapier webhook URL.

### Running the application

- `npm install` to install dependencies (express, axios).
- `npm start` to run the server on `PORT` (default 3000).
- There are no lint, test, or build scripts configured in `package.json`. The only script is `start`.

### Key endpoints

- `POST /slack/events` — handles Slack's `url_verification` challenge and forwards all other event payloads to Zapier.

### Testing locally

- URL verification: `curl -X POST http://localhost:3000/slack/events -H "Content-Type: application/json" -d '{"type":"url_verification","challenge":"test"}'`
- Event forwarding: `curl -X POST http://localhost:3000/slack/events -H "Content-Type: application/json" -d '{"type":"event_callback","event":{"type":"pin_added"}}'`

### Caveats

- The Zapier webhook URL is hardcoded in `index.js`. Event forwarding will return 500 in sandboxed/restricted-network environments because the external Zapier endpoint is unreachable.
- There is no `.env` file, no database, no Docker setup, and no test framework. The entire app is a single `index.js` file.
- Deployment configuration is in `render.yaml` (Render.com free tier).
