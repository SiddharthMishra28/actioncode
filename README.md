# ActionCode

GitHub Actions-based autonomous AI coding system with Telegram integration.

## Overview

ActionCode is a production-quality, open-source system that allows developers to interact with GitHub repositories entirely from Telegram. A user sends a message to a Telegram Bot, and the system:

1. Understands the request
2. Determines which repository it belongs to
3. Triggers a GitHub Actions workflow
4. Executes OpenCode completely non-interactively
5. Autonomously inspects the repository
6. Modifies code
7. Runs builds, linting, and tests
8. Retries fixes when possible
9. Creates a new branch, pushes commits, and creates a Pull Request
10. Summarizes everything and responds back in the same Telegram conversation

## Architecture

```
Telegram User → Telegram Bot → Webhook Service → GitHub Workflow Dispatch
    ↓
GitHub Actions Runner → Repository Checkout → OpenCode Agent
    ↓
Build → Tests → Retry Loop → Create Branch → Push Commit → Create PR
    ↓
Collect Metrics → Send Telegram Reply
```

## Features

- **Multi-Repository Support**: Manage multiple repositories from a single bot
- **Command System**: Specialized commands for different tasks (fix, add, refactor, etc.)
- **Progress Updates**: Real-time Telegram notifications
- **Automatic Build Detection**: Supports Maven, Gradle, npm, Python, Go, Rust, Docker
- **Retry Logic**: Automatic retry on build/test failures
- **Pull Request Creation**: Automatic PR with detailed descriptions
- **Rate Limiting**: Configurable limits per user, repository, and globally
- **Structured Logging**: JSON logs with context
- **Extensible Design**: Easy to add new providers (Slack, Teams, etc.)

## Quick Start

### Prerequisites

- Node.js 20+
- GitHub account with a Personal Access Token
- Telegram Bot Token (from @BotFather)

### Installation

```bash
# Clone the repository
git clone https://github.com/SiddharthMishra28/actioncode.git
cd actioncode

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
```

### Configuration

1. **Telegram Bot Setup**:
   - Create a bot with @BotFather
   - Get your bot token
   - Get your Telegram user ID (send /start to @userinfobot)

2. **GitHub Setup**:
   - Create a Personal Access Token with repo permissions
   - Add your repositories to `config/repositories.yml`

3. **Environment Variables**:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   GITHUB_TOKEN=ghp_your_token
   ```

### Running

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## Commands

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
| `/cancel` | Cancel a request |
| `/status` | Check request status |
| `/logs` | Get execution logs |
| `/help` | Show help message |

## Configuration Files

- `config/telegram.yml` - Bot behavior and settings
- `config/repositories.yml` - Repository configurations
- `config/models.yml` - AI model settings
- `config/limits.yml` - Rate limits and constraints
- `config/build.yml` - Build system detection
- `config/notifications.yml` - Notification settings

## Supported Build Systems

- Maven
- Gradle
- npm/yarn/pnpm
- Python (pip/poetry)
- Go
- Rust (Cargo)
- Docker/Docker Compose

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Documentation

- [Installation Guide](./docs/installation.md)
- [Configuration Guide](./docs/configuration.md)
- [Architecture](./docs/architecture.md)
- [API Reference](./docs/api.md)
- [Troubleshooting](./docs/troubleshooting.md)

## License

MIT
