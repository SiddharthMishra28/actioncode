import { describe, it, expect, beforeEach } from 'vitest';
import { config } from '../src/services/config.js';

describe('Config', () => {
  beforeEach(() => {
    // Reset config before each test
    config.reload();
  });

  it('should load configuration successfully', () => {
    const cfg = config.load();
    expect(cfg).toBeDefined();
    expect(cfg.telegram).toBeDefined();
    expect(cfg.models).toBeDefined();
    expect(cfg.limits).toBeDefined();
    expect(cfg.repositories).toBeDefined();
  });

  it('should have valid telegram configuration', () => {
    const cfg = config.load();
    expect(cfg.telegram.allowedUsers).toBeInstanceOf(Array);
    expect(cfg.telegram.behavior).toBeDefined();
    expect(cfg.telegram.maxMessageLength).toBeGreaterThan(0);
  });

  it('should have valid models configuration', () => {
    const cfg = config.load();
    expect(cfg.models.free).toBeInstanceOf(Array);
    expect(cfg.models.defaults.model).toBeTruthy();
    expect(cfg.models.defaults.temperature).toBeGreaterThan(0);
    expect(cfg.models.defaults.temperature).toBeLessThanOrEqual(1);
  });

  it('should have valid limits configuration', () => {
    const cfg = config.load();
    expect(cfg.limits.perUser.maxConcurrent).toBeGreaterThan(0);
    expect(cfg.limits.execution.maxRetries).toBeGreaterThan(0);
    expect(cfg.limits.execution.timeout).toBeGreaterThan(0);
  });

  it('should have valid repositories configuration', () => {
    const cfg = config.load();
    expect(cfg.repositories).toBeInstanceOf(Array);
    expect(cfg.repositories.length).toBeGreaterThan(0);
    
    const repo = cfg.repositories[0];
    expect(repo.name).toBeTruthy();
    expect(repo.fullName).toBeTruthy();
    expect(repo.defaultBranch).toBeTruthy();
    expect(repo.allowedUsers).toBeInstanceOf(Array);
  });

  it('should get config value by path', () => {
    const model = config.get<string>('models.defaults.model');
    expect(model).toBeTruthy();
    
    const maxRetries = config.get<number>('limits.execution.maxRetries');
    expect(maxRetries).toBeGreaterThan(0);
  });

  it('should throw error for invalid path', () => {
    expect(() => config.get('invalid.path')).toThrow();
  });
});
