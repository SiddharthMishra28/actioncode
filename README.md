# ActionCode

GitHub Actions-based autonomous AI coding system with **Cloudflare Worker gateway**, Telegram integration, and Web UI.

## Overview

ActionCode lets developers trigger AI-powered coding tasks from **Telegram** or a **Web UI** (GitHub Pages). A Cloudflare Worker acts as the gateway, receiving requests from either channel, dispatching GitHub Actions workflows that run OpenCode in non-interactive mode, and delivering results back through the originating channel.

## Architecture

```
┌──────────────┐     ┌──────────────┐
│  Telegram    │     │   Web UI     │
│  Bot User    │     │  (GH Pages)  │
└──────┬───────┘     └──────┬───────┘
       │                    │
       ▼                    ▼
┌──────────────────────────────────────────┐
│        CLOUDFLARE WORKER (Gateway)       │
│  POST /webhook/telegram  ← Telegram      │
│  POST /api/trigger       ← Web UI        │
│  POST /webhook/github    ← GH Actions    │
│  GET  /api/status/:id    ← Status poll   │
│  GET  /api/notifications/:id ← Real-time │
│  GET  /api/tasks         ← Task history  │
│  KV: requests, logs, notifications       │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│        GITHUB ACTIONS WORKFLOW           │
│  1. Checkout target repository           │
│  2. Install OpenCode                     │
│  3. Run OpenCode (non-interactive)       │
│  4. Build → Test → Retry loop            │
│  5. Create branch → Commit → PR          │
│  6. Callback to Cloudflare Worker        │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  Callback updates KV → User sees result  │
│  in Telegram or Web UI                   │
└──────────────────────────────────────────┘
```

## Features

- **Dual-channel gateway**: Trigger from Telegram or Web UI, same backend
- **Cloudflare Worker**: Serverless, edge-deployed, KV-backed state
- **OpenCode non-interactive**: Fully autonomous code generation
- **Auto build detection**: Maven, Gradle, npm, Python, Go, Rust, Docker
- **Build/test retry**: Automatic retry on failures
- **PR creation**: Automatic branch, commit, and pull request
- **Real-time status**: Poll-based notifications in Web UI, push in Telegram
- **Rate limiting**: Per-user hourly limits
- **Resume tokens**: Continue rate-limited requests later
- **Multi-repo support**: Any repo the token has access to

## Quick Start

### Prerequisites

- GitHub account with a Personal Access Token (`repo` scope)
- Telegram Bot Token (from @BotFather) — optional, for Telegram channel
- Cloudflare account (free tier works)

### 1. Deploy Cloudflare Worker

```bash
cd worker
wrangler login
wrangler kv namespace create ACTIONCODE_KV
```

Update `wrangler.toml` with the KV namespace IDs, then set secrets:

```bash
wrangler secret put TELEGRAM_BOT_TOKEN    # optional, for Telegram
wrangler secret put GITHUB_TOKEN          # your PAT with repo scope
wrangler secret put WEBHOOK_SECRET        # random string (openssl rand -hex 32)
```

Deploy:

```bash
wrangler deploy
```

### 2. Enable GitHub Pages

1. Go to repository **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Push the `web-ui/` directory to `main` — the `deploy-web-ui.yml` workflow handles the rest

### 3. Set GitHub Actions Secrets

Go to **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `TELEGRAM_BOT_TOKEN` | Your bot token (optional) |
| `WEBHOOK_SECRET` | Same string used in Worker |
| `CLOUDFLARE_API_TOKEN` | For automated Worker deploys (optional) |
| `CLOUDFLARE_ACCOUNT_ID` | For automated Worker deploys (optional) |

### 4. Setup Telegram Webhook (optional)

```bash
curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-worker.workers.dev/webhook/telegram",
    "secret_token": "YOUR_WEBHOOK_SECRET"
  }'
```

### 5. Use It

**Web UI**: Visit your GitHub Pages URL (e.g., `https://siddharthmishra28.github.io/actioncode/`)

**Telegram**: Send `/fix`, `/add`, `/refactor`, etc. to your bot

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/trigger` | Trigger a new task |
| `GET` | `/api/status/:id` | Get task status |
| `GET` | `/api/logs/:id` | Get task logs |
| `GET` | `/api/notifications/:id` | Get notification history |
| `GET` | `/api/tasks` | List recent tasks |
| `POST` | `/webhook/telegram` | Telegram webhook |
| `POST` | `/webhook/github` | GitHub Actions callback |
| `POST` | `/api/resume` | Save resume token |
| `GET` | `/api/resume/:token` | Get resume data |

### Trigger a Task

```bash
curl -X POST https://your-worker.workers.dev/api/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "github_token": "ghp_xxxx",
    "repository": "owner/repo",
    "branch": "main",
    "instruction": "Fix the bug in the login handler"
  }'
```

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/fix` | Fix bugs or issues |
| `/add` | Add new features |
| `/refactor` | Refactor code |
| `/review` | Review code changes |
| `/explain` | Explain code |
| `/test` | Run tests |
| `/document` | Generate documentation |
| `/cleanup` | Clean up code |
| `/improve` | Improve code quality |
| `/run` | Run custom instructions |
| `/status <id>` | Check request status |
| `/resume <token>` | Resume rate-limited request |
| `/help` | Show help |

## Project Structure

```
actioncode/
├── .github/workflows/
│   ├── opencode-agent.yml      # Main AI agent workflow
│   ├── deploy-web-ui.yml       # GitHub Pages deployment
│   └── deploy-worker.yml       # Cloudflare Worker deployment
├── worker/                     # Cloudflare Worker (gateway)
│   ├── src/
│   │   ├── index.ts            # Router
│   │   ├── handlers/           # telegram, github, api, resume
│   │   ├── services/           # kv, github-api, telegram-api
│   │   ├── utils/              # crypto, rate-limit, validation
│   │   └── types.ts            # TypeScript types
│   ├── wrangler.toml           # Cloudflare config
│   └── package.json
├── web-ui/                     # Static Web UI (GitHub Pages)
│   ├── index.html              # Task trigger form
│   ├── status.html             # Real-time status page
│   ├── js/api.js               # API client
│   ├── js/app.js               # Form logic
│   ├── js/status.js            # Status polling
│   └── css/styles.css          # Styles
├── src/                        # Node.js server (legacy/alternative)
├── scripts/                    # Shell scripts for OpenCode
├── config/                     # YAML configuration files
├── docs/                       # Documentation
└── opencode/                   # OpenCode configuration
```

## Documentation

- [Installation Guide](./docs/installation.md)
- [Configuration Guide](./docs/configuration.md)
- [Architecture](./docs/architecture.md)
- [API Reference](./docs/api.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Deployment Guide](./DEPLOYMENT.md)

## License

MIT
