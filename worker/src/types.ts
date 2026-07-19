// Environment bindings
export interface Env {
  // KV Namespace
  ACTIONCODE_KV: KVNamespace;
  
  // Secrets
  TELEGRAM_BOT_TOKEN: string;
  GITHUB_TOKEN: string;
  WEBHOOK_SECRET: string;
  
  // Environment variables
  ENVIRONMENT: string;
  WORKER_URL: string;
}

// Request status
export type RequestStatus = 
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
  | 'rate-limited'
  | 'cancelled';

// Request data stored in KV
export interface RequestData {
  id: string;
  status: RequestStatus;
  repository: string;
  branch: string;
  instruction: string;
  channel: 'telegram' | 'web';
  userTelegramId: number;
  userTelegramChatId: string;
  workflowRunId?: number;
  prUrl?: string;
  commitSha?: string;
  modifiedFiles?: string[];
  buildSuccess?: boolean;
  testSuccess?: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  resumeToken?: string;
}

// Resume token data
export interface ResumeData {
  token: string;
  requestId: string;
  originalInstruction: string;
  completedSteps: string[];
  branch: string;
  commitSha: string;
  modifiedFiles: string[];
  remainingInstruction: string;
  createdAt: string;
  expiresAt: string;
}

// Log data stored in KV
export interface LogData {
  lines: string[];
  lastUpdated: string;
}

// Rate limit data
export interface RateLimitData {
  count: number;
  resetAt: string;
}

// Telegram Update
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

// GitHub Actions callback payload
export interface GitHubCallbackPayload {
  request_id: string;
  status: RequestStatus;
  pr_url?: string;
  build_success?: string;
  test_success?: string;
  modified_files?: string;
  commit_sha?: string;
  branch?: string;
  error_message?: string;
}

// API trigger payload
export interface TriggerPayload {
  github_token: string;
  repository: string;
  branch?: string;
  instruction: string;
}

// API response
export interface ApiResponse {
  success: boolean;
  error?: string;
  request_id?: string;
  data?: unknown;
}
