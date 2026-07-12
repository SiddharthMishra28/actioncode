import type { Env } from '../types';

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
  const { owner, repo } = parseRepositoryFullName(params.repository);
  
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/opencode-agent.yml/dispatches`;
  
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
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorData = await response.json() as { message?: string };
      return {
        success: false,
        error: errorData.message || `HTTP ${response.status}`,
      };
    }
    
    // Wait a bit for the run to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the latest workflow run
    const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/opencode-agent.yml/runs?per_page=1`;
    const runsResponse = await fetch(runsUrl, {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    
    if (runsResponse.ok) {
      const runsData = await runsResponse.json() as { workflow_runs: Array<{ id: number }> };
      if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
        return {
          success: true,
          runId: runsData.workflow_runs[0].id,
        };
      }
    }
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get workflow run status
export async function getWorkflowRunStatus(
  env: Env,
  owner: string,
  repo: string,
  runId: number
): Promise<{
  status: string;
  conclusion: string | null;
  htmlUrl: string;
} | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as {
      status: string;
      conclusion: string | null;
      html_url: string;
    };
    
    return {
      status: data.status,
      conclusion: data.conclusion,
      htmlUrl: data.html_url,
    };
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
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as {
      jobs: Array<{
        name: string;
        status: string;
        conclusion: string | null;
        steps: Array<{
          name: string;
          status: string;
          conclusion: string | null;
        }>;
      }>;
    };
    
    // Format logs
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

// Validate GitHub token by checking user info
export async function validateGithubToken(
  token: string
): Promise<{ valid: boolean; user?: string; error?: string }> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    
    if (!response.ok) {
      return {
        valid: false,
        error: `Invalid token (HTTP ${response.status})`,
      };
    }
    
    const data = await response.json() as { login: string };
    return {
      valid: true,
      user: data.login,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
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
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    
    if (!response.ok) {
      return {
        valid: false,
        error: `Cannot access repository (HTTP ${response.status})`,
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
