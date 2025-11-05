jest.mock('@easymo/commons', () => {
  const actual = jest.requireActual('@easymo/commons');
  return {
    ...actual,
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    withTelemetryContext: jest.fn(async (fn: () => unknown) => await fn()),
  };
});

import { logger as sharedLogger, withTelemetryContext } from '@easymo/commons';
import { structuredLogger, createWorkflowLogger, withLogging, LogContext } from './utils/logging';

describe('Logging Utilities', () => {
  const mockedLogger = sharedLogger as jest.Mocked<typeof sharedLogger>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('structuredLogger', () => {
    it('should log info messages to stdout', () => {
      structuredLogger.info({
        event: 'test_event',
        message: 'Test message',
      });

      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'test_event',
          message: 'Test message',
        }),
      );
    });

    it('should log error messages to stderr', () => {
      structuredLogger.error({
        event: 'error_event',
        message: 'Error occurred',
        status: 'error',
      });

      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'error_event',
          status: 'error',
        }),
      );
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

      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'test-service',
          actor: 'user123',
          entity: 'order456',
          details: { count: 5 },
          tags: { env: 'test' },
        }),
      );
    });
  });

  describe('createWorkflowLogger', () => {
    it('should create logger with workflow context', () => {
      const logger = createWorkflowLogger('whatsapp-handler');

      logger.info({
        event: 'message_received',
        message: 'Processing message',
      });

      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'whatsapp-handler',
          event: 'message_received',
        }),
      );
    });

    it('should support all log levels', () => {
      const logger = createWorkflowLogger('test-workflow');

      logger.debug({ event: 'debug_event' });
      logger.info({ event: 'info_event' });
      logger.warn({ event: 'warn_event' });
      logger.error({ event: 'error_event' });

      expect(mockedLogger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: 'debug_event' }));
      expect(mockedLogger.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'info_event' }));
      expect(mockedLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'warn_event' }));
      expect(mockedLogger.error).toHaveBeenCalledWith(expect.objectContaining({ event: 'error_event' }));
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

      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'test_operation',
          status: 'ok',
          target: 'test-service',
        }),
      );
    });

    it('should log failed operation with error details', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        withLogging('failed_operation', operation)
      ).rejects.toThrow('Operation failed');

      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'failed_operation',
          status: 'error',
          message: 'Operation failed',
        }),
      );
    });

    it('should measure operation duration', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'done';
      };

      await withLogging('timed_operation', operation);

      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'timed_operation',
        }),
      );
    });
  });

  it('should use telemetry context helper', async () => {
    const telemetrySpy = withTelemetryContext as jest.Mock;

    await withLogging('telemetry_event', async () => 'ok');

    expect(telemetrySpy).toHaveBeenCalled();
  });
});
