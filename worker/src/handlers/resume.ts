import type { Env } from '../types';
import { createApiResponse } from '../utils/validation';

// Handle resume token save
export async function handleResumeSave(
  request: Request,
  env: Env
): Promise<Response> {
  // Verify webhook secret
  const secret = request.headers.get('X-Webhook-Secret');
  if (secret !== env.WEBHOOK_SECRET) {
    return createApiResponse(false, {
      error: 'Unauthorized',
      status: 401,
    });
  }
  
  let payload: any;
  try {
    payload = await request.json();
  } catch (error) {
    return createApiResponse(false, {
      error: 'Invalid JSON',
      status: 400,
    });
  }
  
  const { token, requestId, originalInstruction, completedSteps, branch, 
          commitSha, modifiedFiles, remainingInstruction } = payload;
  
  if (!token || !requestId) {
    return createApiResponse(false, {
      error: 'Missing required fields: token, requestId',
      status: 400,
    });
  }
  
  const resumeData = {
    token,
    requestId,
    originalInstruction: originalInstruction || '',
    completedSteps: completedSteps || [],
    branch: branch || 'main',
    commitSha: commitSha || '',
    modifiedFiles: modifiedFiles || [],
    remainingInstruction: remainingInstruction || 'Continue from where we left off',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours
  };
  
  await env.ACTIONCODE_KV.put(
    `resume:${token}`,
    JSON.stringify(resumeData),
    { expirationTtl: 12 * 60 * 60 } // 12 hours
  );
  
  return createApiResponse(true, {
    data: { message: 'Resume token saved' },
  });
}

// Handle resume token retrieval
export async function handleResumeGet(
  request: Request,
  env: Env,
  token: string
): Promise<Response> {
  const resumeData = await env.ACTIONCODE_KV.get(`resume:${token}`, 'json');
  
  if (!resumeData) {
    return createApiResponse(false, {
      error: 'Resume token not found or expired',
      status: 404,
    });
  }
  
  const data = resumeData as any;
  
  // Check expiry
  if (new Date(data.expiresAt) < new Date()) {
    await env.ACTIONCODE_KV.delete(`resume:${token}`);
    return createApiResponse(false, {
      error: 'Resume token has expired',
      status: 410,
    });
  }
  
  return createApiResponse(true, {
    data: resumeData,
  });
}
