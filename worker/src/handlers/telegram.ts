import type { Env, TelegramUpdate, RequestData } from '../types';
import { generateId, generateResumeToken } from '../utils/crypto';
import { checkRateLimit } from '../utils/rate-limit';
import { createRequest, getRequest } from '../services/kv';
import { 
  sendTelegramMessage, 
  sendProgressUpdate 
} from '../services/telegram-api';
import { triggerWorkflow, validateGithubToken, validateRepositoryAccess } from '../services/github-api';

// Session storage for conversation state
const sessions = new Map<string, {
  step: 'repo' | 'repo_name' | 'branch' | 'instruction' | 'confirm';
  command?: string;
  repo?: string;
  branch?: string;
  instruction?: string;
}>();

// Handle Telegram update
export async function handleTelegramUpdate(
  request: Request,
  env: Env
): Promise<Response> {
  const update: TelegramUpdate = await request.json();
  
  if (!update.message?.text) {
    return new Response('OK');
  }
  
  const { message } = update;
  const chatId = message.chat.id.toString();
  const userId = message.from.id;
  const text = message.text.trim();
  
  // Check if user is authorized (you can add your Telegram user ID here)
  // For now, we'll allow all users but validate their GitHub tokens
  
  // Handle commands
  if (text.startsWith('/')) {
    return handleCommand(env, chatId, userId, text);
  }
  
  // Handle conversation flow
  return handleConversation(env, chatId, userId, text);
}

// Handle bot commands
async function handleCommand(
  env: Env,
  chatId: string,
  userId: number,
  text: string
): Promise<Response> {
  const parts = text.split(' ');
  const command = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ');
  
  switch (command) {
    case '/start':
    case '/help':
      return sendHelp(env, chatId);
    
    case '/status':
      if (!arg) {
        await sendTelegramMessage(env, chatId, 'Usage: /status <request_id>');
        return new Response('OK');
      }
      return handleStatus(env, chatId, arg);
    
    case '/resume':
      if (!arg) {
        await sendTelegramMessage(env, chatId, 'Usage: /resume <resume_token>');
        return new Response('OK');
      }
      return handleResume(env, chatId, userId, arg);
    
    case '/fix':
    case '/add':
    case '/refactor':
    case '/review':
    case '/explain':
    case '/test':
    case '/document':
    case '/cleanup':
    case '/improve':
    case '/run':
      return startConversation(env, chatId, userId, command.slice(1));
    
    default:
      await sendTelegramMessage(env, chatId, 'Unknown command. Use /help to see available commands.');
      return new Response('OK');
  }
}

// Send help message
async function sendHelp(env: Env, chatId: string): Promise<Response> {
  const helpMessage = [
    '<b>ActionCode Bot</b>',
    '',
    'I help you modify code using AI.',
    '',
    '<b>Commands:</b>',
    '/fix - Fix bugs or issues',
    '/add - Add new features',
    '/refactor - Refactor code',
    '/review - Review code changes',
    '/explain - Explain code',
    '/test - Run tests',
    '/document - Generate documentation',
    '/cleanup - Clean up code',
    '/improve - Improve code quality',
    '/run - Run custom instructions',
    '',
    '<b>Other Commands:</b>',
    '/status &lt;request_id&gt; - Check request status',
    '/resume &lt;token&gt; - Resume a rate-limited request',
    '/help - Show this help message',
    '',
    '<b>How to use:</b>',
    '1. Send a command (e.g., /fix)',
    '2. Enter your GitHub token',
    '3. Enter repository (owner/repo)',
    '4. Enter branch (default: main)',
    '5. Describe what you want to do',
    '6. Confirm to start',
    '',
    '<b>Web UI:</b> Visit ezcode.github.io',
  ].join('\n');
  
  await sendTelegramMessage(env, chatId, helpMessage, { parse_mode: 'HTML' });
  return new Response('OK');
}

