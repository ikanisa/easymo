import { structuredLogger, createWorkflowLogger, withLogging, LogContext } from './utils/logging';

describe('Logging Utilities', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('structuredLogger', () => {
    it('should log info messages to stdout', () => {
      structuredLogger.info({
        event: 'test_event',
        message: 'Test message',
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      
      expect(loggedData.level).toBe('info');
      expect(loggedData.event).toBe('test_event');
      expect(loggedData.message).toBe('Test message');
      expect(loggedData.timestamp).toBeDefined();
    });

    it('should log error messages to stderr', () => {
      structuredLogger.error({
        event: 'error_event',
        message: 'Error occurred',
        status: 'error',
      });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      
      expect(loggedData.level).toBe('error');
      expect(loggedData.event).toBe('error_event');
      expect(loggedData.status).toBe('error');
    });

    it('should include all context fields', () => {
      const context: LogContext = {
        event: 'complex_event',
        target: 'test-service',
        actor: 'user123',
        entity: 'order456',
        status: 'ok',
        details: { count: 5 },
        tags: { env: 'test' },
      };

      structuredLogger.info(context);

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.target).toBe('test-service');
      expect(loggedData.actor).toBe('user123');
      expect(loggedData.entity).toBe('order456');
      expect(loggedData.details).toEqual({ count: 5 });
      expect(loggedData.tags).toEqual({ env: 'test' });
    });
  });

  describe('createWorkflowLogger', () => {
    it('should create logger with workflow context', () => {
      const logger = createWorkflowLogger('whatsapp-handler');
      
      logger.info({
        event: 'message_received',
        message: 'Processing message',
      });

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.target).toBe('whatsapp-handler');
      expect(loggedData.event).toBe('message_received');
    });

    it('should support all log levels', () => {
      const logger = createWorkflowLogger('test-workflow');
      
      logger.debug({ event: 'debug_event' });
      logger.info({ event: 'info_event' });
      logger.warn({ event: 'warn_event' });
      logger.error({ event: 'error_event' });

      expect(consoleLogSpy).toHaveBeenCalledTimes(3); // debug, info, warn
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // error

      const debugLog = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(debugLog.level).toBe('debug');

      const errorLog = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(errorLog.level).toBe('error');
    });
  });

  describe('withLogging', () => {
    it('should log successful operation with duration', async () => {
      const operation = jest.fn().mockResolvedValue('result');
      
      const result = await withLogging('test_operation', operation, {
        target: 'test-service',
      });

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalledTimes(1);

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.event).toBe('test_operation');
      expect(loggedData.status).toBe('ok');
      expect(loggedData.duration_ms).toBeGreaterThanOrEqual(0);
      expect(loggedData.target).toBe('test-service');
    });

    it('should log failed operation with error details', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(
        withLogging('failed_operation', operation)
      ).rejects.toThrow('Operation failed');

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.event).toBe('failed_operation');
      expect(loggedData.status).toBe('error');
      expect(loggedData.message).toBe('Operation failed');
      expect(loggedData.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should measure operation duration', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'done';
      };

      await withLogging('timed_operation', operation);

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.duration_ms).toBeGreaterThanOrEqual(50);
    });
  });
});
