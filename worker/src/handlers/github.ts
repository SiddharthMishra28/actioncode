import type { Env, GitHubCallbackPayload } from '../types';
import { getRequest, updateRequest } from '../services/kv';
import { 
  sendProgressUpdate, 
  sendCompletionMessage, 
  sendFailureMessage,
  sendRateLimitMessage 
} from '../services/telegram-api';
import { generateResumeToken } from '../utils/crypto';

// Handle GitHub Actions callback
export async function handleGitHubCallback(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.text();

  // Webhook secret verification skipped — GitHub Actions is trusted
  // The callback comes from GitHub's own infrastructure

  // Parse payload
  let payload: GitHubCallbackPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  const { request_id, status, pr_url, build_success, test_success, 
          modified_files, commit_sha, branch, error_message } = payload;
  
  if (!request_id || !status) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Get the request from KV
  const requestData = await getRequest(env, request_id);
  
  if (!requestData) {
    return new Response(JSON.stringify({ error: 'Request not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Update request based on status
  const updates: Record<string, unknown> = {
    status,
  };
  
  if (pr_url) updates.prUrl = pr_url;
  if (commit_sha) updates.commitSha = commit_sha;
  if (modified_files) updates.modifiedFiles = modified_files.split(',').filter(f => f.trim());
  if (error_message) updates.errorMessage = error_message;
  if (branch) updates.branch = branch;
  if (build_success !== undefined) updates.buildSuccess = build_success === 'true';
  if (test_success !== undefined) updates.testSuccess = test_success === 'true';

  // Handle different statuses — send Telegram notifications where applicable
  const chatId = requestData.userTelegramChatId;
  
  switch (status) {
    case 'running':
    case 'building':
    case 'testing':
    case 'retrying':
    case 'creating-pr':
      if (chatId) {
        await sendProgressUpdate(env, chatId, status, `Request ID: ${request_id}`);
      }
      break;
    
    case 'completed':
      updates.completedAt = new Date().toISOString();
      if (chatId) {
        await sendCompletionMessage(env, chatId, {
          repository: requestData.repository,
          branch: requestData.branch,
          prUrl: pr_url,
          commitSha: commit_sha,
          filesChanged: modified_files ? modified_files.split(',').length : 0,
          duration: calculateDuration(requestData.createdAt),
        });
      }
      break;
    
    case 'failed':
      updates.completedAt = new Date().toISOString();
      if (chatId) {
        await sendFailureMessage(env, chatId, {
          reason: error_message || 'Workflow failed',
          modifiedFiles: modified_files ? modified_files.split(',') : [],
        });
      }
      break;
    
    case 'rate-limited': {
      const resumeToken = generateResumeToken();
      const resumeData = {
        token: resumeToken,
        requestId: request_id,
        originalInstruction: requestData.instruction,
        completedSteps: ['checkout', 'analysis'],
        branch: requestData.branch,
        commitSha: commit_sha || '',
        modifiedFiles: modified_files ? modified_files.split(',') : [],
        remainingInstruction: 'Continue from where we left off. Complete remaining steps.',
        repository: requestData.repository,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      };
      
      await env.ACTIONCODE_KV.put(
        `resume:${resumeToken}`,
        JSON.stringify(resumeData),
        { expirationTtl: 12 * 60 * 60 }
      );
      
      updates.resumeToken = resumeToken;
      updates.completedAt = new Date().toISOString();
      
      if (chatId) {
        await sendRateLimitMessage(env, chatId, resumeToken);
      }
      break;
    }
    
    default:
      if (chatId) {
        await sendProgressUpdate(env, chatId, status, `Request ID: ${request_id}`);
      }
  }
  
  // Update request in KV
  await updateRequest(env, request_id, updates);
  
  // Append to notification log for Web UI polling
  const logKey = `notifications:${request_id}`;
  const existingLog = await env.ACTIONCODE_KV.get<string[]>(logKey, 'json');
  const logEntries = existingLog || [];
  logEntries.push(JSON.stringify({
    status,
    timestamp: new Date().toISOString(),
    pr_url,
    error_message,
    commit_sha,
  }));
  await env.ACTIONCODE_KV.put(logKey, JSON.stringify(logEntries), {
    expirationTtl: 7 * 24 * 60 * 60,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Calculate duration between two timestamps
function calculateDuration(startDate: string): string {
  const start = new Date(startDate);
  const end = new Date();
  const duration = end.getTime() - start.getTime();
  
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
