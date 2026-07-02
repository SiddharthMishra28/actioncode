# Architecture

## System Overview

ActionCode follows a modular, event-driven architecture with clear separation of concerns.

```
┌─────────────────────────────────────────────────────────────┐
│                      Telegram User                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Bot                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Commands   │  │  Sessions   │  │  Message Handler    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Webhook Server                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Telegram   │  │   GitHub    │  │     REST API        │ │
│  │  Webhook    │  │  Webhook    │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Services Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Config    │  │  Request    │  │      GitHub         │ │
│  │   Loader    │  │  Service    │  │      Service        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               GitHub Actions Workflow                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Checkout   │  │  OpenCode   │  │  Build & Test       │ │
│  │  Repository │  │  Execution  │  │  Pipeline           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Output                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Pull      │  │  Telegram   │  │     Artifacts       │ │
│  │   Request   │  │  Reply      │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Telegram Bot

**Location**: `src/services/telegram.ts`

Handles all Telegram interactions:
- Command parsing and validation
- Conversation state management
- Message formatting and sending
- User authentication

**Key Features**:
- Session-based conversation flow
- Markdown formatting support
- Progress updates
- Error handling

### 2. Webhook Server

**Location**: `src/webhook/server.ts`

Express-based HTTP server handling:
- Telegram webhook updates
- GitHub workflow events
- REST API for status queries

**Endpoints**:
- `POST /webhook/telegram` - Telegram updates
- `POST /webhook/github` - GitHub events
- `GET /health` - Health check
- `GET /api/requests` - List requests
- `GET /api/requests/:id` - Get request
- `POST /api/requests/:id/cancel` - Cancel request

### 3. Configuration Service

**Location**: `src/services/config.ts`

Manages all configuration:
- YAML file loading
- Environment variable interpolation
- Schema validation (Zod)
- Config caching

### 4. Request Service

**Location**: `src/services/request.ts`

Manages request lifecycle:
- Request creation and storage
- Status tracking
- Rate limiting
- Statistics

### 5. GitHub Service

**Location**: `src/services/github.ts`

Interacts with GitHub API:
- Workflow dispatch
- Workflow run monitoring
- Pull request creation
- Repository information

### 6. Logger Service

**Location**: `src/services/logger.ts`

Structured logging:
- JSON format
- Context-aware logging
- Multiple log levels
- Pretty printing in development

## Data Flow

### 1. User Sends Command

```
User: /fix payments-api develop Implement pagination
     ↓
Telegram Bot parses command
     ↓
Validates user authorization
     ↓
Validates repository access
     ↓
Creates Request object
     ↓
Triggers GitHub Actions workflow
     ↓
Sends confirmation to user
```

### 2. Workflow Execution

```
GitHub Actions starts
     ↓
Checks out repository
     ↓
Installs OpenCode
     ↓
Analyzes repository structure
     ↓
Executes OpenCode with instruction
     ↓
Builds project
     ↓
Runs tests
     ↓
Creates branch and commits
     ↓
Creates Pull Request
     ↓
Sends completion notification
```

### 3. Progress Updates

```
Workflow Step Complete
     ↓
GitHub sends webhook event
     ↓
Webhook Server receives event
     ↓
Updates Request status
     ↓
Sends Telegram notification
```

## Design Patterns

### 1. Adapter Pattern

Services use adapters for external integrations:
- `TelegramService` adapts grammY
- `GitHubService` adapts Octokit

### 2. Factory Pattern

Service creation uses factories:
```typescript
createGitHubService(owner, repo, token)
```

### 3. Strategy Pattern

Build detection uses strategy:
- Different build systems
- Different test runners
- Different frameworks

### 4. Observer Pattern

Event-driven updates:
- GitHub webhooks trigger state changes
- State changes trigger notifications

### 5. Repository Pattern

Request storage:
- In-memory storage (production uses Redis)
- CRUD operations
- Query filtering

## Security

### 1. User Authentication

- Telegram user ID validation
- Allowlist-based access control
- Repository-level permissions

### 2. Input Sanitization

- Zod schema validation
- Shell injection prevention
- Path traversal protection

### 3. Webhook Verification

- GitHub signature verification
- Telegram webhook secrets
- CORS configuration

### 4. Rate Limiting

- Per-user limits
- Per-repository limits
- Global limits

## Scalability

### 1. Horizontal Scaling

- Stateless webhook server
- Redis for shared state
- Multiple worker processes

### 2. Vertical Scaling

- Configurable limits
- Resource monitoring
- Auto-scaling triggers

### 3. Future Extensions

- Microsoft Teams integration
- Slack integration
- Discord integration
- GitLab support
- Azure DevOps support

## Error Handling

### 1. Retry Logic

- Build failures
- Test failures
- Network errors
- API rate limits

### 2. Circuit Breaker

- GitHub API failures
- Telegram API failures
- External service failures

### 3. Graceful Degradation

- Partial results
- Fallback notifications
- Manual intervention paths

## Monitoring

### 1. Metrics

- Request counts
- Success/failure rates
- Execution times
- Resource usage

### 2. Logging

- Structured JSON logs
- Request tracing
- Error tracking

### 3. Alerting

- Failure notifications
- Performance alerts
- Security alerts
