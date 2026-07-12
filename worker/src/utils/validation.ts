import type { TriggerPayload, ApiResponse } from '../types';

// Validate trigger payload
export function validateTriggerPayload(payload: unknown): payload is TriggerPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  
  const p = payload as Record<string, unknown>;
  
  if (!p.github_token || typeof p.github_token !== 'string') {
    return false;
  }
  
  if (!p.repository || typeof p.repository !== 'string') {
    return false;
  }
  
  if (!p.instruction || typeof p.instruction !== 'string') {
    return false;
  }
  
  // Validate repository format
  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(p.repository as string)) {
    return false;
  }
  
  // Validate branch if provided
  if (p.branch && typeof p.branch === 'string') {
    if (!/^[a-zA-Z0-9._\-\/]+$/.test(p.branch as string)) {
      return false;
    }
  }
  
  return true;
}

// Create API response
export function createApiResponse(
  success: boolean,
  options: {
    error?: string;
    request_id?: string;
    data?: unknown;
    status?: number;
  } = {}
): Response {
  const response: ApiResponse = {
    success,
    error: options.error,
    request_id: options.request_id,
    data: options.data,
  };
  
  return new Response(JSON.stringify(response), {
    status: options.status || (success ? 200 : 400),
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Create CORS response
export function createCorsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret',
    },
  });
}
