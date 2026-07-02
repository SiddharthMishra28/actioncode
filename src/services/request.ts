import { v4 as uuidv4 } from 'uuid';
import { log, createContextLogger } from './logger.js';
import { config } from './config.js';
import type { Request, RequestStatus, Command, Priority, ExecutionMode } from '../types/index.js';

export class RequestService {
  private requests: Map<string, Request> = new Map();
  private logger;

  constructor() {
    this.logger = createContextLogger({ step: 'request-service' });
  }

  createRequest(params: {
    userId: number;
    chatId: string;
    command: Command;
    repository: string;
    branch: string;
    instruction: string;
    priority?: Priority;
    model?: string;
    executionMode?: ExecutionMode;
  }): Request {
    const configData = config.load();
    
    const request: Request = {
      id: uuidv4(),
      userId: params.userId,
      chatId: params.chatId,
      command: params.command,
      repository: params.repository,
      branch: params.branch || 'main',
      instruction: params.instruction,
      status: 'pending',
      priority: params.priority || 'medium',
      model: params.model || configData.models.defaults.model,
      executionMode: params.executionMode || 'full',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.requests.set(request.id, request);
    
    this.logger.info('Request created', { 
      requestId: request.id,
      command: request.command,
      repository: request.repository,
    });

    return request;
  }

  getRequest(id: string): Request | undefined {
    return this.requests.get(id);
  }

  updateRequest(id: string, updates: Partial<Request>): Request | undefined {
    const request = this.requests.get(id);
    if (!request) {
      return undefined;
    }

    const updatedRequest = {
      ...request,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.requests.set(id, updatedRequest);
    
    this.logger.info('Request updated', { 
      requestId: id,
      status: updatedRequest.status,
    });

    return updatedRequest;
  }

  updateRequestStatus(id: string, status: RequestStatus): Request | undefined {
    return this.updateRequest(id, { status });
  }

  deleteRequest(id: string): boolean {
    return this.requests.delete(id);
  }

  listRequests(filters?: {
    userId?: number;
    repository?: string;
    status?: RequestStatus;
    limit?: number;
  }): Request[] {
    let requests = Array.from(this.requests.values());

    if (filters?.userId) {
      requests = requests.filter(r => r.userId === filters.userId);
    }

    if (filters?.repository) {
      requests = requests.filter(r => r.repository === filters.repository);
    }

    if (filters?.status) {
      requests = requests.filter(r => r.status === filters.status);
    }

    // Sort by creation date (newest first)
    requests.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (filters?.limit) {
      requests = requests.slice(0, filters.limit);
    }

    return requests;
  }

  getActiveRequests(userId: number): Request[] {
    return this.listRequests({
      userId,
      status: 'running',
    });
  }

  getRequestsByRepository(repository: string): Request[] {
    return this.listRequests({ repository });
  }

  getRequestStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    const requests = Array.from(this.requests.values());
    
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      running: requests.filter(r => ['running', 'building', 'testing', 'retrying'].includes(r.status)).length,
      completed: requests.filter(r => r.status === 'completed').length,
      failed: requests.filter(r => r.status === 'failed').length,
    };
  }

  async checkLimits(userId: number, repository: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const configData = config.load();
    const limits = configData.limits;

    // Check user limits
    const userActiveRequests = this.getActiveRequests(userId);
    if (userActiveRequests.length >= limits.perUser.maxConcurrent) {
      return {
        allowed: false,
        reason: `You have ${userActiveRequests.length} active requests. Maximum is ${limits.perUser.maxConcurrent}.`,
      };
    }

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const userDailyRequests = this.listRequests({
      userId,
      limit: limits.perUser.maxDaily,
    }).filter(r => r.createdAt.startsWith(today));
    
    if (userDailyRequests.length >= limits.perUser.maxDaily) {
      return {
        allowed: false,
        reason: `You have reached your daily limit of ${limits.perUser.maxDaily} requests.`,
      };
    }

    // Check repository limits
    const repoActiveRequests = this.getRequestsByRepository(repository)
      .filter(r => ['running', 'building', 'testing', 'retrying'].includes(r.status));
    
    if (repoActiveRequests.length >= limits.perRepository.maxConcurrent) {
      return {
        allowed: false,
        reason: `Repository has ${repoActiveRequests.length} active requests. Maximum is ${limits.perRepository.maxConcurrent}.`,
      };
    }

    // Check global limits
    const stats = this.getRequestStats();
    if (stats.running >= limits.global.maxConcurrent) {
      return {
        allowed: false,
        reason: `System has ${stats.running} active requests. Maximum is ${limits.global.maxConcurrent}. Please try again later.`,
      };
    }

    return { allowed: true };
  }

  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    }
    
    return `${minutes}m ${remainingSeconds}s`;
  }

  formatRequestSummary(request: Request): string {
    return [
      `Request ID: \`${request.id}\``,
      `Command: ${request.command}`,
      `Repository: \`${request.repository}\``,
      `Branch: \`${request.branch}\``,
      `Status: ${request.status}`,
      `Created: ${new Date(request.createdAt).toLocaleString()}`,
    ].join('\n');
  }
}

export const requestService = new RequestService();
