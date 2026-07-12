import type { Env, RequestData } from '../types';

const REQUEST_PREFIX = 'request:';
const REQUEST_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

// Create a new request
export async function createRequest(
  env: Env,
  requestId: string,
  data: Omit<RequestData, 'id' | 'createdAt' | 'updatedAt'>
): Promise<RequestData> {
  const request: RequestData = {
    ...data,
    id: requestId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await env.ACTIONCODE_KV.put(
    `${REQUEST_PREFIX}${requestId}`,
    JSON.stringify(request),
    { expirationTtl: REQUEST_TTL }
  );
  
  return request;
}

// Get a request by ID
export async function getRequest(
  env: Env,
  requestId: string
): Promise<RequestData | null> {
  const data = await env.ACTIONCODE_KV.get<RequestData>(
    `${REQUEST_PREFIX}${requestId}`,
    'json'
  );
  
  return data;
}

// Update a request
export async function updateRequest(
  env: Env,
  requestId: string,
  updates: Partial<RequestData>
): Promise<RequestData | null> {
  const existing = await getRequest(env, requestId);
  
  if (!existing) {
    return null;
  }
  
  const updated: RequestData = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await env.ACTIONCODE_KV.put(
    `${REQUEST_PREFIX}${requestId}`,
    JSON.stringify(updated),
    { expirationTtl: REQUEST_TTL }
  );
  
  return updated;
}

// Delete a request
export async function deleteRequest(
  env: Env,
  requestId: string
): Promise<boolean> {
  await env.ACTIONCODE_KV.delete(`${REQUEST_PREFIX}${requestId}`);
  return true;
}

// List requests by status
export async function listRequestsByStatus(
  env: Env,
  status: string
): Promise<RequestData[]> {
  const list = await env.ACTIONCODE_KV.list({ prefix: REQUEST_PREFIX });
  const requests: RequestData[] = [];
  
  for (const key of list.keys) {
    const data = await env.ACTIONCODE_KV.get<RequestData>(key.name, 'json');
    if (data && data.status === status) {
      requests.push(data);
    }
  }
  
  return requests;
}

// List all requests
export async function listRequests(
  env: Env,
  limit: number = 100
): Promise<RequestData[]> {
  const list = await env.ACTIONCODE_KV.list({ prefix: REQUEST_PREFIX, limit });
  const requests: RequestData[] = [];
  
  for (const key of list.keys) {
    const data = await env.ACTIONCODE_KV.get<RequestData>(key.name, 'json');
    if (data) {
      requests.push(data);
    }
  }
  
  // Sort by creation date (newest first)
  requests.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  return requests;
}
