// Generate a unique ID
export function generateId(): string {
  return crypto.randomUUID();
}

// Generate a resume token
export function generateResumeToken(): string {
  return crypto.randomUUID();
}

// Hash a string (for rate limiting)
export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify Telegram webhook secret
export function verifyTelegramSecret(secret: string | null, expectedSecret: string): boolean {
  if (!secret) return false;
  return secret === expectedSecret;
}

// Verify GitHub webhook signature
export async function verifyGitHubSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false;
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const payloadData = encoder.encode(payload);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);
  const expectedSignature = `sha256=${Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')}`;
  
  return signature === expectedSignature;
}

// Format duration
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
}

// Parse repository full name
export function parseRepositoryName(fullName: string): { owner: string; repo: string } | null {
  const parts = fullName.split('/');
  if (parts.length !== 2) {
    return null;
  }
  return { owner: parts[0], repo: parts[1] };
}

// Validate GitHub token format
export function isValidGitHubToken(token: string): boolean {
  return /^gh[ps]_[A-Za-z0-9_]{36,}$/.test(token) || /^ghp_[A-Za-z0-9_]{36,}$/.test(token);
}

// Validate repository format
export function isValidRepository(repo: string): boolean {
  return /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo);
}

// Validate branch name
export function isValidBranch(branch: string): boolean {
  return /^[a-zA-Z0-9._\-\/]+$/.test(branch);
}
