/**
 * Voice Gateway Logger
 */

import pino from 'pino';

export const logger = pino({
  name: 'voice-gateway',
  level: process.env.LOG_LEVEL || 'info',
});
