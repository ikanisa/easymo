# Observability & Events Configuration

This document describes the observability infrastructure implemented in the Easymo platform, including structured logging, metrics collection, and event publishing.

## Overview

The observability system provides three core capabilities:
1. **Structured Logging** - JSON-formatted logs for easy searching and analysis
2. **Prometheus Metrics** - Counters, histograms, and gauges for monitoring
3. **Event Publishing** - Message bus integration for key system events

## Environment Variables

Configure observability features using these environment variables:

### Logging
- `LOG_DRAIN_URL` - Optional URL to forward logs to an external logging service (e.g., Datadog, Splunk)

### Metrics
- `METRICS_DRAIN_URL` - Optional URL to forward metrics to a metrics aggregation service

### Events
- `MESSAGE_BUS_URL` - Optional URL to forward events to a message bus (e.g., RabbitMQ, Kafka)

## Usage

### Structured Logging

```typescript
import { structuredLogger, createWorkflowLogger, withLogging } from './utils/logging';

// Basic logging
structuredLogger.info({
  event: 'user_login',
  actor: 'user123',
  status: 'ok',
  details: { method: 'oauth' },
});

// Create workflow-specific logger
const logger = createWorkflowLogger('whatsapp-handler');
logger.info({
  event: 'message_received',
  details: { from: '+250788123456' },
});

// Automatically measure operation duration
const result = await withLogging('database_query', async () => {
  return await db.query('SELECT * FROM users');
}, { target: 'user-service' });
```

### Metrics Collection

```typescript
import { metricsCollector, measureDuration, trackOperation } from './utils/metrics';

// Increment counters
metricsCollector.incrementCounter(
  'http_requests_total',
  'Total HTTP requests',
  1,
  { method: 'GET', status: '200' }
);

// Record histogram (e.g., latencies)
metricsCollector.recordHistogram(
  'api_response_time',
  'API response time in ms',
  150,
  { endpoint: '/users' }
);

// Set gauge values
metricsCollector.setGauge(
  'active_connections',
  'Number of active connections',
  42
);

// Auto-measure operation duration
await measureDuration('db_query', async () => {
  return await db.query('...');
}, { query_type: 'select' });

// Track success/failure rates
await trackOperation('api_call', async () => {
  return await fetch('...');
}, { endpoint: '/external' });
```

### Event Publishing

```typescript
import {
  eventPublisher,
  publishWhatsAppMessageProcessed,
  publishMatchCreated,
  publishRecurringTripExecuted,
  publishDriverAvailabilityChanged,
} from './utils/eventing';

// Publish WhatsApp message event
await publishWhatsAppMessageProcessed({
  messageId: 'msg-123',
  from: '+250788123456',
  type: 'text',
  timestamp: new Date().toISOString(),
});

// Publish match created event
await publishMatchCreated({
  matchId: 'match-456',
  passengerId: 'passenger-1',
  driverId: 'driver-1',
  origin: { lat: -1.9441, lng: 30.0619 },
  destination: { lat: -1.9536, lng: 30.0606 },
  timestamp: new Date().toISOString(),
});

// Subscribe to events (for local handling)
const unsubscribe = eventPublisher.subscribe('match.created', (event) => {
  console.log('Match created:', event.data);
});
```

## Prometheus Metrics Endpoint

Expose metrics in Prometheus format:

```typescript
import { metricsCollector } from './utils/metrics';

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(metricsCollector.getMetrics());
});
```

## Integration Examples

### WhatsApp Message Handler

