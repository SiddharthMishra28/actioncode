import type { Env, TriggerPayload, ApiResponse } from '../types';
import { generateId } from '../utils/crypto';
import { validateTriggerPayload, createApiResponse, createCorsResponse } from '../utils/validation';
import { checkRateLimit } from '../utils/rate-limit';
import { createRequest } from '../services/kv';
import { triggerWorkflow, validateGithubToken, validateRepositoryAccess } from '../services/github-api';

// Handle API trigger request
export async function handleApiTrigger(
  request: Request,
  env: Env
): Promise<Response> {
  // Parse request body
  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return createApiResponse(false, {
      error: 'Invalid JSON',
      status: 400,
    });
  }
  
  // Validate payload
  if (!validateTriggerPayload(payload)) {
    return createApiResponse(false, {
      error: 'Invalid payload. Required: github_token, repository, instruction',
      status: 400,
    });
  }
  
  const { github_token, repository, branch = 'main', instruction } = payload as TriggerPayload;
  
  // Validate GitHub token
  const tokenValidation = await validateGithubToken(github_token);
  if (!tokenValidation.valid) {
    return createApiResponse(false, {
      error: `Invalid GitHub token: ${tokenValidation.error}`,
      status: 401,
    });
  }
  
  // Validate repository access
  const repoValidation = await validateRepositoryAccess(github_token, repository);
  if (!repoValidation.valid) {
    return createApiResponse(false, {
      error: `Cannot access repository: ${repoValidation.error}`,
      status: 403,
    });
  }
  
  // Check rate limit (using token hash as identifier)
  const rateLimit = await checkRateLimit(env, tokenValidation.user || 'unknown');
  if (!rateLimit.allowed) {
    return createApiResponse(false, {
      error: `Rate limit exceeded. Try again after ${rateLimit.resetAt}`,
      status: 429,
    });
  }
  
  // Generate request ID
  const requestId = generateId();
  
  // Create request in KV
  const requestData = await createRequest(env, requestId, {
    status: 'pending',
    repository,
    branch,
    instruction,
    userTelegramId: 0, // Not from Telegram
    userTelegramChatId: '', // Not from Telegram
  });
  
  // Trigger GitHub Actions
  const workflowResult = await triggerWorkflow(env, {
    repository,
    branch,
    instruction,
    requestId,
    callbackUrl: env.WORKER_URL,
    userGithubToken: github_token,
  });
  
  if (!workflowResult.success) {
    // Update request status
    await createRequest(env, requestId, {
      ...requestData,
      status: 'failed',
      errorMessage: workflowResult.error,
    });
    
    return createApiResponse(false, {
      error: `Failed to trigger workflow: ${workflowResult.error}`,
      status: 500,
    });
  }
  
  // Update request with workflow run ID
  await createRequest(env, requestId, {
    ...requestData,
    status: 'dispatched',
    workflowRunId: workflowResult.runId,
  });
  
  return createApiResponse(true, {
    request_id: requestId,
    data: {
      workflow_run_id: workflowResult.runId,
      rate_limit: {
        remaining: rateLimit.remaining,
        reset_at: rateLimit.resetAt,
      },
    },
  });
}

// Handle status request
export async function handleStatusRequest(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  const { getRequest } = await import('../services/kv');
  const requestData = await getRequest(env, requestId);
  
  if (!requestData) {
    return createApiResponse(false, {
      error: 'Request not found',
      status: 404,
    });
  }
  
  return createApiResponse(true, {
    data: requestData,
  });
}

// Handle logs request
export async function handleLogsRequest(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  const logs = await env.ACTIONCODE_KV.get(`logs:${requestId}`, 'json');
  
  if (!logs) {
    return createApiResponse(true, {
      data: { lines: [] },
    });
  }
  
  return createApiResponse(true, {
    data: logs,
  });
}

// Handle health check
export async function handleHealthCheck(): Promise<Response> {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
