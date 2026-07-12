# ActionCode Deployment Guide

This guide covers deploying the ActionCode system, including the Cloudflare Worker and Web UI.

## Prerequisites

1. **Cloudflare Account** (free tier works)
2. **GitHub Account** with a Personal Access Token
3. **Telegram Bot Token** (from @BotFather)
4. **Node.js 20+** installed locally
5. **Wrangler CLI** installed (`npm install -g wrangler`)

---

## Step 1: Deploy Cloudflare Worker

### 1.1 Login to Cloudflare

```bash
wrangler login
```

### 1.2 Create KV Namespace

```bash
cd worker
wrangler kv namespace create ACTIONCODE_KV
```

Note the output ID and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "ACTIONCODE_KV"
id = "YOUR_KV_NAMESPACE_ID"
preview_id = "YOUR_KV_NAMESPACE_PREVIEW_ID"
```

### 1.3 Set Secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
# Enter: your-telegram-bot-token

wrangler secret put GITHUB_TOKEN
# Enter: your-github-personal-access-token

wrangler secret put WEBHOOK_SECRET
# Enter: (generate a random secret, e.g., using openssl rand -hex 32)
```

### 1.4 Update Worker URL

Edit `wrangler.toml` and set your Worker URL:

```toml
[vars]
WORKER_URL = "https://actioncode.your-subdomain.workers.dev"
```

### 1.5 Deploy Worker

```bash
cd worker
npm install
wrangler deploy
```

Your Worker is now live at `https://actioncode.your-subdomain.workers.dev`

---

## Step 2: Setup Telegram Bot Webhook

### 2.1 Set Webhook via Telegram API

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://actioncode.your-subdomain.workers.dev/webhook/telegram",
    "secret_token": "YOUR_WEBHOOK_SECRET"
  }'
```

### 2.2 Verify Webhook

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

---

## Step 3: Setup GitHub Actions Secrets

### 3.1 Add Secrets to Repository

Go to your repository: `https://github.com/SiddharthMishra28/actioncode`

Navigate to: **Settings → Secrets and variables → Actions**

Add the following secrets:

| Secret Name | Value |
|-------------|-------|
| `TELEGRAM_BOT_TOKEN` | `your-telegram-bot-token` |
| `WEBHOOK_SECRET` | (same as Cloudflare Worker secret) |

---

## Step 4: Deploy Web UI

### 4.1 Enable GitHub Pages

1. Go to repository **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Save

### 4.2 Push Web UI Files

The Web UI files are in the `web-ui/` directory. They will be deployed automatically when pushed to the `main` branch.

### 4.3 Update Worker URL in Web UI

Edit `web-ui/js/api.js` and update the Worker URL:

```javascript
const API_CONFIG = {
  WORKER_URL: 'https://actioncode.your-subdomain.workers.dev',
  REPO: 'SiddharthMishra28/actioncode',
};
```

---

## Step 5: Test the System

### 5.1 Test Telegram Bot

1. Open Telegram and search for your bot
2. Send `/help` to see available commands
3. Send `/fix` to start a request
4. Follow the prompts to enter your GitHub token, repository, and instruction

### 5.2 Test Web UI

1. Visit `https://ezcode.github.io`
2. Enter your GitHub token and repository
3. Describe what you want to do
4. Click **Execute**
5. Watch the real-time status

---

## Architecture Overview

```
┌────────────────────┐
│   TELEGRAM USER    │
│   /fix, /add, etc. │
└──────────┬─────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│           CLOUDFLARE WORKER                               │
│           actioncode.your-subdomain.workers.dev           │
│                                                           │
│  POST /webhook/telegram  ←── Telegram pushes updates      │
│  POST /api/trigger       ←── Web UI triggers pipeline     │
│  POST /webhook/github    ←── GitHub Actions callback      │
│  GET  /api/status/:id    ←── Status polling               │
│  GET  /api/logs/:id      ←── Log streaming                │
└──────────────────────────────┬───────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────┐
│           GITHUB ACTIONS                                  │
│           opencode-agent.yml                              │
│                                                           │
│  1. Checkout USER'S repo                                  │
│  2. Install OpenCode                                      │
│  3. Run OpenCode (free model)                             │
│  4. Build → Test → Retry                                  │
│  5. Create branch → Commit → PR                           │
│  6. Callback to Cloudflare Worker                         │
└──────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────┐
│           GITHUB PAGES (ezcode.github.io)                 │
│                                                           │
│  • Form: token, repo, prompt                              │
│  • Real-time status                                       │
│  • Live logs                                              │
│  • PR link on completion                                  │
└──────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Worker Not Receiving Telegram Updates

1. Verify webhook is set:
   ```bash
   curl "https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo"
   ```

2. Check Worker logs:
   ```bash
   wrangler tail
   ```

3. Ensure `WEBHOOK_SECRET` matches in both Worker and Telegram webhook

### GitHub Actions Not Triggering

1. Verify `GITHUB_TOKEN` has `repo` scope
2. Check workflow exists at `.github/workflows/opencode-agent.yml`
3. Ensure user's token has access to the target repository

### Rate Limits

- OpenCode free model has rate limits
- When hit, the system generates a resume token
- Use `/resume TOKEN` in Telegram or enter on web UI to continue

### Web UI Not Loading

1. Check GitHub Pages is enabled
2. Verify the deployment workflow ran successfully
3. Check the Pages URL in repository settings

---

## Security Notes

1. **GitHub Tokens**: Passed via workflow input, not stored in KV
2. **Webhook Secrets**: Used to verify Telegram and GitHub callbacks
3. **Rate Limiting**: Implemented per-user and per-token
4. **Resume Tokens**: Expire after 12 hours

---

## Cost

| Component | Free Tier | Paid Tier |
|-----------|-----------|-----------|
| Cloudflare Worker | 100K requests/day | $5/month |
| KV Storage | 100K reads/day | $0.50/M reads |
| GitHub Pages | Unlimited | $20/month (Pro) |
| GitHub Actions | 2,000 min/month | $0.008/min |

**For personal use:** Free tier is sufficient.