// Start conversation flow
async function startConversation(
  env: Env,
  chatId: string,
  userId: number,
  command: string
): Promise<Response> {
  const sessionKey = `${chatId}:${userId}`;
  sessions.set(sessionKey, {
    step: 'repo',
    command,
  });
  
  await sendTelegramMessage(env, chatId, 'Enter your GitHub token:');
  return new Response('OK');
}

// Handle conversation flow
async function handleConversation(
  env: Env,
  chatId: string,
  userId: number,
  text: string
): Promise<Response> {
  const sessionKey = `${chatId}:${userId}`;
  const session = sessions.get(sessionKey);
  
  if (!session) {
    await sendTelegramMessage(env, chatId, 'Please start with a command (e.g., /fix)');
    return new Response('OK');
  }
  
  switch (session.step) {
    case 'repo':
      // Validate GitHub token
      const tokenValidation = await validateGithubToken(text);
      if (!tokenValidation.valid) {
        await sendTelegramMessage(env, chatId, `Invalid GitHub token: ${tokenValidation.error}`);
        return new Response('OK');
      }
      
      // Store token temporarily in session
      (session as any).githubToken = text;
      session.step = 'repo_name';
      
      await sendTelegramMessage(env, chatId, `Authenticated as: ${tokenValidation.user}\n\nEnter repository (owner/repo):`);
      return new Response('OK');
    
    case 'repo_name':
      // Validate repository
      const repoValidation = await validateRepositoryAccess(
        (session as any).githubToken,
        text
      );
      
      if (!repoValidation.valid) {
        await sendTelegramMessage(env, chatId, `Cannot access repository: ${repoValidation.error}`);
        return new Response('OK');
      }
      
      session.repo = text;
      session.step = 'branch';
      
      await sendTelegramMessage(env, chatId, 'Enter branch (default: main):');
      return new Response('OK');
    
    case 'branch':
      session.branch = text || 'main';
      session.step = 'instruction';
      
      await sendTelegramMessage(env, chatId, 'Describe what you want to do:');
      return new Response('OK');
    
    case 'instruction':
      session.instruction = text;
      session.step = 'confirm';
      
      const confirmMessage = [
        '<b>Confirm Request:</b>',
        '',
        `Command: ${session.command}`,
        `Repository: <code>${session.repo}</code>`,
        `Branch: <code>${session.branch}</code>`,
        `Instruction: ${session.instruction}`,
        '',
        'Reply "yes" to start or "no" to cancel.',
      ].join('\n');
      
      await sendTelegramMessage(env, chatId, confirmMessage, { parse_mode: 'HTML' });
      return new Response('OK');
    
    case 'confirm':
      if (text.toLowerCase() === 'yes' || text.toLowerCase() === 'y') {
        return executeRequest(env, chatId, userId, session);
      } else {
        sessions.delete(sessionKey);
        await sendTelegramMessage(env, chatId, 'Request cancelled.');
      }
      return new Response('OK');
    
    default:
      sessions.delete(sessionKey);
      await sendTelegramMessage(env, chatId, 'Something went wrong. Please start again.');
      return new Response('OK');
  }
}

