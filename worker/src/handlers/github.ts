import type { Env, GitHubCallbackPayload } from '../types';
import { getRequest, updateRequest } from '../services/kv';
import { 
  sendProgressUpdate, 
  sendCompletionMessage, 
  sendFailureMessage,
  sendRateLimitMessage 
} from '../services/telegram-api';
import { generateResumeToken } from '../utils/crypto';
import { verifyGitHubSignature } from '../utils/crypto';

// Handle GitHub Actions callback
export async function handleGitHubCallback(
  request: Request,
  env: Env
): Promise<Response> {
  // Verify webhook signature
  const signature = request.headers.get('X-Hub-Signature-256');
  const body = await request.text();
  
  if (env.WEBHOOK_SECRET) {
    const isValid = await verifyGitHubSignature(body, signature, env.WEBHOOK_SECRET);
    if (!isValid) {
      return new Response('Unauthorized', { status: 401 });
    }
  }
  
  // Parse payload
  let payload: GitHubCallbackPayload;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    return new Response('Invalid JSON', { status: 400 });
  }
  
  const { request_id, status, pr_url, build_success, test_success, 
          modified_files, commit_sha, branch, error_message } = payload;
  
  if (!request_id || !status) {
    return new Response('Missing required fields', { status: 400 });
  }
  
  // Get the request from KV
  const requestData = await getRequest(env, request_id);
  
  if (!requestData) {
    console.error(`Request not found: ${request_id}`);
    return new Response('Request not found', { status: 404 });
  }
  
  // Update request based on status
  const updates: any = {
    status,
  };
  
  if (pr_url) {
    updates.prUrl = pr_url;
  }
  
  if (commit_sha) {
    updates.commitSha = commit_sha;
  }
  
  if (modified_files) {
    updates.modifiedFiles = modified_files.split(',').filter(f => f.trim());
  }
  
  if (error_message) {
    updates.errorMessage = error_message;
  }
  
  if (branch) {
    // Update branch if it changed
  }
  
  // Handle different statuses
  switch (status) {
    case 'running':
    case 'building':
    case 'testing':
    case 'retrying':
    case 'creating-pr':
      await sendProgressUpdate(
        env,
        requestData.userTelegramChatId,
        status,
        `Request ID: ${request_id}`
      );
      break;
    
    case 'completed':
      updates.completedAt = new Date().toISOString();
      await sendCompletionMessage(
        env,
        requestData.userTelegramChatId,
        {
          repository: requestData.repository,
          branch: requestData.branch,
          prUrl: pr_url,
          commitSha: commit_sha,
          filesChanged: modified_files ? modified_files.split(',').length : 0,
          duration: calculateDuration(requestData.createdAt),
        }
      );
      break;
    
    case 'failed':
      updates.completedAt = new Date().toISOString();
      await sendFailureMessage(
        env,
        requestData.userTelegramChatId,
        {
          reason: error_message || 'Workflow failed',
          modifiedFiles: modified_files ? modified_files.split(',') : [],
        }
      );
      break;
    
    case 'rate-limited':
      // Generate resume token
      const resumeToken = generateResumeToken();
      
      // Save resume data to KV
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
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours
      };
      
      await env.ACTIONCODE_KV.put(
        `resume:${resumeToken}`,
        JSON.stringify(resumeData),
        { expirationTtl: 12 * 60 * 60 } // 12 hours
      );
      
      updates.resumeToken = resumeToken;
      updates.completedAt = new Date().toISOString();
      
      await sendRateLimitMessage(
        env,
        requestData.userTelegramChatId,
        resumeToken
      );
      break;
    
    default:
      // For other statuses, just send progress update
      await sendProgressUpdate(
        env,
        requestData.userTelegramChatId,
        status,
        `Request ID: ${request_id}`
      );
  }
  
  // Update request in KV
  await updateRequest(env, request_id, updates);
  
  return new Response('OK', {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
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
