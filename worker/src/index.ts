import type { Env } from './types';
import { handleTelegramUpdate } from './handlers/telegram';
import { handleGitHubCallback } from './handlers/github';
import {
  handleApiTrigger,
  handleStatusRequest,
  handleLogsRequest,
  handleHealthCheck,
  handleNotificationsRequest,
  handleTasksListRequest,
  handleSafetyCheck,
} from './handlers/api';
import { handleResumeSave, handleResumeGet } from './handlers/resume';
import { handleEventsStream, handleEventsJson, handleEventPost } from './handlers/events';
import { handleFilesList, handleFileContent } from './handlers/files';
import { createCorsResponse, createApiResponse } from './utils/validation';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return createCorsResponse();
    }

    try {
      // Route requests
      switch (true) {
        // Health check
        case path === '/health' && method === 'GET':
          return handleHealthCheck();

        // Telegram webhook
        case path === '/webhook/telegram' && method === 'POST':
          return handleTelegramUpdate(request, env);

        // GitHub callback
        case path === '/webhook/github' && method === 'POST':
          return handleGitHubCallback(request, env);

        // API trigger
        case path === '/api/trigger' && method === 'POST':
          return handleApiTrigger(request, env);

        // API status
        case path.startsWith('/api/status/') && method === 'GET': {
          const statusId = path.split('/api/status/')[1];
          return handleStatusRequest(request, env, statusId);
        }

        // API logs
        case path.startsWith('/api/logs/') && method === 'GET': {
          const logsId = path.split('/api/logs/')[1];
          return handleLogsRequest(request, env, logsId);
        }

        // Events JSON (for polling)
        case path.startsWith('/api/events/') && path.endsWith('/json') && method === 'GET': {
          const eventId = path.split('/api/events/')[1].replace('/json', '');
          return handleEventsJson(env, eventId);
        }

        // SSE events stream
        case path.startsWith('/api/events/') && method === 'GET': {
          const eventId = path.split('/api/events/')[1];
          return handleEventsStream(request, env, eventId);
        }

        // Post event
        case path === '/api/events' && method === 'POST':
          return handleEventPost(request, env);

        // API notifications
        case path.startsWith('/api/notifications/') && method === 'GET': {
          const notifId = path.split('/api/notifications/')[1];
          return handleNotificationsRequest(env, notifId);
        }

        // API tasks list
        case path === '/api/tasks' && method === 'GET':
          return handleTasksListRequest(request, env);

        // Safety check
        case path === '/api/safety-check' && method === 'POST':
          return handleSafetyCheck(request, env);

        // File tree
        case path.startsWith('/api/files/') && method === 'GET' && !path.includes('/content'): {
          const fileId = path.split('/api/files/')[1];
          return handleFilesList(env, fileId);
        }

        // File content
        case path.includes('/api/files/') && path.endsWith('/content') && method === 'GET': {
          // /api/files/:requestId/content?path=...
          const parts = path.split('/api/files/');
          const requestId = parts[1]?.split('/')[0];
          const filePath = url.searchParams.get('path') || '';
          if (requestId && filePath) {
            return handleFileContent(env, requestId, filePath);
          }
          return createApiResponse(false, { error: 'Missing requestId or path', status: 400 });
        }

        // Resume save
        case path === '/api/resume' && method === 'POST':
          return handleResumeSave(request, env);

        // Resume get
        case path.startsWith('/api/resume/') && method === 'GET': {
          const resumeToken = path.split('/api/resume/')[1];
          return handleResumeGet(request, env, resumeToken);
        }

        // 404 for unknown routes
        default:
          return createApiResponse(false, {
            error: `Not found: ${method} ${path}`,
            status: 404,
          });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return createApiResponse(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500,
      });
    }
  },
};
