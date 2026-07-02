import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' 
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    pid: process.pid,
    hostname: process.hostname,
  },
});

export interface LogContext {
  requestId?: string;
  userId?: number;
  chatId?: string;
  repository?: string;
  branch?: string;
  command?: string;
  step?: string;
  duration?: number;
  error?: Error | string;
  [key: string]: unknown;
}

export const createContextLogger = (context: LogContext) => {
  return logger.child(context);
};

export const log = {
  info: (message: string, context?: LogContext) => {
    logger.info(context || {}, message);
  },
  warn: (message: string, context?: LogContext) => {
    logger.warn(context || {}, message);
  },
  error: (message: string, context?: LogContext) => {
    logger.error(context || {}, message);
  },
  debug: (message: string, context?: LogContext) => {
    logger.debug(context || {}, message);
  },
  trace: (message: string, context?: LogContext) => {
    logger.trace(context || {}, message);
  },
};

export default logger;
