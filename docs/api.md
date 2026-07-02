# API Reference

## REST API Endpoints

### Health Check

```
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### List Requests

```
GET /api/requests
```

**Query Parameters**:
- `userId` (optional): Filter by user ID
- `repository` (optional): Filter by repository
- `status` (optional): Filter by status
- `limit` (optional): Limit results

**Response**:
```json
[
  {
    "id": "uuid",
    "userId": 123456,
    "chatId": "789",
    "command": "fix",
    "repository": "owner/repo",
    "branch": "main",
    "instruction": "Fix the bug",
    "status": "completed",
    "priority": "medium",
    "model": "opencode/free-model",
    "executionMode": "full",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:05:00.000Z"
  }
]
```

### Get Request

```
GET /api/requests/:id
```

**Response**:
```json
{
  "id": "uuid",
  "userId": 123456,
  "chatId": "789",
  "command": "fix",
  "repository": "owner/repo",
  "branch": "main",
  "instruction": "Fix the bug",
  "status": "completed",
  "workflowRunId": 12345,
  "result": {
    "success": true,
    "pullRequest": {
      "number": 42,
      "url": "https://github.com/owner/repo/pull/42"
    }
  }
}
```

### Cancel Request

```
POST /api/requests/:id/cancel
```

**Response**:
```json
{
  "success": true
}
```

## Webhook Endpoints

### Telegram Webhook

```
POST /webhook/telegram
```

**Request Body**: Telegram Update object

**Response**: `200 OK`

### GitHub Webhook

```
POST /webhook/github
```

**Headers**:
- `X-GitHub-Event`: Event type
- `X-Hub-Signature-256`: Signature for verification

**Request Body**: GitHub event payload

**Response**: `200 OK`

## Telegram Bot Commands

### /start

Initializes the bot and shows welcome message.

**Response**: Welcome message with available commands.

### /help

Shows help message with all available commands.

**Response**: Help message.

### /fix

Fixes bugs or issues.

**Conversation Flow**:
1. Bot asks for repository
2. Bot asks for branch
3. Bot asks for instruction
4. Bot confirms and executes

**Example**:
```
User: /fix
Bot: Which repository?
User: payments-api
Bot: Branch?
User: develop
Bot: Describe the enhancement.
User: Implement pagination for GET /orders
Bot: Start? (Yes/No)
User: Yes
Bot: 🟢 Request Accepted
```

### /add

Adds new features.

**Same conversation flow as /fix**.

### /refactor

Refactors code.

**Same conversation flow as /fix**.

### /review

Reviews code changes.

**Same conversation flow as /fix**.

### /explain

Explains code.

**Same conversation flow as /fix**.

### /test

Runs tests.

**Same conversation flow as /fix**.

### /document

Generates documentation.

**Same conversation flow as /fix**.

### /cleanup

Cleans up code.

**Same conversation flow as /fix**.

### /improve

Improves code quality.

**Same conversation flow as /fix**.

### /run

Runs custom instructions.

**Same conversation flow as /fix**.

### /cancel

Cancels the current request.

**Response**: Request cancelled.

### /status

Shows status of active requests.

**Response**: List of active requests.

### /logs

Shows execution logs.

**Response**: Recent logs.

## GitHub Actions Workflow Inputs

### workflow_dispatch

**Inputs**:
- `repository` (required): Target repository (owner/repo)
- `branch` (required): Target branch
- `instruction` (required): AI instruction
- `telegram_chat_id` (required): Telegram chat ID
- `telegram_user` (required): Telegram user
- `request_id` (required): Unique request ID
- `priority` (optional): Request priority (low/medium/high/critical)
- `model` (optional): AI model to use
- `execution_mode` (optional): Execution mode (full/dry-run/analysis-only)

## TypeScript Types

### Request

```typescript
interface Request {
  id: string;
  userId: number;
  chatId: string;
  command: Command;
  repository: string;
  branch: string;
  instruction: string;
  status: RequestStatus;
  priority: Priority;
  model: string;
  executionMode: ExecutionMode;
  workflowRunId?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: any;
  error?: string;
}
```

### Command

```typescript
type Command = 
  | 'fix'
  | 'add'
  | 'refactor'
  | 'review'
  | 'explain'
  | 'test'
  | 'document'
  | 'cleanup'
  | 'improve'
  | 'run'
  | 'cancel'
  | 'status'
  | 'logs'
  | 'help';
```

### RequestStatus

```typescript
type RequestStatus = 
  | 'pending'
  | 'validating'
  | 'dispatched'
  | 'running'
  | 'building'
  | 'testing'
  | 'retrying'
  | 'creating-pr'
  | 'completed'
  | 'failed'
  | 'cancelled';
```

### Priority

```typescript
type Priority = 'low' | 'medium' | 'high' | 'critical';
```

### ExecutionMode

```typescript
type ExecutionMode = 'full' | 'dry-run' | 'analysis-only';
```

## Error Responses

### 400 Bad Request

```json
{
  "error": "Invalid request",
  "message": "Missing required field: repository"
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication"
}
```

### 404 Not Found

```json
{
  "error": "Not found",
  "message": "Request not found"
}
```

### 429 Rate Limited

```json
{
  "error": "Rate limited",
  "message": "Too many requests. Please try again later."
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```
