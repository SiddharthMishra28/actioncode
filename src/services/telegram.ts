import { Bot, Context, session } from 'grammy';
import { log, createContextLogger } from './logger.js';
import { config } from './config.js';
import type { Command, RequestStatus } from '../types/index.js';

export interface SessionData {
  userId: number;
  chatId: string;
  currentCommand?: Command;
  currentRepo?: string;
  currentBranch?: string;
  currentInstruction?: string;
  pendingRequest?: {
    id: string;
    command: Command;
    repository: string;
    branch: string;
    instruction: string;
  };
}

export type BotContext = Context & {
  session: SessionData;
};

export class TelegramService {
  private bot: Bot<BotContext>;
  private logger;
  private config;

  constructor() {
    this.config = config.load();
    this.bot = new Bot<BotContext>(this.config.telegram.botToken);
    this.logger = createContextLogger({ step: 'telegram-service' });
    
    this.setupMiddleware();
    this.setupCommands();
  }

  private setupMiddleware(): void {
    this.bot.use(
      session({
        initial: (): SessionData => ({
          userId: 0,
          chatId: '',
        }),
      })
    );

    this.bot.use(async (ctx, next) => {
      if (ctx.from) {
        ctx.session.userId = ctx.from.id;
        ctx.session.chatId = ctx.chat?.id.toString() || '';
      }
      await next();
    });
  }

  private setupCommands(): void {
    this.bot.command('start', async (ctx) => {
      if (!this.isAuthorized(ctx.from?.id)) {
        await ctx.reply(this.config.telegram.behavior.errorUnauthorized);
        return;
      }
      await ctx.reply(this.config.telegram.behavior.welcomeMessage, { parse_mode: 'Markdown' });
    });

    this.bot.command('help', async (ctx) => {
      if (!this.isAuthorized(ctx.from?.id)) {
        await ctx.reply(this.config.telegram.behavior.errorUnauthorized);
        return;
      }
      await ctx.reply(this.config.telegram.behavior.welcomeMessage, { parse_mode: 'Markdown' });
    });

    this.bot.command('fix', async (ctx) => await this.handleCommand(ctx, 'fix'));
    this.bot.command('add', async (ctx) => await this.handleCommand(ctx, 'add'));
    this.bot.command('refactor', async (ctx) => await this.handleCommand(ctx, 'refactor'));
    this.bot.command('review', async (ctx) => await this.handleCommand(ctx, 'review'));
    this.bot.command('explain', async (ctx) => await this.handleCommand(ctx, 'explain'));
    this.bot.command('test', async (ctx) => await this.handleCommand(ctx, 'test'));
    this.bot.command('document', async (ctx) => await this.handleCommand(ctx, 'document'));
    this.bot.command('cleanup', async (ctx) => await this.handleCommand(ctx, 'cleanup'));
    this.bot.command('improve', async (ctx) => await this.handleCommand(ctx, 'improve'));
    this.bot.command('run', async (ctx) => await this.handleCommand(ctx, 'run'));

    this.bot.command('cancel', async (ctx) => {
      if (!this.isAuthorized(ctx.from?.id)) {
        await ctx.reply(this.config.telegram.behavior.errorUnauthorized);
        return;
      }
      // Handle cancellation
      await ctx.reply('Request cancelled.');
      this.clearSession(ctx);
    });

    this.bot.command('status', async (ctx) => {
      if (!this.isAuthorized(ctx.from?.id)) {
        await ctx.reply(this.config.telegram.behavior.errorUnauthorized);
        return;
      }
      // Handle status check
      await ctx.reply('No active requests.');
    });

    this.bot.command('logs', async (ctx) => {
      if (!this.isAuthorized(ctx.from?.id)) {
        await ctx.reply(this.config.telegram.behavior.errorUnauthorized);
        return;
      }
      // Handle logs retrieval
      await ctx.reply('No logs available.');
    });

    this.bot.on('message:text', async (ctx) => {
      if (!this.isAuthorized(ctx.from?.id)) {
        await ctx.reply(this.config.telegram.behavior.errorUnauthorized);
        return;
      }
      await this.handleMessage(ctx);
    });
  }

  private isAuthorized(userId?: number): boolean {
    if (!userId) return false;
    return this.config.telegram.allowedUsers.includes(userId);
  }

  private async handleCommand(ctx: Context, command: Command): Promise<void> {
    if (!ctx.from || !this.isAuthorized(ctx.from.id)) {
      await ctx.reply(this.config.telegram.behavior.errorUnauthorized);
      return;
    }

    ctx.session.currentCommand = command;
    ctx.session.currentRepo = undefined;
    ctx.session.currentBranch = undefined;
    ctx.session.currentInstruction = undefined;

    await ctx.reply('Which repository?');
  }

  private async handleMessage(ctx: Context): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;

    const text = ctx.message.text;

    if (!ctx.session.currentCommand) {
      await ctx.reply(this.config.telegram.behavior.errorInvalidCommand);
      return;
    }

