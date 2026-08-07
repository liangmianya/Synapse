# Synapse

Synapse is a local-first nonlinear AI learning workspace. Each branch stores a parent thread and a parent message reference; the server reconstructs that ancestor path only when a model reply is requested.

## Development

Requires Node.js 18 or later.

```powershell
npm install
npm run dev
```

Open `http://localhost:4173`. On Windows you may also double-click `start-dev.cmd`; keep that window open while developing.

The development stack is Vite on port `4173`, proxying `/api` to Express on port `8787`. Vite owns the browser-facing development server and provides reliable asset refresh; Express owns REST and SSE endpoints. The local SQLite database is created at `data/synapse.db` and receives a one-time import from the older JSON files when present.

For a production-style local run, build the frontend first with `npm run build`, then start the API with `npm start`.

## Model providers

The default `demo` provider streams locally generated instructional replies, so no key is needed. Open the application and use the top-bar settings button to configure an OpenAI-compatible service URL, API key, and model, then run the built-in connection test. The full API key is stored only in `data/settings.json`, never returned by the settings API, and that runtime data directory is ignored by Git.

Environment variables remain available for first-run or deployment configuration:

```powershell
$env:AI_PROVIDER='openai-compatible'
$env:OPENAI_API_KEY='...'
$env:OPENAI_BASE_URL='https://api.openai.com/v1'
$env:OPENAI_MODEL='your_model_id'
npm start
```

## Architecture

- `server.js`: Express REST API, SSE streaming, OpenAI-compatible provider adapter, and SQLite persistence.
- `vite.config.js`: Vite server configuration and `/api` proxy.
- `data/synapse.db`: local SQLite runtime data, intentionally excluded from Git.
- `app.js`: canvas interaction and API client.

The design takes inspiration from [tldraw's branching chat template](https://github.com/tldraw/branching-chat-template), [Stello](https://github.com/stello-agent/stello), and [Prompt Tree](https://github.com/yxp934/Prompt-Tree), especially their split between topology, branch-local history, and model context assembly.
