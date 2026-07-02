import { Octokit } from '@octokit/rest';
import { log, createContextLogger } from './logger.js';
import type { WorkflowInput, WorkflowRun, PRResult } from '../types/index.js';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private logger;

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
    this.logger = createContextLogger({ 
      step: 'github-service',
      repository: `${config.owner}/${config.repo}`,
    });
  }

  async triggerWorkflow(inputs: WorkflowInput): Promise<number> {
    this.logger.info('Triggering workflow dispatch', { 
      request_id: inputs.request_id,
      repository: inputs.repository,
      branch: inputs.branch,
    });

    try {
      const response = await this.octokit.rest.actions.createWorkflowDispatch({
        owner: this.owner,
        repo: this.repo,
        workflow_id: 'opencode-agent.yml',
        ref: inputs.branch,
        inputs: {
          repository: inputs.repository,
          branch: inputs.branch,
          instruction: inputs.instruction,
          telegram_chat_id: inputs.telegram_chat_id,
          telegram_user: inputs.telegram_user,
          request_id: inputs.request_id,
          priority: inputs.priority,
          model: inputs.model,
          execution_mode: inputs.execution_mode,
        },
      });

      this.logger.info('Workflow dispatch triggered successfully', {
        request_id: inputs.request_id,
        status: response.status,
      });

      // Wait for the workflow run to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get the latest workflow run
      const runs = await this.getWorkflowRuns(1);
      if (runs.length > 0) {
        return runs[0].id;
      }
      
      throw new Error('No workflow run found after dispatch');
    } catch (error) {
      this.logger.error('Failed to trigger workflow', { error });
      throw error;
    }
  }

  async getWorkflowRuns(limit: number = 10): Promise<WorkflowRun[]> {
    try {
      const response = await this.octokit.rest.actions.listWorkflowRuns({
        owner: this.owner,
        repo: this.repo,
        workflow_id: 'opencode-agent.yml',
        per_page: limit,
      });

      return response.data.workflow_runs.map(run => ({
        id: run.id,
        status: run.status || 'unknown',
        conclusion: run.conclusion || null,
        created_at: run.created_at,
        updated_at: run.updated_at,
        run_started_at: run.run_started_at || null,
        html_url: run.html_url,
        jobs_url: run.html_url + '/jobs',
      }));
    } catch (error) {
      this.logger.error('Failed to get workflow runs', { error });
      throw error;
    }
  }

  async getWorkflowRun(runId: number): Promise<WorkflowRun | null> {
    try {
      const response = await this.octokit.rest.actions.getWorkflowRun({
        owner: this.owner,
        repo: this.repo,
        run_id: runId,
      });

      const run = response.data;
      return {
        id: run.id,
        status: run.status || 'unknown',
        conclusion: run.conclusion || null,
        created_at: run.created_at,
        updated_at: run.updated_at,
        run_started_at: run.run_started_at || null,
        html_url: run.html_url,
        jobs_url: run.html_url + '/jobs',
      };
    } catch (error) {
      this.logger.error('Failed to get workflow run', { error, runId });
      return null;
    }
  }

  async getWorkflowRunJobs(runId: number): Promise<Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    started_at: string;
    completed_at: string | null;
    steps: Array<{
      name: string;
      status: string;
      conclusion: string | null;
    }>;
  }>> {
    try {
      const response = await this.octokit.rest.actions.listJobsForWorkflowRun({
        owner: this.owner,
        repo: this.repo,
        run_id: runId,
      });

      return response.data.jobs.map(job => ({
        id: job.id,
        name: job.name,
        status: job.status || 'unknown',
        conclusion: job.conclusion || null,
        started_at: job.started_at || '',
        completed_at: job.completed_at || null,
        steps: (job.steps || []).map(step => ({
          name: step.name || '',
          status: step.status || 'unknown',
          conclusion: step.conclusion || null,
        })),
      }));
    } catch (error) {
      this.logger.error('Failed to get workflow run jobs', { error, runId });
      return [];
    }
  }

  async getWorkflowRunLogs(runId: number): Promise<string> {
    try {
      const response = await this.octokit.rest.actions.downloadWorkflowRunLogs({
        owner: this.owner,
        repo: this.repo,
        run_id: runId,
      });

      // Note: This returns a URL to download the logs
      // In production, you would download and extract the logs
      return `Logs available at: ${response.url}`;
    } catch (error) {
      this.logger.error('Failed to get workflow run logs', { error, runId });
      return 'Failed to retrieve logs';
    }
  }

  async cancelWorkflowRun(runId: number): Promise<boolean> {
    try {
      await this.octokit.rest.actions.cancelWorkflowRun({
        owner: this.owner,
        repo: this.repo,
        run_id: runId,
      });

      this.logger.info('Workflow run cancelled', { runId });
      return true;
    } catch (error) {
      this.logger.error('Failed to cancel workflow run', { error, runId });
      return false;
    }
  }

  async createPullRequest(params: {
    title: string;
    body: string;
    head: string;
    base: string;
    labels?: string[];
    assignees?: string[];
  }): Promise<PRResult> {
    this.logger.info('Creating pull request', { 
      title: params.title,
      head: params.head,
      base: params.base,
    });

    try {
      const response = await this.octokit.rest.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
      });

      const pr = response.data;

      // Add labels if provided
      if (params.labels && params.labels.length > 0) {
        await this.octokit.rest.issues.addLabels({
          owner: this.owner,
          repo: this.repo,
          issue_number: pr.number,
          labels: params.labels,
        });
      }

      // Add assignees if provided
      if (params.assignees && params.assignees.length > 0) {
        await this.octokit.rest.issues.addAssignees({
          owner: this.owner,
          repo: this.repo,
          issue_number: pr.number,
          assignees: params.assignees,
        });
      }

      this.logger.info('Pull request created successfully', {
        number: pr.number,
        url: pr.html_url,
      });

      return {
        number: pr.number,
        url: pr.html_url,
        title: pr.title,
        body: pr.body || '',
        filesChanged: 0, // Will be updated later
        additions: 0,
        deletions: 0,
      };
    } catch (error) {
      this.logger.error('Failed to create pull request', { error });
      throw error;
    }
  }

  async getPullRequestFiles(prNumber: number): Promise<Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }>> {
    try {
      const response = await this.octokit.rest.pulls.listFiles({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      return response.data.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
      }));
    } catch (error) {
      this.logger.error('Failed to get pull request files', { error, prNumber });
      return [];
    }
  }

  async getRepositoryInfo(): Promise<{
    name: string;
    fullName: string;
    defaultBranch: string;
    description: string | null;
    language: string | null;
  }> {
    try {
      const response = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      });

      const repo = response.data;
      return {
        name: repo.name,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch,
        description: repo.description,
        language: repo.language,
      };
    } catch (error) {
      this.logger.error('Failed to get repository info', { error });
      throw error;
    }
  }

  async getBranches(limit: number = 30): Promise<Array<{
    name: string;
    commitSha: string;
    isDefault: boolean;
  }>> {
    try {
      const response = await this.octokit.rest.repos.listBranches({
        owner: this.owner,
        repo: this.repo,
        per_page: limit,
      });

      const repoInfo = await this.getRepositoryInfo();
      
      return response.data.map(branch => ({
        name: branch.name,
        commitSha: branch.commit.sha,
        isDefault: branch.name === repoInfo.defaultBranch,
      }));
    } catch (error) {
      this.logger.error('Failed to get branches', { error });
      throw error;
    }
  }

  async checkBranchExists(branchName: string): Promise<boolean> {
    try {
      await this.octokit.rest.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
        branch: branchName,
      });
      return true;
    } catch {
      return false;
    }
  }
}

// Factory function to create GitHubService instances
export function createGitHubService(owner: string, repo: string, token?: string): GitHubService {
  const githubToken = token || process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error('GitHub token is required');
  }

  return new GitHubService({
    token: githubToken,
    owner,
    repo,
  });
}

// Parse repository full name
export function parseRepositoryName(fullName: string): { owner: string; repo: string } {
  const parts = fullName.split('/');
  if (parts.length !== 2) {
    throw new Error(`Invalid repository name: ${fullName}. Expected format: owner/repo`);
  }
  return { owner: parts[0], repo: parts[1] };
}