    if (!ctx.session.currentRepo) {
      // Validate repository
      const repoConfig = this.config.repositories.find(r => 
        r.name === text || r.fullName === text
      );

      if (!repoConfig) {
        await ctx.reply(this.config.telegram.behavior.errorInvalidRepo);
        return;
      }

      ctx.session.currentRepo = repoConfig.fullName;
      await ctx.reply('Branch?');
      return;
    }

    if (!ctx.session.currentBranch) {
      ctx.session.currentBranch = text || repoConfig.defaultBranch;
      await ctx.reply('Describe the enhancement.');
      return;
    }

    if (!ctx.session.currentInstruction) {
      ctx.session.currentInstruction = text;
      await ctx.reply(
        `Repository: ${ctx.session.currentRepo}\n` +
        `Branch: ${ctx.session.currentBranch}\n` +
        `Command: ${ctx.session.currentCommand}\n` +
        `Instruction: ${ctx.session.currentInstruction}\n\n` +
        `Estimated runtime: 7 minutes\n\n` +
        `Start?`
      );
      return;
    }
  }

  private clearSession(ctx: Context): void {
    ctx.session.currentCommand = undefined;
    ctx.session.currentRepo = undefined;
    ctx.session.currentBranch = undefined;
    ctx.session.currentInstruction = undefined;
    ctx.session.pendingRequest = undefined;
  }

  async sendMessage(chatId: string, message: string, options?: {
    parse_mode?: 'Markdown' | 'HTML';
    reply_to_message_id?: number;
  }): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, message, options);
    } catch (error) {
      this.logger.error('Failed to send Telegram message', { error, chatId });
    }
  }

  async sendProgressUpdate(chatId: string, status: RequestStatus, details?: string): Promise<void> {
    const messages: Record<RequestStatus, string> = {
      pending: '⏳ Request Pending',
      validating: '🔍 Validating Request',
      dispatched: '📤 Request Dispatched',
      running: '🏃 Execution Started',
      building: this.config.telegram.behavior.progressBuilding,
      testing: this.config.telegram.behavior.progressTesting,
      retrying: this.config.telegram.behavior.progressRetrying,
      'creating-pr': this.config.telegram.behavior.progressPR,
      completed: this.config.telegram.behavior.progressComplete,
      failed: this.config.telegram.behavior.errorExecutionFailed,
      cancelled: '❌ Request Cancelled',
    };

    let message = messages[status] || 'Unknown status';
    if (details) {
      message += `\n\n${details}`;
    }

    await this.sendMessage(chatId, message);
  }

  async sendCompletionMessage(chatId: string, result: {
    repository: string;
    branch: string;
    commitSha?: string;
    buildPassed: boolean;
    testResults?: string;
    prUrl?: string;
    duration: string;
    filesChanged: number;
  }): Promise<void> {
    const message = [
      '✅ *Request Complete*',
      '',
      `Repository: \`${result.repository}\``,
      `Branch: \`${result.branch}\``,
      result.commitSha ? `Commit: \`${result.commitSha}\`` : '',
      `Build: ${result.buildPassed ? 'Passed' : 'Failed'}`,
      result.testResults ? `Tests: ${result.testResults}` : '',
      `Files Modified: ${result.filesChanged}`,
      result.prUrl ? `PR: [View Pull Request](${result.prUrl})` : '',
      `Execution Time: ${result.duration}`,
    ].filter(Boolean).join('\n');

    await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  async sendFailureMessage(chatId: string, error: {
    reason: string;
    modifiedFiles?: string[];
    buildLogs?: string;
    workflowUrl?: string;
  }): Promise<void> {
    const message = [
      '❌ *Request Failed*',
      '',
      `Reason: ${error.reason}`,
      '',
      error.modifiedFiles && error.modifiedFiles.length > 0 
        ? `Modified Files:\n${error.modifiedFiles.map(f => `- \`${f}\``).join('\n')}` 
        : '',
      error.buildLogs ? `\nBuild Logs:\n\`\`\`\n${error.buildLogs}\n\`\`\`` : '',
      error.workflowUrl ? `\nWorkflow: [View Logs](${error.workflowUrl})` : '',
    ].filter(Boolean).join('\n');

    await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  async sendCodeSnippet(chatId: string, code: string, language?: string): Promise<void> {
    const maxLength = this.config.telegram.codeBlockMaxLength;
    let truncatedCode = code;
    
    if (code.length > maxLength) {
      truncatedCode = code.substring(0, maxLength - 20) + '\n\n... (truncated)';
    }

    const message = language 
      ? `\`\`\`${language}\n${truncatedCode}\n\`\`\``
      : `\`\`\`\n${truncatedCode}\n\`\`\``;

    await this.sendMessage(chatId, message);
  }

  async start(): Promise<void> {
    this.logger.info('Starting Telegram bot');
    
    if (this.config.telegram.webhookSecret) {
      // Set up webhook
      this.logger.info('Telegram bot configured for webhook mode');
    } else {
      // Use polling
      this.logger.info('Starting Telegram bot in polling mode');
      this.bot.start({
        onStart: (info) => {
          this.logger.info('Telegram bot started', { username: info.username });
        },
      });
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Telegram bot');
    this.bot.stop();
  }

  getBot(): Bot<BotContext> {
    return this.bot;
  }
}

export const telegramService = new TelegramService();
