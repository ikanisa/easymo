import {
  eventPublisher,
  createEvent,
  publishWhatsAppMessageProcessed,
  publishMatchCreated,
  publishRecurringTripExecuted,
  publishDriverAvailabilityChanged,
  Event,
} from './utils/eventing';

// Mock the logger to avoid console output during tests
jest.mock('./utils/logging', () => ({
  structuredLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logContext: jest.fn(),
  },
}));

describe('Eventing Utilities', () => {
  beforeEach(() => {
    // Reset any subscriptions
    jest.clearAllMocks();
  });

  describe('eventPublisher', () => {
    it('should publish event with timestamp', async () => {
      const handler = jest.fn();
      eventPublisher.subscribe('test.event', handler);

      await eventPublisher.publish({
        type: 'test.event',
        timestamp: new Date().toISOString(),
        data: { message: 'Hello' },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test.event',
          data: { message: 'Hello' },
        })
      );
    });

    it('should call multiple handlers for same event type', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventPublisher.subscribe('multi.event', handler1);
      eventPublisher.subscribe('multi.event', handler2);

      await eventPublisher.publish({
        type: 'multi.event',
        timestamp: new Date().toISOString(),
        data: { count: 1 },
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should not call handler for different event type', async () => {
      const handler = jest.fn();
      eventPublisher.subscribe('type.a', handler);

      await eventPublisher.publish({
        type: 'type.b',
        timestamp: new Date().toISOString(),
        data: {},
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should support unsubscribe', async () => {
      const handler = jest.fn();
      const unsubscribe = eventPublisher.subscribe('unsub.event', handler);

      await eventPublisher.publish({
        type: 'unsub.event',
        timestamp: new Date().toISOString(),
        data: {},
      });

      expect(handler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      await eventPublisher.publish({
        type: 'unsub.event',
        timestamp: new Date().toISOString(),
        data: {},
      });

      // Should still be 1 (not called again)
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should publish batch of events', async () => {
      const handler = jest.fn();
      eventPublisher.subscribe('batch.event', handler);

      const events: Event[] = [
        {
          type: 'batch.event',
          timestamp: new Date().toISOString(),
          data: { id: 1 },
        },
        {
          type: 'batch.event',
          timestamp: new Date().toISOString(),
          data: { id: 2 },
        },
      ];

      await eventPublisher.publishBatch(events);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should handle async handlers', async () => {
      const asyncHandler = jest.fn(async (event: Event) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      eventPublisher.subscribe('async.event', asyncHandler);

      await eventPublisher.publish({
        type: 'async.event',
        timestamp: new Date().toISOString(),
        data: { test: true },
      });

      expect(asyncHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Helper functions', () => {
    describe('createEvent', () => {
      it('should create event with required fields', () => {
        const event = createEvent('test.type', { value: 42 });

        expect(event.type).toBe('test.type');
        expect(event.data).toEqual({ value: 42 });
        expect(event.timestamp).toBeDefined();
        expect(new Date(event.timestamp).getTime()).toBeGreaterThan(0);
      });

      it('should include metadata when provided', () => {
        const event = createEvent(
          'test.type',
          { value: 42 },
          'test-service',
          'correlation-123'
        );

        expect(event.metadata?.source).toBe('test-service');
        expect(event.metadata?.correlationId).toBe('correlation-123');
      });
    });

    describe('publishWhatsAppMessageProcessed', () => {
      it('should publish whatsapp message event', async () => {
        const handler = jest.fn();
        eventPublisher.subscribe('whatsapp.message.processed', handler);

        await publishWhatsAppMessageProcessed({
          messageId: 'msg-123',
          from: '+250788123456',
          type: 'text',
          timestamp: new Date().toISOString(),
        });

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'whatsapp.message.processed',
            data: expect.objectContaining({
              messageId: 'msg-123',
              from: '+250788123456',
            }),
            metadata: expect.objectContaining({
              source: 'whatsapp-webhook',
            }),
          })
        );
      });
    });

    describe('publishMatchCreated', () => {
      it('should publish match created event', async () => {
        const handler = jest.fn();
        eventPublisher.subscribe('match.created', handler);

        await publishMatchCreated({
          matchId: 'match-456',
          passengerId: 'passenger-1',
          driverId: 'driver-1',
          origin: { lat: -1.9441, lng: 30.0619 },
          destination: { lat: -1.9536, lng: 30.0606 },
          timestamp: new Date().toISOString(),
        });

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'match.created',
            data: expect.objectContaining({
              matchId: 'match-456',
              passengerId: 'passenger-1',
              driverId: 'driver-1',
            }),
            metadata: expect.objectContaining({
              source: 'matching-service',
            }),
          })
        );
      });
    });

    describe('publishRecurringTripExecuted', () => {
      it('should publish recurring trip executed event', async () => {
        const handler = jest.fn();
        eventPublisher.subscribe('recurring_trip.executed', handler);

        const now = new Date().toISOString();
        await publishRecurringTripExecuted({
          tripId: 'trip-789',
          scheduledTime: now,
          executedTime: now,
          candidates: 5,
        });

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'recurring_trip.executed',
            data: expect.objectContaining({
              tripId: 'trip-789',
              candidates: 5,
            }),
            metadata: expect.objectContaining({
              source: 'recurring-trips-scheduler',
            }),
          })
        );
      });
    });

    describe('publishDriverAvailabilityChanged', () => {
      it('should publish driver availability event', async () => {
        const handler = jest.fn();
        eventPublisher.subscribe('driver.availability.changed', handler);

        await publishDriverAvailabilityChanged({
          driverId: 'driver-123',
          available: true,
          location: { lat: -1.9441, lng: 30.0619 },
          timestamp: new Date().toISOString(),
        });

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'driver.availability.changed',
            data: expect.objectContaining({
              driverId: 'driver-123',
              available: true,
              location: { lat: -1.9441, lng: 30.0619 },
            }),
            metadata: expect.objectContaining({
              source: 'driver-service',
            }),
          })
        );
      });

      it('should handle availability event without location', async () => {
        const handler = jest.fn();
        eventPublisher.subscribe('driver.availability.changed', handler);

        await publishDriverAvailabilityChanged({
          driverId: 'driver-456',
          available: false,
          timestamp: new Date().toISOString(),
        });

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              available: false,
            }),
          })
        );
      });
    });
  });
});