```typescript
import { createWorkflowLogger, withLogging } from './utils/logging';
import { metricsCollector } from './utils/metrics';
import { publishWhatsAppMessageProcessed } from './utils/eventing';

const logger = createWorkflowLogger('whatsapp-handler');

async function handleWhatsAppMessage(message: WhatsAppMessage) {
  const start = Date.now();
  
  try {
    logger.info({
      event: 'message_received',
      details: {
        messageId: message.id,
        from: message.from,
        type: message.type,
      },
    });

    await withLogging('process_message', async () => {
      // Process message logic
      await processMessage(message);
    });

    // Record metrics
    const duration = Date.now() - start;
    metricsCollector.recordHistogram(
      'whatsapp_message_duration',
      'WhatsApp message processing duration',
      duration,
      { type: message.type }
    );
    metricsCollector.incrementCounter(
      'whatsapp_messages_total',
      'Total WhatsApp messages processed',
      1,
      { status: 'success', type: message.type }
    );

    // Publish event
    await publishWhatsAppMessageProcessed({
      messageId: message.id,
      from: message.from,
      type: message.type,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error({
      event: 'message_processing_failed',
      message: error instanceof Error ? error.message : String(error),
      details: { messageId: message.id },
    });
    
    metricsCollector.incrementCounter(
      'whatsapp_messages_total',
      'Total WhatsApp messages processed',
      1,
      { status: 'error', type: message.type }
    );
    
    throw error;
  }
}
```

### Database Operations

```typescript
import { withLogging } from './utils/logging';
import { trackOperation } from './utils/metrics';

async function updateKeywordMap(keyword: string, handler: string) {
  return await trackOperation('keyword_map_update', async () => {
    return await withLogging('db_keyword_update', async () => {
      return await db.keywordMap.update({ keyword, handler });
    }, { keyword, handler });
  }, { operation: 'update' });
}
```

## Log Format

All logs are output in JSON format with the following structure:

```json
{
  "timestamp": "2025-10-27T16:32:00.283Z",
  "level": "info",
  "event": "event_name",
  "target": "service_name",
  "actor": "user_id",
  "entity": "resource_id",
  "status": "ok",
  "message": "Human-readable message",
  "details": {
    "key": "value"
  },
  "tags": {
    "env": "production"
  },
  "duration_ms": 150
}
```

## Metric Types

### Counters
Monotonically increasing values (e.g., total requests, errors)

### Histograms
Distribution of values with percentiles (e.g., response times, latencies)
- Provides: sum, count, p50, p95, p99

### Gauges
Current value that can increase or decrease (e.g., active connections, queue size)

## Event Types

### WhatsApp Events
- `whatsapp.message.processed` - Message processing completed

### Matching Events
- `match.created` - New passenger-driver match created

### Recurring Trip Events
- `recurring_trip.executed` - Recurring trip scheduler ran

### Driver Events
- `driver.availability.changed` - Driver availability status changed

## Testing

Run observability tests:

```bash
cd apps/api
npm test -- --testPathPattern="(logging|metrics|eventing).spec"
```

## Production Deployment

1. **Configure log drain** - Set `LOG_DRAIN_URL` to forward logs to your logging service
2. **Configure metrics drain** - Set `METRICS_DRAIN_URL` to forward metrics to Prometheus or compatible service
3. **Configure message bus** - Set `MESSAGE_BUS_URL` to publish events to RabbitMQ/Kafka
4. **Expose metrics endpoint** - Ensure `/metrics` endpoint is accessible to Prometheus scraper
5. **Set up alerting** - Configure alerts based on metrics (error rates, latency spikes)

## Best Practices

1. **Always include context** - Add relevant identifiers (user_id, request_id, etc.) to logs and metrics
2. **Use appropriate log levels** - debug < info < warn < error
3. **Measure critical paths** - Track duration and success rates of key operations
4. **Publish important events** - Allow other services to react to system changes
5. **Don't log sensitive data** - Never log passwords, tokens, or PII
6. **Use structured data** - Store complex data in `details` field, not in message strings

## Troubleshooting

### Logs not appearing
- Check that `console.log` output is being captured by your container runtime
- Verify `LOG_DRAIN_URL` is correct if using external drain

### Metrics not updating
- Verify metrics endpoint is accessible: `curl http://localhost:3000/metrics`
- Check `METRICS_DRAIN_URL` configuration

### Events not published
- Verify `MESSAGE_BUS_URL` is configured and accessible
- Check application logs for event publishing errors
- Events are queued and flushed every 5 seconds

## Support

For issues or questions about observability features, see:
- Integration tests: `apps/api/src/*spec.ts`
- Source code: `apps/api/src/utils/`
