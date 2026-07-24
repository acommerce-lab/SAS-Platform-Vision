import pino from 'pino';
import { config } from '../config/config.js';

export const logger = pino({
  level: config.isDevelopment ? 'debug' : 'info',
  ...(config.isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        // Production: structured JSON
        formatters: {
          level(label) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});
