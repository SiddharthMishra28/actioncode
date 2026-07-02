import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { log, createContextLogger } from '../services/logger.js';
import { config } from '../services/config.js';
import { requestService } from '../services/request.js';
import { telegramService } from '../services/telegram.js';
import { createGitHubService, parseRepositoryName } from '../services/github.js';
import type { WorkflowInput, RequestStatus } from '../types/index.js';

export class WebhookServer {
  private app: express.Application;
  private logger;
  private config;

  constructor() {
    this.app = express();
    this.logger = createContextLogger({ step: 'webhook-server' });
    this.config = config.load();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    
    // CORS
    this.app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Hub-Signature-256');
      
      if (_req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Telegram webhook
    this.app.post('/webhook/telegram', this.handleTelegramWebhook.bind(this));

    // GitHub webhook
    this.app.post('/webhook/github', this.handleGitHubWebhook.bind(this));

    // Request status
    this.app.get('/api/requests/:id', this.handleGetRequest.bind(this));

    // Request list
    this.app.get('/api/requests', this.handleListRequests.bind(this));

    // Cancel request
    this.app.post('/api/requests/:id/cancel', this.handleCancelRequest.bind(this));
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      this.logger.error('Unhandled error', { error: err });
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private async handleTelegramWebhook(req: Request, res: Response): Promise<void> {
    try {
      const update = req.body;
      
      // Process the update using grammY
      await telegramService.getBot().handleUpdate(update);
      
      res.sendStatus(200);
    } catch (error) {
      this.logger.error('Failed to handle Telegram webhook', { error });
      res.sendStatus(500);
    }
  }

  private async handleGitHubWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const event = req.headers['x-github-event'] as string;
      const payload = req.body;

      // Verify signature
      if (this.config.telegram.webhookSecret) {
        const expectedSignature = `sha256=${crypto
          .createHmac('sha256', this.config.telegram.webhookSecret)
          .update(JSON.stringify(payload))
          .digest('hex')}`;

        if (signature !== expectedSignature) {
          this.logger.warn('Invalid webhook signature');
          res.sendStatus(401);
          return;
        }
      }

      // Handle workflow run events
      if (event === 'workflow_run') {
        await this.handleWorkflowRunEvent(payload);
      }

      res.sendStatus(200);
    } catch (error) {
      this.logger.error('Failed to handle GitHub webhook', { error });
      res.sendStatus(500);
    }
  }

  private async handleWorkflowRunEvent(payload: {
    action: string;
    workflow_run: {
      id: number;
      status: string;
      conclusion: string | null;
      name: string;
      html_url: string;
    };
    repository: {
      full_name: string;
    };
  }): Promise<void> {
    const { action, workflow_run, repository } = payload;
    
    this.logger.info('Workflow run event received', {
      action,
      runId: workflow_run.id,
      status: workflow_run.status,
      conclusion: workflow_run.conclusion,
      repository: repository.full_name,
    });

    // Find the request associated with this workflow run
    const requests = requestService.listRequests({
      repository: repository.full_name,
    });

    const request = requests.find(r => r.workflowRunId === workflow_run.id);
    if (!request) {
      this.logger.warn('No request found for workflow run', { runId: workflow_run.id });
      return;
    }

    // Update request status based on workflow run status
    let newStatus: RequestStatus;
    switch (action) {
      case 'requested':
        newStatus = 'running';
        break;
      case 'in_progress':
        newStatus = 'running';
        break;
      case 'completed':
        newStatus = workflow_run.conclusion === 'success' ? 'completed' : 'failed';
        break;
      case 'cancelled':
        newStatus = 'cancelled';
        break;
      default:
        return;
    }

    requestService.updateRequestStatus(request.id, newStatus);

    // Send Telegram notification
    await telegramService.sendProgressUpdate(request.chatId, newStatus, 
      `Workflow run: ${workflow_run.html_url}`
    );

    // If completed, send completion message
    if (newStatus === 'completed') {
      await telegramService.sendCompletionMessage(request.chatId, {
        repository: request.repository,
        branch: request.branch,
        buildPassed: true,
        prUrl: request.result?.pullRequest?.url,
        duration: requestService.formatDuration(
          Date.now() - new Date(request.createdAt).getTime()
        ),
        filesChanged: request.result?.modifiedFiles?.length || 0,
      });
    }

    // If failed, send failure message
    if (newStatus === 'failed') {
      await telegramService.sendFailureMessage(request.chatId, {
        reason: 'Workflow run failed',
        workflowUrl: workflow_run.html_url,
      });
    }
  }

  private async handleGetRequest(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const request = requestService.getRequest(id);
    
    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    res.json(request);
  }

  private async handleListRequests(_req: Request, res: Response): Promise<void> {
    const requests = requestService.listRequests();
    res.json(requests);
  }

  private async handleCancelRequest(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const request = requestService.getRequest(id);
    
    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (request.workflowRunId) {
      const { owner, repo } = parseRepositoryName(request.repository);
      const githubService = createGitHubService(owner, repo);
      await githubService.cancelWorkflowRun(request.workflowRunId);
    }

    requestService.updateRequestStatus(request.id, 'cancelled');
    
    await telegramService.sendMessage(request.chatId, 'Request cancelled.');
    
    res.json({ success: true });
  }

  async start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        this.logger.info('Webhook server started', { port });
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping webhook server');
    // Express doesn't have a built-in stop method
    // In production, you would use a process manager
  }

  getApp(): express.Application {
    return this.app;
  }
}

export const webhookServer = new WebhookServer();
