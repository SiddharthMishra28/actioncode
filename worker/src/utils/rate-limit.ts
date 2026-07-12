import type { Env, RateLimitData } from '../types';

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 10;
const MAX_REQUESTS_PER_DAY = 50;

// Check rate limit
export async function checkRateLimit(
  env: Env,
  identifier: string
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  const now = Date.now();
  const key = `rate-limit:${identifier}`;
  
  // Get current rate limit data
  const data = await env.ACTIONCODE_KV.get<RateLimitData>(key, 'json');
  
  if (!data || now > new Date(data.resetAt).getTime()) {
    // No data or window expired, allow and create new entry
    const resetAt = new Date(now + RATE_LIMIT_WINDOW).toISOString();
    const newData: RateLimitData = {
      count: 1,
      resetAt,
    };
    
    await env.ACTIONCODE_KV.put(key, JSON.stringify(newData), {
      expirationTtl: Math.ceil(RATE_LIMIT_WINDOW / 1000) + 60, // Add 60s buffer
    });
    
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_HOUR - 1,
      resetAt,
    };
  }
  
  // Check if within limit
  if (data.count >= MAX_REQUESTS_PER_HOUR) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: data.resetAt,
    };
  }
  
  // Increment count
  data.count += 1;
  await env.ACTIONCODE_KV.put(key, JSON.stringify(data), {
    expirationTtl: Math.ceil((new Date(data.resetAt).getTime() - now) / 1000) + 60,
  });
  
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_HOUR - data.count,
    resetAt: data.resetAt,
  };
}

// Get rate limit info
export async function getRateLimitInfo(
  env: Env,
  identifier: string
): Promise<{ count: number; remaining: number; resetAt: string }> {
  const now = Date.now();
  const key = `rate-limit:${identifier}`;
  
  const data = await env.ACTIONCODE_KV.get<RateLimitData>(key, 'json');
  
  if (!data || now > new Date(data.resetAt).getTime()) {
    return {
      count: 0,
      remaining: MAX_REQUESTS_PER_HOUR,
      resetAt: new Date(now + RATE_LIMIT_WINDOW).toISOString(),
    };
  }
  
  return {
    count: data.count,
    remaining: MAX_REQUESTS_PER_HOUR - data.count,
    resetAt: data.resetAt,
  };
}
