# Configuration Guide

## Overview

ActionCode uses YAML configuration files in the `config/` directory. All settings are configurable and support environment variable interpolation.

## Environment Variables

Set these in `.env` or your environment:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
GITHUB_TOKEN=ghp_your_token

# Optional
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

## Configuration Files

### telegram.yml

Bot behavior and settings:

```yaml
telegram:
  botToken: ${TELEGRAM_BOT_TOKEN}
  webhookSecret: ${TELEGRAM_WEBHOOK_SECRET}
  
  # Users allowed to use the bot (Telegram user IDs)
  allowedUsers:
    - 123456789
  
  behavior:
    welcomeMessage: |
      Welcome to ActionCode!
      ...
    errorUnauthorized: "❌ You are not authorized."
    # ... more messages
  
  conversationTimeout: 300  # seconds
  maxMessageLength: 4096
  codeBlockMaxLength: 3000
```

### repositories.yml

Repository configurations:

```yaml
repositories:
  - name: my-project
    fullName: owner/repo
    defaultBranch: main
    
    # Telegram user IDs allowed to use this repo
    allowedUsers:
      - 123456789
    
    # Commands enabled for this repo (optional, defaults to all)
    enabledCommands:
      - fix
      - add
      - refactor
      - test
    
    # Custom build commands (optional, auto-detected if not set)
    buildCommand: npm run build
    testCommand: npm test
    lintCommand: npm run lint
    installCommand: npm install
    
    # Environment variables for the build
    environment:
      NODE_ENV: production
```

### models.yml

AI model configuration:

```yaml
models:
  # Available free models
  free:
    - name: opencode/free-model
      description: "OpenCode free model"
      maxTokens: 4096
      temperature: 0.7
      enabled: true
  
  defaults:
    model: opencode/free-model
    temperature: 0.7
    maxTokens: 4096
    timeout: 300
  
  selection:
    autoSelect: true
    complexityThresholds:
      simple: 0.3
      medium: 0.6
      complex: 0.8
```

### limits.yml

Rate limits and constraints:

```yaml
limits:
  # Per-user limits
  perUser:
    maxConcurrent: 3
    maxDaily: 50
    maxMonthly: 500
  
  # Per-repository limits
  perRepository:
    maxConcurrent: 10
    maxDaily: 100
  
  # Global limits
  global:
    maxConcurrent: 50
    maxDaily: 1000
  
  # Execution limits
  execution:
    maxRetries: 3
    retryDelay: 5000
    timeout: 1800000  # 30 minutes
    maxBuildTime: 600000  # 10 minutes
  
  # File limits
  files:
    maxModified: 50
    maxAdded: 20
    maxDeleted: 10
    maxFileSize: 1048576  # 1MB
  
  # Rate limiting
  rateLimit:
    windowMs: 60000  # 1 minute
    maxRequests: 10
```

### build.yml

Build system detection:

```yaml
build:
  detection:
    buildSystems:
      - name: maven
        files:
          - pom.xml
        buildCommand: "mvn clean package -DskipTests"
        testCommand: "mvn test"
      
      - name: npm
        files:
          - package.json
        buildCommand: "npm run build"
        testCommand: "npm test"
    
    frameworks:
      - name: spring-boot
        indicators:
          - "org.springframework.boot"
          - "@SpringBootApplication"
      
      - name: nextjs
        indicators:
          - "next.config.js"
          - "next.config.mjs"
  
  optimization:
    enableCache: true
    cacheDirectories:
      - node_modules
      - .gradle
      - .m2
```

### notifications.yml

Notification settings:

```yaml
notifications:
  telegram:
    enabled: true
    
    progress:
      enabled: true
      interval: 30000
    
    completion:
      enabled: true
      includeBuildLogs: true
      includeTestResults: true
      includePRLink: true
    
    failure:
      enabled: true
      includeErrorDetails: true
      includeSuggestions: true
  
  github:
    enabled: true
    
    pullRequest:
      enabled: true
      labels:
        - "ai-generated"
        - "automated"
```

## Advanced Configuration

### Custom Build Commands

If auto-detection doesn't work, specify commands explicitly:

```yaml
repositories:
  - name: custom-project
    fullName: owner/repo
    buildCommand: "make build"
    testCommand: "make test"
    installCommand: "make setup"
```

### Environment Variables in Build

Pass environment variables to builds:

```yaml
repositories:
  - name: api-server
    fullName: owner/api-server
    environment:
      DATABASE_URL: postgres://localhost/mydb
      REDIS_URL: redis://localhost:6379
      API_KEY: ${API_KEY}  # From .env
```

### Multiple Models

Configure different models for different complexity levels:

```yaml
models:
  free:
    - name: opencode/free-model
      enabled: true
    - name: opencode/free-model-v2
      enabled: true
  
  selection:
    autoSelect: true
    modelMapping:
      simple: opencode/free-model
      medium: opencode/free-model
      complex: opencode/free-model-v2
```

### Rate Limiting

Adjust limits based on your needs:

```yaml
limits:
  perUser:
    maxConcurrent: 5
    maxDaily: 100
  
  execution:
    maxRetries: 5
    timeout: 3600000  # 1 hour
```

## Validation

Configuration is validated using Zod schemas. Invalid configuration will cause the application to fail on startup with descriptive error messages.

## Reloading Configuration

Configuration is loaded once at startup. To reload:

```bash
# Restart the service
npm run dev  # or
npm start
```

For development, use file watching:

```bash
npm run dev  # Uses tsx watch for auto-reload
```
