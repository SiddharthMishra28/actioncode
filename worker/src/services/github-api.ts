import type { Env } from '../types';

const GH_HEADERS = {
  'Accept': 'application/vnd.github.v3+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'ActionCode-Worker/1.0',
};

function authHeaders(token: string): Record<string, string> {
  return { ...GH_HEADERS, 'Authorization': `Bearer ${token}` };
}

// Trigger GitHub Actions workflow
export async function triggerWorkflow(
  env: Env,
  params: {
    repository: string;
    branch: string;
    instruction: string;
    requestId: string;
    callbackUrl?: string;
    userGithubToken?: string;
  }
): Promise<{ success: boolean; runId?: number; error?: string }> {
  // Always dispatch from the actioncode repo (the workflow lives there)
  const { owner: acOwner, repo: acRepo } = parseRepositoryFullName('SiddharthMishra28/actioncode');

  const url = `https://api.github.com/repos/${acOwner}/${acRepo}/actions/workflows/opencode-agent.yml/dispatches`;

  const body = {
    ref: params.branch,
    inputs: {
      repository: params.repository,
      branch: params.branch,
      instruction: params.instruction,
      request_id: params.requestId,
      callback_url: params.callbackUrl || '',
      user_github_token: params.userGithubToken || '',
      telegram_chat_id: '',
      telegram_user: '',
    },
  };

  // Try Worker's token first, fall back to user's token
  const tokens = [env.GITHUB_TOKEN, params.userGithubToken].filter(Boolean) as string[];

  let lastError = '';
  for (const token of tokens) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        // Success — use this token for the follow-up request too
        await new Promise(resolve => setTimeout(resolve, 2000));

        const runsUrl = `https://api.github.com/repos/${acOwner}/${acRepo}/actions/workflows/opencode-agent.yml/runs?per_page=1`;
        const runsResponse = await fetch(runsUrl, {
          headers: authHeaders(token),
        });

        if (runsResponse.ok) {
          const runsData = await runsResponse.json() as { workflow_runs: Array<{ id: number }> };
          if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
            return { success: true, runId: runsData.workflow_runs[0].id };
          }
        }
        return { success: true };
      }

      const errorData = await response.json() as { message?: string };
      lastError = errorData.message || `HTTP ${response.status}`;
      console.warn(`Workflow dispatch failed with token (ending in ${token.slice(-4)}): ${lastError}`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`Workflow dispatch error with token (ending in ${token.slice(-4)}): ${lastError}`);
    }
  }

  return { success: false, error: lastError || 'All tokens failed' };
}

// Get workflow run status
export async function getWorkflowRunStatus(
  env: Env,
  owner: string,
  repo: string,
  runId: number
): Promise<{ status: string; conclusion: string | null; htmlUrl: string } | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
      { headers: authHeaders(env.GITHUB_TOKEN) }
    );

    if (!response.ok) return null;

    const data = await response.json() as {
      status: string;
      conclusion: string | null;
      html_url: string;
    };

    return { status: data.status, conclusion: data.conclusion, htmlUrl: data.html_url };
  } catch (error) {
    console.error('Failed to get workflow run status:', error);
    return null;
  }
}

// Get workflow run logs
export async function getWorkflowRunLogs(
  env: Env,
  owner: string,
  repo: string,
  runId: number
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs`,
      { headers: authHeaders(env.GITHUB_TOKEN) }
    );

    if (!response.ok) return null;

    const data = await response.json() as {
      jobs: Array<{
        name: string;
        status: string;
        conclusion: string | null;
        steps: Array<{ name: string; status: string; conclusion: string | null }>;
      }>;
    };

    const logs: string[] = [];
    for (const job of data.jobs) {
      logs.push(`Job: ${job.name} (${job.status})`);
      for (const step of job.steps) {
        logs.push(`  Step: ${step.name} (${step.conclusion || step.status})`);
      }
    }
    return logs.join('\n');
  } catch (error) {
    console.error('Failed to get workflow run logs:', error);
    return null;
  }
}

// Parse repository full name
function parseRepositoryFullName(fullName: string): { owner: string; repo: string } {
  const parts = fullName.split('/');
  if (parts.length !== 2) {
    throw new Error(`Invalid repository name: ${fullName}`);
  }
  return { owner: parts[0], repo: parts[1] };
}

// Validate GitHub token — tries /user, falls back gracefully if blocked by IP
export async function validateGithubToken(
  token: string
): Promise<{ valid: boolean; user?: string; error?: string }> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: authHeaders(token),
    });

    if (response.ok) {
      const data = await response.json() as { login: string };
      return { valid: true, user: data.login };
    }

    // 403 from Cloudflare Worker IPs is common — don't block, let repo check decide
    if (response.status === 403 || response.status === 401) {
      console.warn(`Token /user returned ${response.status}, proceeding with degraded validation`);
      return { valid: true, user: 'unknown' };
    }

    return { valid: false, error: `Invalid token (HTTP ${response.status})` };
  } catch (error) {
    console.warn('Token validation network error:', error);
    return { valid: true, user: 'unknown' };
  }
}

// Validate repository access
export async function validateRepositoryAccess(
  token: string,
  repository: string
): Promise<{ valid: boolean; error?: string }> {
  const { owner, repo } = parseRepositoryFullName(repository);

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: authHeaders(token),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        valid: false,
        error: `Cannot access repository (HTTP ${response.status}): ${body.slice(0, 200)}`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
