import { describe, it, expect, beforeEach } from 'vitest';
import { requestService } from '../src/services/request.js';
import type { Command } from '../src/types/index.js';

describe('RequestService', () => {
  beforeEach(() => {
    // Clear all requests before each test
    requestService.listRequests().forEach(r => {
      requestService.deleteRequest(r.id);
    });
  });

  describe('createRequest', () => {
    it('should create a request successfully', () => {
      const request = requestService.createRequest({
        userId: 123456,
        chatId: '789',
        command: 'fix' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Fix the bug',
      });

      expect(request).toBeDefined();
      expect(request.id).toBeTruthy();
      expect(request.userId).toBe(123456);
      expect(request.chatId).toBe('789');
      expect(request.command).toBe('fix');
      expect(request.repository).toBe('test/repo');
      expect(request.branch).toBe('main');
      expect(request.instruction).toBe('Fix the bug');
      expect(request.status).toBe('pending');
    });

    it('should generate unique IDs', () => {
      const request1 = requestService.createRequest({
        userId: 1,
        chatId: '1',
        command: 'fix' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Instruction 1',
      });

      const request2 = requestService.createRequest({
        userId: 2,
        chatId: '2',
        command: 'add' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Instruction 2',
      });

      expect(request1.id).not.toBe(request2.id);
    });
  });

  describe('getRequest', () => {
    it('should get a request by ID', () => {
      const created = requestService.createRequest({
        userId: 1,
        chatId: '1',
        command: 'fix' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Test',
      });

      const retrieved = requestService.getRequest(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent request', () => {
      const retrieved = requestService.getRequest('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('updateRequest', () => {
    it('should update request status', () => {
      const created = requestService.createRequest({
        userId: 1,
        chatId: '1',
        command: 'fix' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Test',
      });

      const updated = requestService.updateRequestStatus(created.id, 'running');
      expect(updated?.status).toBe('running');
    });

    it('should update request fields', () => {
      const created = requestService.createRequest({
        userId: 1,
        chatId: '1',
        command: 'fix' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Test',
      });

      const updated = requestService.updateRequest(created.id, {
        workflowRunId: 12345,
        result: { success: true },
      });

      expect(updated?.workflowRunId).toBe(12345);
      expect(updated?.result).toEqual({ success: true });
    });

    it('should return undefined for non-existent request', () => {
      const updated = requestService.updateRequest('non-existent', { status: 'running' });
      expect(updated).toBeUndefined();
    });
  });

  describe('listRequests', () => {
    it('should list all requests', () => {
      requestService.createRequest({
        userId: 1,
        chatId: '1',
        command: 'fix' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Test 1',
      });

      requestService.createRequest({
        userId: 2,
        chatId: '2',
        command: 'add' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Test 2',
      });

      const requests = requestService.listRequests();
      expect(requests.length).toBe(2);
    });

    it('should filter by userId', () => {
      requestService.createRequest({
        userId: 1,
        chatId: '1',
        command: 'fix' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Test 1',
      });

      requestService.createRequest({
        userId: 2,
        chatId: '2',
        command: 'add' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Test 2',
      });

      const requests = requestService.listRequests({ userId: 1 });
      expect(requests.length).toBe(1);
      expect(requests[0].userId).toBe(1);
    });

    it('should filter by status', () => {
      const request1 = requestService.createRequest({
        userId: 1,
        chatId: '1',
        command: 'fix' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Test 1',
      });

      requestService.createRequest({
        userId: 2,
        chatId: '2',
        command: 'add' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Test 2',
      });

      requestService.updateRequestStatus(request1.id, 'completed');

      const completedRequests = requestService.listRequests({ status: 'completed' });
      expect(completedRequests.length).toBe(1);
      expect(completedRequests[0].status).toBe('completed');
    });

    it('should limit results', () => {
      for (let i = 0; i < 5; i++) {
        requestService.createRequest({
          userId: i,
          chatId: String(i),
          command: 'fix' as Command,
          repository: 'test/repo',
          branch: 'main',
          instruction: `Test ${i}`,
        });
      }

      const requests = requestService.listRequests({ limit: 3 });
      expect(requests.length).toBe(3);
    });
  });

  describe('deleteRequest', () => {
    it('should delete a request', () => {
      const created = requestService.createRequest({
        userId: 1,
        chatId: '1',
        command: 'fix' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Test',
      });

      const deleted = requestService.deleteRequest(created.id);
      expect(deleted).toBe(true);

      const retrieved = requestService.getRequest(created.id);
      expect(retrieved).toBeUndefined();
    });

    it('should return false for non-existent request', () => {
      const deleted = requestService.deleteRequest('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('checkLimits', () => {
    it('should allow request when within limits', async () => {
      const result = await requestService.checkLimits(123, 'test/repo');
      expect(result.allowed).toBe(true);
    });

    it('should deny request when user has too many active requests', async () => {
      // Create multiple active requests
      for (let i = 0; i < 3; i++) {
        const request = requestService.createRequest({
          userId: 123,
          chatId: '123',
          command: 'fix' as Command,
          repository: 'test/repo',
          branch: 'main',
          instruction: `Test ${i}`,
        });
        requestService.updateRequestStatus(request.id, 'running');
      }

      const result = await requestService.checkLimits(123, 'test/repo');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('active requests');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(requestService.formatDuration(5000)).toBe('5s');
    });

    it('should format minutes and seconds', () => {
      expect(requestService.formatDuration(65000)).toBe('1m 5s');
    });

    it('should format minutes only', () => {
      expect(requestService.formatDuration(120000)).toBe('2m 0s');
    });
  });

  describe('formatRequestSummary', () => {
    it('should format request summary', () => {
      const request = requestService.createRequest({
        userId: 1,
        chatId: '1',
        command: 'fix' as Command,
        repository: 'test/repo',
        branch: 'main',
        instruction: 'Test',
      });

      const summary = requestService.formatRequestSummary(request);
      expect(summary).toContain('Request ID:');
      expect(summary).toContain('Command: fix');
      expect(summary).toContain('Repository: `test/repo`');
      expect(summary).toContain('Branch: `main`');
      expect(summary).toContain('Status: pending');
    });
  });
});
