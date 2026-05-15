# AGENT.md — slack-pin-proxy

## Project Overview

A lightweight Node.js (ES modules) + Express service that acts as a **Slack Events API proxy**. It receives Slack event payloads at `/slack/events`, responds to `url_verification` challenges, and forwards all other events to a Zapier webhook.

## Tech Stack

- **Runtime:** Node.js (ES modules — `"type": "module"`)
- **Framework:** Express ^4.18.2
- **HTTP client:** axios ^1.6.0
- **Deployment:** Render (configured via `render.yaml`)

## Repository Layout

```
index.js        # Application entrypoint — Express server and route handler
package.json    # Project metadata and dependencies
render.yaml     # Render.com deployment configuration
AGENT.md        # This file
```

The codebase is intentionally flat: a single `index.js` file contains all application logic.

## Getting Started

### Prerequisites

- Node.js (LTS recommended)

### Install Dependencies

```sh
npm install
```

### Run the Server

```sh
npm start
```

The server listens on `PORT` (environment variable, defaults to `3000`).

## Key Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT`   | No       | `3000`  | Port the Express server listens on |

> **Note:** The Zapier webhook URL is currently hard-coded in `index.js` as `ZAPIER_WEBHOOK_URL`. To change the destination webhook, edit that constant directly.

## How the Code Works

`index.js` exposes a single `POST /slack/events` endpoint:

1. **Slack URL verification** — If the incoming payload has `type: "url_verification"`, the server responds with the `challenge` value (required by Slack during event subscription setup).
2. **Event forwarding** — All other payloads are forwarded to the Zapier webhook via an `axios.post` call. A `200` is returned on success; a `500` on failure.

## Development Notes

- **No build step** — The app runs directly with `node index.js`.
- **No test framework** — Tests are not configured. If adding tests, consider a lightweight runner like Vitest or Jest with `--experimental-vm-modules` for ESM support.
- **No linter/formatter** — Not currently configured. ESLint or Biome would be reasonable additions.
- **No CI/CD pipelines** — Render auto-deploys from the default branch via `render.yaml`; there are no GitHub Actions or other CI workflows.

## Deployment

The service is deployed on [Render](https://render.com) as a free-tier web service. The `render.yaml` blueprint defines:

- **Build command:** `npm install`
- **Start command:** `npm start`
- **Auto-deploy:** enabled — pushes to the default branch trigger a new deploy automatically.

## Common Tasks

| Task | Command |
|------|---------|
| Install dependencies | `npm install` |
| Start the server | `npm start` |
| Start with custom port | `PORT=8080 npm start` |
