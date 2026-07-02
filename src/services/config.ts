import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const ConfigSchema = z.object({
  telegram: z.object({
    botToken: z.string(),
    webhookSecret: z.string().optional(),
    allowedUsers: z.array(z.number()),
    behavior: z.object({
      welcomeMessage: z.string(),
      confirmStart: z.string(),
      confirmYes: z.string(),
      confirmNo: z.string(),
      progressAccepted: z.string(),
      progressCheckout: z.string(),
      progressAnalysis: z.string(),
      progressModifying: z.string(),
      progressBuilding: z.string(),
      progressTesting: z.string(),
      progressRetrying: z.string(),
      progressPR: z.string(),
      progressComplete: z.string(),
      errorInvalidRepo: z.string(),
      errorUnauthorized: z.string(),
      errorInvalidCommand: z.string(),
      errorMissingInput: z.string(),
      errorExecutionFailed: z.string(),
    }),
    conversationTimeout: z.number(),
    maxMessageLength: z.number(),
    codeBlockMaxLength: z.number(),
  }),
  models: z.object({
    free: z.array(z.object({
      name: z.string(),
      description: z.string(),
      maxTokens: z.number(),
      temperature: z.number(),
      enabled: z.boolean(),
    })),
    defaults: z.object({
      model: z.string(),
      temperature: z.number(),
      maxTokens: z.number(),
      timeout: z.number(),
    }),
    selection: z.object({
      autoSelect: z.boolean(),
      complexityThresholds: z.object({
        simple: z.number(),
        medium: z.number(),
        complex: z.number(),
      }),
      modelMapping: z.record(z.string()),
    }),
  }),
  limits: z.object({
    perUser: z.object({
      maxConcurrent: z.number(),
      maxDaily: z.number(),
      maxMonthly: z.number(),
    }),
    perRepository: z.object({
      maxConcurrent: z.number(),
      maxDaily: z.number(),
      maxMonthly: z.number(),
    }),
    global: z.object({
      maxConcurrent: z.number(),
      maxDaily: z.number(),
      maxMonthly: z.number(),
    }),
    execution: z.object({
      maxRetries: z.number(),
      retryDelay: z.number(),
      timeout: z.number(),
      maxBuildTime: z.number(),
      maxTestTime: z.number(),
    }),
    files: z.object({
      maxModified: z.number(),
      maxAdded: z.number(),
      maxDeleted: z.number(),
      maxFileSize: z.number(),
    }),
    pullRequest: z.object({
      maxTitleLength: z.number(),
      maxBodyLength: z.number(),
      maxFilesChanged: z.number(),
    }),
    message: z.object({
      maxLength: z.number(),
      codeBlockMaxLength: z.number(),
    }),
    rateLimit: z.object({
      windowMs: z.number(),
      maxRequests: z.number(),
    }),
  }),
  repositories: z.array(z.object({
    name: z.string(),
    fullName: z.string(),
    defaultBranch: z.string(),
    allowedUsers: z.array(z.number()),
    enabledCommands: z.array(z.string()).optional(),
    buildCommand: z.string().optional(),
    testCommand: z.string().optional(),
    lintCommand: z.string().optional(),
    installCommand: z.string().optional(),
    environment: z.record(z.string()).optional(),
  })),
  build: z.object({
    detection: z.object({
      buildSystems: z.array(z.object({
        name: z.string(),
        files: z.array(z.string()),
        buildCommand: z.string(),
        testCommand: z.string(),
        installCommand: z.string(),
      })),
      frameworks: z.array(z.object({
        name: z.string(),
        indicators: z.array(z.string()),
        buildCommand: z.string().optional(),
        startCommand: z.string().optional(),
      })),
    }),
    optimization: z.object({
      enableCache: z.boolean(),
      cacheDirectories: z.array(z.string()),
      parallelExecution: z.boolean(),
      maxParallelJobs: z.number(),
    }),
    artifacts: z.object({
      enableCollection: z.boolean(),
      directories: z.array(z.string()),
      retentionDays: z.number(),
    }),
  }),
  notifications: z.object({
    telegram: z.object({
      enabled: z.boolean(),
      progress: z.object({
        enabled: z.boolean(),
        interval: z.number(),
        includeBuildOutput: z.boolean(),
        includeTestResults: z.boolean(),
      }),
      completion: z.object({
        enabled: z.boolean(),
        includeBuildLogs: z.boolean(),
        includeTestResults: z.boolean(),
        includePRLink: z.boolean(),
        includeMetrics: z.boolean(),
      }),
      failure: z.object({
        enabled: z.boolean(),
        includeErrorDetails: z.boolean(),
        includeBuildLogs: z.boolean(),
        includeSuggestions: z.boolean(),
        retryNotifications: z.boolean(),
      }),
      formatting: z.object({
        useMarkdown: z.boolean(),
        useCodeBlocks: z.boolean(),
        maxCodeBlockLength: z.number(),
        includeTimestamps: z.boolean(),
      }),
    }),
    github: z.object({
      enabled: z.boolean(),
      pullRequest: z.object({
        enabled: z.boolean(),
        assignees: z.array(z.string()),
        reviewers: z.array(z.string()),
        labels: z.array(z.string()),
      }),
      issue: z.object({
        enabled: z.boolean(),
      }),
      commit: z.object({
        enabled: z.boolean(),
        includeCoAuthors: z.boolean(),
      }),
    }),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

class ConfigLoader {
  private static instance: ConfigLoader;
  private config: Config | null = null;
  private configPath: string;

  private constructor() {
    this.configPath = join(process.cwd(), 'config');
  }

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  private loadYamlFile(filename: string): Record<string, unknown> {
    const filePath = join(this.configPath, filename);
    if (!existsSync(filePath)) {
      throw new Error(`Configuration file not found: ${filePath}`);
    }
    const content = readFileSync(filePath, 'utf-8');
    return parse(content);
  }

  private resolveEnvironmentVariables(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const envVar = value.slice(2, -1);
        result[key] = process.env[envVar] || '';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.resolveEnvironmentVariables(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        result[key] = value.map(item => 
          typeof item === 'object' && item !== null 
            ? this.resolveEnvironmentVariables(item as Record<string, unknown>)
            : item
        );
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  public load(): Config {
    if (this.config) {
      return this.config;
    }

    try {
      const telegramConfig = this.loadYamlFile('telegram.yml');
      const modelsConfig = this.loadYamlFile('models.yml');
      const limitsConfig = this.loadYamlFile('limits.yml');
      const repositoriesConfig = this.loadYamlFile('repositories.yml');
      const buildConfig = this.loadYamlFile('build.yml');
      const notificationsConfig = this.loadYamlFile('notifications.yml');

      const rawConfig = {
        telegram: telegramConfig.telegram,
        models: modelsConfig.models,
        limits: limitsConfig.limits,
        repositories: repositoriesConfig.repositories,
        build: buildConfig.build,
        notifications: notificationsConfig.notifications,
      };

      const resolvedConfig = this.resolveEnvironmentVariables(rawConfig);
      this.config = ConfigSchema.parse(resolvedConfig);
      
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error}`);
    }
  }

  public reload(): Config {
    this.config = null;
    return this.load();
  }

  public get<T>(path: string): T {
    const config = this.load();
    const keys = path.split('.');
    let value: unknown = config;
    
    for (const key of keys) {
      if (value === null || value === undefined) {
        throw new Error(`Configuration path not found: ${path}`);
      }
      value = (value as Record<string, unknown>)[key];
    }
    
    return value as T;
  }
}

export const config = ConfigLoader.getInstance();
