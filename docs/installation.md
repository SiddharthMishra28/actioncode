# Installation Guide

## Prerequisites

### System Requirements

- Node.js 20.0.0 or higher
- npm 9.0.0 or higher
- Git

### Accounts Required

1. **GitHub Account**
   - Personal Access Token with `repo` scope
   - Repository access

2. **Telegram Account**
   - Bot Token from @BotFather

## Step 1: Clone the Repository

```bash
git clone https://github.com/SiddharthMishra28/actioncode.git
cd actioncode
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# GitHub Configuration
GITHUB_TOKEN=ghp_your_github_token_here

# Server Configuration
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info
```

## Step 4: Configure Repositories

Edit `config/repositories.yml` to add your repositories:

```yaml
repositories:
  - name: my-project
    fullName: your-username/my-project
    defaultBranch: main
    allowedUsers:
      - 123456789  # Your Telegram user ID
    enabledCommands:
      - fix
      - add
      - refactor
      - test
    buildCommand: npm run build
    testCommand: npm test
```

## Step 5: Configure Allowed Users

Add your Telegram user ID to `config/telegram.yml`:

```yaml
telegram:
  allowedUsers:
    - 123456789  # Your Telegram user ID
```

To find your Telegram user ID:
1. Send any message to @userinfobot on Telegram
2. It will reply with your user ID

## Step 6: Start the Service

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## Step 7: Set Up Telegram Webhook (Production)

For production, you need to set up a webhook instead of polling:

1. Use a service like ngrok for local development:
   ```bash
   ngrok http 3000
   ```

2. Set the webhook URL in your bot:
   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://your-domain.com/webhook/telegram
   ```

## Step 8: Verify Installation

1. Open Telegram and find your bot
2. Send `/start`
3. Send `/help`
4. Try a test command:
   ```
   /fix
   Repository: your-username/your-repo
   Branch: main
   Fix the typo in README.md
   ```

## Troubleshooting

### Common Issues

**"Configuration file not found"**
- Ensure you're running from the project root directory
- Check that `config/` directory exists

**"Telegram bot token is invalid"**
- Verify your bot token from @BotFather
- Check for extra spaces in `.env`

**"GitHub token is invalid"**
- Ensure token has `repo` scope
- Check token hasn't expired

**"Repository not found"**
- Verify the repository name in `config/repositories.yml`
- Ensure your GitHub token has access to the repository

### Logs

Check logs for debugging:

```bash
# Development
npm run dev

# Production (with debug logging)
LOG_LEVEL=debug npm start
```

## Next Steps

- [Configuration Guide](./configuration.md)
- [Architecture](./architecture.md)
- [Troubleshooting](./troubleshooting.md)