// Execute the request
async function executeRequest(
  env: Env,
  chatId: string,
  userId: number,
  session: any
): Promise<Response> {
  const requestId = generateId();
  
  // Check rate limit
  const rateLimit = await checkRateLimit(env, userId.toString());
  if (!rateLimit.allowed) {
    await sendTelegramMessage(env, chatId, 
      `Rate limit exceeded. Please try again after ${rateLimit.resetAt}`);
    sessions.delete(`${chatId}:${userId}`);
    return new Response('OK');
  }
  
  // Create request in KV
  const request = await createRequest(env, requestId, {
    status: 'pending',
    repository: session.repo,
    branch: session.branch,
    instruction: session.instruction,
    userTelegramId: userId,
    userTelegramChatId: chatId,
  });
  
  // Send initial status
  await sendProgressUpdate(env, chatId, 'pending', `Request ID: ${requestId}`);
  
  // Trigger GitHub Actions
  const workflowResult = await triggerWorkflow(env, {
    repository: session.repo,
    branch: session.branch,
    instruction: session.instruction,
    requestId,
    callbackUrl: env.WORKER_URL,
    userGithubToken: session.githubToken,
  });
  
  if (!workflowResult.success) {
    // Update request status
    await createRequest(env, requestId, {
      ...request,
      status: 'failed',
      errorMessage: workflowResult.error,
    });
    
    await sendTelegramMessage(env, chatId, 
      `Failed to trigger workflow: ${workflowResult.error}`);
    sessions.delete(`${chatId}:${userId}`);
    return new Response('OK');
  }
  
  // Update request with workflow run ID
  await createRequest(env, requestId, {
    ...request,
    status: 'dispatched',
    workflowRunId: workflowResult.runId,
  });
  
  await sendProgressUpdate(env, chatId, 'dispatched', 
    `Workflow run: https://github.com/${session.repo}/actions`);
  
  // Clean up session
  sessions.delete(`${chatId}:${userId}`);
  
  return new Response('OK');
}

// Handle status check
async function handleStatus(
  env: Env,
  chatId: string,
  requestId: string
): Promise<Response> {
  const request = await getRequest(env, requestId);
  
  if (!request) {
    await sendTelegramMessage(env, chatId, `Request not found: ${requestId}`);
    return new Response('OK');
  }
  
  const statusMessage = [
    '<b>Request Status</b>',
    '',
    `ID: <code>${request.id}</code>`,
    `Status: ${request.status}`,
    `Repository: <code>${request.repository}</code>`,
    `Branch: <code>${request.branch}</code>`,
    `Created: ${request.createdAt}`,
    request.prUrl ? `PR: <a href="${request.prUrl}">View Pull Request</a>` : '',
    request.errorMessage ? `Error: ${request.errorMessage}` : '',
  ].filter(Boolean).join('\n');
  
  await sendTelegramMessage(env, chatId, statusMessage, { parse_mode: 'HTML' });
  return new Response('OK');
}

// Handle resume
async function handleResume(
  env: Env,
  chatId: string,
  userId: number,
  resumeToken: string
): Promise<Response> {
  // Get resume data from KV
  const resumeData = await env.ACTIONCODE_KV.get(`resume:${resumeToken}`, 'json');
  
  if (!resumeData) {
    await sendTelegramMessage(env, chatId, 'Resume token not found or expired.');
    return new Response('OK');
  }
  
  const data = resumeData as any;
  
  // Check expiry
  if (new Date(data.expiresAt) < new Date()) {
    await sendTelegramMessage(env, chatId, 'Resume token has expired.');
    return new Response('OK');
  }
  
  // Create new request with remaining instruction
  const requestId = generateId();
  
  const request = await createRequest(env, requestId, {
    status: 'pending',
    repository: data.repository || data.branch.split('/').slice(0, 2).join('/'),
    branch: data.branch,
    instruction: data.remainingInstruction,
    userTelegramId: userId,
    userTelegramChatId: chatId,
  });
  
  // Send initial status
  await sendProgressUpdate(env, chatId, 'pending', 
    `Resuming from previous request. New Request ID: ${requestId}`);
  
  // Trigger GitHub Actions with resume context
  const workflowResult = await triggerWorkflow(env, {
    repository: request.repository,
    branch: request.branch,
    instruction: data.remainingInstruction,
    requestId,
    callbackUrl: env.WORKER_URL,
  });
  
  if (!workflowResult.success) {
    await sendTelegramMessage(env, chatId, 
      `Failed to resume: ${workflowResult.error}`);
    return new Response('OK');
  }
  
  // Update request
  await createRequest(env, requestId, {
    ...request,
    status: 'dispatched',
    workflowRunId: workflowResult.runId,
  });
  
  await sendProgressUpdate(env, chatId, 'dispatched', 'Resumed execution');
  
  // Delete used resume token
  await env.ACTIONCODE_KV.delete(`resume:${resumeToken}`);
  
  return new Response('OK');
}
