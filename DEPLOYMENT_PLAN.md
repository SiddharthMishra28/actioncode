# Deployment Plan: Go Live with ActionCode

## Overview
This plan covers deploying the ActionCode system to production, including the Cloudflare Worker, Telegram webhook, and GitHub Pages Web UI.

---

## Phase 1: Cloudflare Worker Deployment

### Step 1.1: Login to Cloudflare
```bash
cd worker
wrangler login
```
**Action Required:** Browser will open for OAuth login

### Step 1.2: Create KV Namespace
```bash
wrangler kv namespace create ACTIONCODE_KV
```
**Action Required:** Copy the output ID and preview_id

### Step 1.3: Update wrangler.toml
Replace placeholder values with real IDs:
```toml
[[kv_namespaces]]
binding = "ACTIONCODE_KV"
id = "YOUR_ACTUAL_KV_ID"
preview_id = "YOUR_ACTUAL_PREVIEW_ID"
```

### Step 1.4: Set Worker Secrets
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
# Enter: your-telegram-bot-token

wrangler secret put GITHUB_TOKEN
# Enter: your-github-personal-access-token

wrangler secret put WEBHOOK_SECRET
# Enter: (generate with: openssl rand -hex 32)
```

### Step 1.5: Update Worker URL
Edit `wrangler.toml`:
```toml
[vars]
WORKER_URL = "https://actioncode.<your-subdomain>.workers.dev"
```

### Step 1.6: Deploy Worker
```bash
wrangler deploy
```
**Expected Output:** `Published to actioncode.<your-subdomain>.workers.dev`

---

## Phase 2: Telegram Webhook Setup

### Step 2.1: Set Webhook
```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://actioncode.<your-subdomain>.workers.dev/webhook/telegram",
    "secret_token": "<YOUR_WEBHOOK_SECRET>"
  }'
```

### Step 2.2: Verify Webhook
```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```
**Expected:** `"url": "https://actioncode.<your-subdomain>.workers.dev/webhook/telegram"`

---

## Phase 3: GitHub Pages Setup

### Step 3.1: Enable GitHub Pages
1. Go to: https://github.com/SiddharthMishra28/actioncode/settings/pages
2. Under **Source**, select **GitHub Actions**
3. Save

### Step 3.2: Update Web UI Config
Edit `web-ui/js/api.js`:
```javascript
const API_CONFIG = {
  WORKER_URL: 'https://actioncode.<your-subdomain>.workers.dev',
  REPO: 'SiddharthMishra28/actioncode',
};
```

---

## Phase 4: Push Code to Production

### Step 4.1: Stage All Changes
```bash
git add worker/ web-ui/ .github/workflows/ DEPLOYMENT.md
```

### Step 4.2: Commit
```bash
git commit -m "feat: Add Cloudflare Worker and Web UI for AI coding agent"
```

### Step 4.3: Push to Main
```bash
git push origin main
```

**Expected:** GitHub Actions workflow triggers deployment to Pages

---

## Phase 5: Testing

### Step 5.1: Test Cloudflare Worker
```bash
# Health check
curl https://actioncode.<your-subdomain>.workers.dev/health

# Expected: {"status":"ok","timestamp":"..."}
```

### Step 5.2: Test Telegram Bot
1. Open Telegram
2. Search for your bot
3. Send `/help`
4. Send `/fix`
5. Follow prompts

### Step 5.3: Test Web UI
1. Visit https://ezcode.github.io
2. Enter GitHub token and repository
3. Describe a task
4. Click **Execute**
5. Watch real-time status

---

## Blockers & Questions

### Blockers
1. **Cloudflare Subdomain:** What subdomain should I use for the Worker?
   - Options: `actioncode`, `ezcode`, `ai-coding-agent`, etc.

2. **GitHub Token Revocation:** If a token was shared in plaintext, revoke it immediately
   - Should I generate a new token or proceed with existing one?

3. **GitHub Pages Domain:** Should it be `ezcode.github.io` or a custom domain?

### Required User Actions
- [ ] Login to Cloudflare via `wrangler login`
- [ ] Generate new GitHub token (recommended)
- [ ] Provide Cloudflare subdomain name
- [ ] Enable GitHub Pages in repository settings
- [ ] Generate webhook secret

---

## Timeline Estimate

| Phase | Time Required |
|-------|---------------|
| Phase 1: Worker Deployment | 5-10 minutes |
| Phase 2: Telegram Webhook | 2 minutes |
| Phase 3: GitHub Pages | 2 minutes |
| Phase 4: Push Code | 2 minutes |
| Phase 5: Testing | 5 minutes |
| **Total** | **15-20 minutes** |

---

## Rollback Plan

If issues occur:
1. **Worker:** `wrangler rollback`
2. **Telegram:** Delete webhook with `deleteWebhook`
3. **Pages:** Disable in repository settings

---

## Success Criteria

- [ ] Worker responds to `/health` endpoint
- [ ] Telegram bot receives and responds to messages
- [ ] Web UI loads and can trigger requests
- [ ] GitHub Actions workflow executes successfully
- [ ] PR is created on completion
- [ ] Rate limiting works correctly
- [ ] Resume tokens work for interrupted requests
