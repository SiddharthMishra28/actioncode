import { z } from 'zod';

export const TelegramUserSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
});

export type TelegramUser = z.infer<typeof TelegramUserSchema>;

export const CommandSchema = z.enum([
  'fix',
  'add',
  'refactor',
  'review',
  'explain',
  'test',
  'document',
  'cleanup',
  'improve',
  'run',
  'cancel',
  'status',
  'logs',
  'help',
]);

export type Command = z.infer<typeof CommandSchema>;

export const PrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type Priority = z.infer<typeof PrioritySchema>;

export const ExecutionModeSchema = z.enum(['full', 'dry-run', 'analysis-only']);
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;

export const RequestStatusSchema = z.enum([
  'pending',
  'validating',
  'dispatched',
  'running',
  'building',
  'testing',
  'retrying',
  'creating-pr',
  'completed',
  'failed',
  'cancelled',
]);

export type RequestStatus = z.infer<typeof RequestStatusSchema>;

export const WorkflowInputSchema = z.object({
  repository: z.string().min(1),
  branch: z.string().default('main'),
  instruction: z.string().min(1),
  telegram_chat_id: z.string(),
  telegram_user: z.string(),
  request_id: z.string().uuid(),
  priority: PrioritySchema.default('medium'),
  model: z.string().default('opencode/free-model'),
  execution_mode: ExecutionModeSchema.default('full'),
});

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;

export const WorkflowRunSchema = z.object({
  id: z.number(),
  status: z.string(),
  conclusion: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  run_started_at: z.string().nullable(),
  html_url: z.string(),
  jobs_url: z.string(),
});

export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

export const RequestSchema = z.object({
  id: z.string().uuid(),
  userId: z.number(),
  chatId: z.string(),
  command: CommandSchema,
  repository: z.string(),
  branch: z.string().default('main'),
  instruction: z.string(),
  status: RequestStatusSchema,
  priority: PrioritySchema,
  model: z.string(),
  executionMode: ExecutionModeSchema,
  workflowRunId: z.number().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional(),
  result: z.any().nullable().optional(),
  error: z.string().nullable().optional(),
});

export type Request = z.infer<typeof RequestSchema>;

export const RepositoryConfigSchema = z.object({
  name: z.string(),
  fullName: z.string(),
  defaultBranch: z.string().default('main'),
  allowedUsers: z.array(z.number()),
  enabledCommands: z.array(CommandSchema).optional(),
  buildCommand: z.string().optional(),
  testCommand: z.string().optional(),
  lintCommand: z.string().optional(),
  installCommand: z.string().optional(),
  environment: z.record(z.string()).optional(),
});

export type RepositoryConfig = z.infer<typeof RepositoryConfigSchema>;

export const BuildResultSchema = z.object({
  success: z.boolean(),
  command: z.string(),
  output: z.string(),
  duration: z.number(),
  attempt: z.number(),
});

export type BuildResult = z.infer<typeof BuildResultSchema>;

export const TestResultSchema = z.object({
  success: z.boolean(),
  total: z.number(),
  passed: z.number(),
  failed: z.number(),
  skipped: z.number(),
  output: z.string(),
  coverage: z.number().nullable().optional(),
});

export type TestResult = z.infer<typeof TestResultSchema>;

export const PRResultSchema = z.object({
  number: z.number(),
  url: z.string(),
  title: z.string(),
  body: z.string(),
  filesChanged: z.number(),
  additions: z.number(),
  deletions: z.number(),
});

export type PRResult = z.infer<typeof PRResultSchema>;

export const ExecutionResultSchema = z.object({
  success: z.boolean(),
  request: RequestSchema,
  branch: z.string(),
  commitSha: z.string().nullable().optional(),
  build: BuildResultSchema.nullable().optional(),
  tests: TestResultSchema.nullable().optional(),
  pullRequest: PRResultSchema.nullable().optional(),
  modifiedFiles: z.array(z.string()).optional(),
  duration: z.number(),
  retryCount: z.number(),
  logs: z.string().optional(),
});

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
