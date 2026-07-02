import dotenv from 'dotenv';
import { log, createContextLogger } from './services/logger.js';
import { config } from './services/config.js';
import { webhookServer } from './webhook/server.js';
import { telegramService } from './services/telegram.js';

dotenv.config();

const logger = createContextLogger({ step: 'main' });

async function main(): Promise<void> {
  try {
    logger.info('Starting ActionCode service');
    
    // Load configuration
    config.load();
    logger.info('Configuration loaded');
    
    // Start Telegram bot
    await telegramService.start();
    logger.info('Telegram bot started');
    
    // Start webhook server
    const port = parseInt(process.env.PORT || '3000', 10);
    await webhookServer.start(port);
    logger.info('Webhook server started', { port });
    
    logger.info('ActionCode service started successfully');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully');
      await shutdown();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      await shutdown();
      process.exit(0);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
    });
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      process.exit(1);
    });
    
  } catch (error) {
    logger.error('Failed to start ActionCode service', { error });
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  try {
    await telegramService.stop();
    await webhookServer.stop();
    logger.info('Shutdown complete');
  } catch (error) {
    logger.error('Error during shutdown', { error });
  }
}

main();
