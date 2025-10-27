/**
 * Event publishing utility for message bus integration
 * 
 * Supports publishing events to message buses like RabbitMQ or Kafka
 * for key actions in the system.
 */

import { structuredLogger } from './logging';

export interface Event {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
  metadata?: {
    source?: string;
    correlationId?: string;
    [key: string]: unknown;
  };
}

export interface EventPublisher {
  publish(event: Event): Promise<void>;
  publishBatch(events: Event[]): Promise<void>;
  shutdown(): Promise<void>;
}

type EventHandler = (event: Event) => void | Promise<void>;

/**
 * Generic event bus implementation
 * Can be extended to support different message brokers
 */
class EventBus implements EventPublisher {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private eventQueue: Event[] = [];
  private messageBusUrl: string | null = null;
  private initialized = false;
  private flushInterval: NodeJS.Timeout | null = null;

  private ensureInitialized(): void {
    if (this.initialized) return;
    
    this.messageBusUrl = process.env.MESSAGE_BUS_URL ?? null;
    this.initialized = true;

    // Auto-flush events every 5 seconds if message bus is configured
    if (this.messageBusUrl) {
      this.flushInterval = setInterval(() => {
        this.flushQueue();
      }, 5000);
    }
  }

  /**
   * Publish a single event
   */
  async publish(event: Event): Promise<void> {
    this.ensureInitialized();

    // Ensure timestamp is set
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Log the event
    structuredLogger.debug({
      event: 'event_published',
      details: { type: event.type, source: event.metadata?.source },
    });

    // Notify local handlers
    const handlers = this.handlers.get(event.type) ?? new Set();
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        structuredLogger.error({
          event: 'event_handler_failed',
          message: error instanceof Error ? error.message : String(error),
          details: { eventType: event.type },
        });
      }
    }

    // Queue for external message bus
    if (this.messageBusUrl) {
      this.eventQueue.push(event);
      
      // Flush immediately if queue is getting large
      if (this.eventQueue.length >= 100) {
        await this.flushQueue();
      }
    }
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch(events: Event[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Subscribe to events of a specific type (for local handling)
   */
  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Flush queued events to message bus
   */
  private async flushQueue(): Promise<void> {
    if (!this.messageBusUrl || this.eventQueue.length === 0) {
      return;
    }

    const batch = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const response = await fetch(this.messageBusUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });

      if (!response.ok) {
        structuredLogger.error({
          event: 'event_bus_flush_failed',
          message: `HTTP ${response.status}`,
          details: { batchSize: batch.length },
        });
        // Re-queue failed events
        this.eventQueue.unshift(...batch);
      }
    } catch (error) {
      structuredLogger.error({
        event: 'event_bus_flush_error',
        message: error instanceof Error ? error.message : String(error),
        details: { batchSize: batch.length },
      });
      // Re-queue failed events
      this.eventQueue.unshift(...batch);
    }
  }

  /**
   * Graceful shutdown - flush remaining events
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flushQueue();
  }
}

// Singleton instance
const eventBus = new EventBus();

// Graceful shutdown
process.on('SIGTERM', () => eventBus.shutdown());
process.on('SIGINT', () => eventBus.shutdown());

export const eventPublisher = eventBus;

/**
 * Helper functions for common event types
 */

export async function publishWhatsAppMessageProcessed(data: {
  messageId: string;
  from: string;
  type: string;
  timestamp: string;
}): Promise<void> {
  await eventBus.publish({
    type: 'whatsapp.message.processed',
    timestamp: data.timestamp,
    data,
    metadata: { source: 'whatsapp-webhook' },
  });
}

export async function publishMatchCreated(data: {
  matchId: string;
  passengerId: string;
  driverId: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  timestamp: string;
}): Promise<void> {
  await eventBus.publish({
    type: 'match.created',
    timestamp: data.timestamp,
    data,
    metadata: { source: 'matching-service' },
  });
}

export async function publishRecurringTripExecuted(data: {
  tripId: string;
  scheduledTime: string;
  executedTime: string;
  candidates: number;
}): Promise<void> {
  await eventBus.publish({
    type: 'recurring_trip.executed',
    timestamp: data.executedTime,
    data,
    metadata: { source: 'recurring-trips-scheduler' },
  });
}

export async function publishDriverAvailabilityChanged(data: {
  driverId: string;
  available: boolean;
  location?: { lat: number; lng: number };
  timestamp: string;
}): Promise<void> {
  await eventBus.publish({
    type: 'driver.availability.changed',
    timestamp: data.timestamp,
    data,
    metadata: { source: 'driver-service' },
  });
}

/**
 * Create an event with common metadata
 */
export function createEvent(
  type: string,
  data: Record<string, unknown>,
  source?: string,
  correlationId?: string,
): Event {
  return {
    type,
    timestamp: new Date().toISOString(),
    data,
    metadata: {
      source,
      correlationId,
    },
  };
}
