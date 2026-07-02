import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseRepositoryName, createGitHubService } from '../src/services/github.js';

describe('GitHubService', () => {
  describe('parseRepositoryName', () => {
    it('should parse valid repository name', () => {
      const result = parseRepositoryName('owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse repository name with hyphens', () => {
      const result = parseRepositoryName('my-org/my-repo');
      expect(result).toEqual({ owner: 'my-org', repo: 'my-repo' });
    });

    it('should parse repository name with underscores', () => {
      const result = parseRepositoryName('my_org/my_repo');
      expect(result).toEqual({ owner: 'my_org', repo: 'my_repo' });
    });

    it('should throw error for invalid format', () => {
      expect(() => parseRepositoryName('invalid')).toThrow('Invalid repository name');
    });

    it('should throw error for empty string', () => {
      expect(() => parseRepositoryName('')).toThrow('Invalid repository name');
    });

    it('should throw error for too many parts', () => {
      expect(() => parseRepositoryName('owner/repo/extra')).toThrow('Invalid repository name');
    });
  });

  describe('createGitHubService', () => {
    beforeEach(() => {
      vi.stubEnv('GITHUB_TOKEN', 'test-token');
    });

    it('should create GitHubService with environment token', () => {
      const service = createGitHubService('owner', 'repo');
      expect(service).toBeDefined();
    });

    it('should create GitHubService with provided token', () => {
      const service = createGitHubService('owner', 'repo', 'custom-token');
      expect(service).toBeDefined();
    });

    it('should throw error when no token is available', () => {
      vi.unstubAllEnvs();
      delete process.env.GITHUB_TOKEN;
      
      expect(() => createGitHubService('owner', 'repo')).toThrow('GitHub token is required');
    });
  });
});
