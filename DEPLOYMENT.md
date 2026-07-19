# ActionCode Deployment Guide

Complete guide to deploying the ActionCode system: Cloudflare Worker gateway, Telegram bot, Web UI on GitHub Pages, and GitHub Actions workflow.

## Architecture Summary

```
User (Telegram or Web UI)
  → Cloudflare Worker (gateway + KV state)
    → GitHub Actions (OpenCode non-interactive)
      → Callback to Worker → User sees result
```

## Prerequisites

1. **GitHub account** with a Personal Access Token (`repo` scope)
2. **Cloudflare account** (free tier works)
3. **Telegram Bot Token** (optional, from @BotFather)
4. **Node.js 20+** installed locally
5. **Wrangler CLI** (`npm install -g wrangler`)

---

## Step 1: Deploy Cloudflare Worker

### 1.1 Login to Cloudflare

```bash
cd worker
wrangler login
```

### 1.2 Create KV Namespace

```bash
wrangler kv namespace create ACTIONCODE_KV
```

Copy the output IDs and update `worker/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "ACTIONCODE_KV"
id = "YOUR_KV_ID"
preview_id = "YOUR_KV_PREVIEW_ID"
```

### 1.3 Set Worker Secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN    # Enter your bot token (optional)
wrangler secret put GITHUB_TOKEN          # Enter your PAT with repo scope
wrangler secret put WEBHOOK_SECRET        # Enter: openssl rand -hex 32
```

### 1.4 Update Worker URL

Edit `worker/wrangler.toml`:

```toml
[vars]
ENVIRONMENT = "production"
WORKER_URL = "https://actioncode.your-subdomain.workers.dev"
```

### 1.5 Deploy

```bash
npm install
wrangler deploy
```

Verify: `curl https://actioncode.your-subdomain.workers.dev/health`

---

## Step 2: Setup GitHub Actions Secrets

Go to: **https://github.com/SiddharthMishra28/actioncode/settings/secrets/actions**

| Secret | Value |
|--------|-------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token |
| `WEBHOOK_SECRET` | Same value as Worker's WEBHOOK_SECRET |
| `CLOUDFLARE_API_TOKEN` | (Optional) For automated Worker deploys |
| `CLOUDFLARE_ACCOUNT_ID` | (Optional) For automated Worker deploys |

---

## Step 3: Enable GitHub Pages

1. Go to: **https://github.com/SiddharthMishra28/actioncode/settings/pages**
2. Under **Source**, select **GitHub Actions**
3. Push the `web-ui/` directory to `main`
4. The `deploy-web-ui.yml` workflow deploys automatically

Your Web UI will be at: `https://siddharthmishra28.github.io/actioncode/`

---

## Step 4: Setup Telegram Webhook (Optional)

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://actioncode.your-subdomain.workers.dev/webhook/telegram",
    "secret_token": "YOUR_WEBHOOK_SECRET"
  }'
```

Verify: `curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"`

---

## Step 5: Test the System

### Web UI

1. Visit `https://siddharthmishra28.github.io/actioncode/`
2. Enter your GitHub token and repository URL
3. Describe what you want to do
4. Click **Execute**
5. Watch real-time status updates

### Telegram

1. Open Telegram, find your bot
2. Send `/help` to see commands
3. Send `/fix` and follow the prompts

### API

```bash
curl -X POST https://actioncode.your-subdomain.workers.dev/api/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "github_token": "ghp_xxxx",
    "repository": "owner/repo",
    "branch": "main",
    "instruction": "Add a README section about deployment"
  }'
```

---

## How the Callback Flow Works

1. User triggers a task via Web UI or Telegram
2. Worker creates a request record in KV (status: `pending` → `dispatched`)
3. Worker calls GitHub Actions `workflow_dispatch` with the task details
4. GitHub Actions runs the workflow:
   - Checks out the target repository
   - Installs and runs OpenCode (non-interactive)
   - Builds, tests, creates branch/commit/PR
   - Sends progress callbacks to Worker at each stage
5. Worker receives callbacks, updates KV, sends Telegram notifications
6. Web UI polls `/api/status/:id` every 5 seconds for updates
7. On completion, Web UI shows PR link; Telegram gets a summary message

---

## Cost (Free Tier)

| Component | Free Tier | Notes |
|-----------|-----------|-------|
| Cloudflare Worker | 100K req/day | Sufficient for personal use |
| KV Storage | 100K reads/day | Request data expires after 7 days |
| GitHub Pages | Unlimited | Static hosting |
| GitHub Actions | 2,000 min/month | ~30 tasks at 30min each |

---

## Troubleshooting

### Worker returns 401 on callback

The `WEBHOOK_SECRET` must match between:
- Worker secret: `wrangler secret put WEBHOOK_SECRET`
- GitHub Actions secret: `Settings → Secrets → WEBHOOK_SECRET`

### Web UI can't reach Worker

Check CORS: the Worker returns `Access-Control-Allow-Origin: *` on all API responses.

### Telegram bot not responding

1. Verify webhook: `curl "https://api.telegram.org/botTOKEN/getWebhookInfo"`
2. Check Worker logs: `wrangler tail`
3. Ensure `TELEGRAM_BOT_TOKEN` secret is set

### GitHub Actions not triggering

1. Verify `GITHUB_TOKEN` has `repo` scope
2. Check the workflow exists at `.github/workflows/opencode-agent.yml`
3. Ensure the target repo allows the token access

### Rate limiting

OpenCode free model has rate limits. When hit:
- System generates a resume token (12h expiry)
- Use `/resume TOKEN` in Telegram or enter on Web UI
- Task resumes from where it left off

---

## Rollback

```bash
# Worker
wrangler rollback

# Telegram (delete webhook)
curl "https://api.telegram.org/botTOKEN/deleteWebhook"

# GitHub Pages
# Disable in repository Settings → Pages
```
