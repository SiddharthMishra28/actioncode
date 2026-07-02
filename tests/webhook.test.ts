import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { WebhookServer } from '../src/webhook/server.js';

describe('WebhookServer', () => {
  let server: WebhookServer;

  beforeEach(() => {
    server = new WebhookServer();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(server.getApp())
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Request API', () => {
    it('should return 404 for non-existent request', async () => {
      await request(server.getApp())
        .get('/api/requests/non-existent')
        .expect(404);
    });

    it('should list requests', async () => {
      const response = await request(server.getApp())
        .get('/api/requests')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON', async () => {
      await request(server.getApp())
        .post('/webhook/telegram')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });
});
