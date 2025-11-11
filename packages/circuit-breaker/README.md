# @easymo/circuit-breaker

Circuit breaker pattern implementation to prevent cascading failures in distributed systems.

## Features

- **Three States**: CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery)
- **Configurable Thresholds**: Set failure rates and minimum requests
- **Automatic Recovery**: Attempts recovery after timeout period
- **Request Timeout**: Optional per-request timeout
- **Metrics**: Built-in success/failure tracking
- **Callbacks**: Hook into state transitions
- **Custom Failure Detection**: Define what constitutes a failure

## Installation

```bash
pnpm add @easymo/circuit-breaker
```

## Usage

### Basic Example

```typescript
import { createCircuitBreaker, CircuitState } from "@easymo/circuit-breaker";

const breaker = createCircuitBreaker({
  name: "my-api",
  failureThreshold: 50,      // Open circuit at 50% failure rate
  minimumRequests: 10,       // Need at least 10 requests
  windowMs: 60000,           // Track failures over 60 seconds
  resetTimeoutMs: 30000,     // Wait 30 seconds before retry
  requestTimeoutMs: 5000,    // 5 second timeout per request
});

async function callAPI() {
  try {
    const result = await breaker.execute(async () => {
      const response = await fetch("https://api.example.com/data");
      return response.json();
    });
    console.log("Success:", result);
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      console.error("Circuit is open, retry at:", new Date(error.nextRetryAt));
    } else {
      console.error("Request failed:", error);
    }
  }
}
```

### WhatsApp Graph API Example

```typescript
import { createCircuitBreaker } from "@easymo/circuit-breaker";

// Create circuit breaker for WhatsApp API
const whatsappBreaker = createCircuitBreaker({
  name: "whatsapp-graph-api",
  failureThreshold: 30,      // Open at 30% failures
  minimumRequests: 5,        // Need 5 requests minimum
  windowMs: 30000,           // 30 second window
  resetTimeoutMs: 60000,     // Wait 60s before retry
  requestTimeoutMs: 10000,   // 10s timeout
  
  // Only count 5xx errors and timeouts as failures
  isFailure: (error) => {
    if (error.name === "RequestTimeoutError") return true;
    if (error.response?.status >= 500) return true;
    return false;
  },
  
  // Log state changes
  onStateChange: (from, to) => {
    console.log(`Circuit breaker transitioned: ${from} -> ${to}`);
  },
  
  onOpen: () => {
    console.error("⚠️ WhatsApp API circuit breaker OPENED");
    // Alert monitoring system
  },
  
  onClose: () => {
    console.info("✅ WhatsApp API circuit breaker CLOSED");
  },
});

// Use in WhatsApp message sending
async function sendWhatsAppMessage(to: string, message: string) {
  return await whatsappBreaker.execute(async () => {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const error: any = new Error("WhatsApp API request failed");
      error.response = response;
      throw error;
    }

    return response.json();
  });
}
```

### With Fallback

```typescript
import { CircuitBreakerOpenError } from "@easymo/circuit-breaker";

async function sendMessageWithFallback(to: string, message: string) {
  try {
    // Try primary API
    return await sendWhatsAppMessage(to, message);
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      console.warn("Circuit open, using fallback");
      // Use fallback: queue for later, use backup channel, etc.
      await queueMessageForLater(to, message);
      return { queued: true };
    }
    throw error;
  }
}
```

## Configuration Options

### CircuitBreakerOptions

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Name for logging and identification |
| `failureThreshold` | `number` | Failure percentage (0-100) to open circuit |
| `minimumRequests` | `number` | Minimum requests before opening circuit |
| `windowMs` | `number` | Time window for tracking failures (ms) |
| `resetTimeoutMs` | `number` | Time to wait before attempting recovery (ms) |
| `halfOpenRequests` | `number` | Number of test requests in HALF_OPEN state |
| `requestTimeoutMs` | `number` | Timeout for individual requests (ms) |
| `isFailure` | `function` | Custom function to determine if error is a failure |
| `onStateChange` | `function` | Callback when state changes |
| `onOpen` | `function` | Callback when circuit opens |
| `onClose` | `function` | Callback when circuit closes |
| `onHalfOpen` | `function` | Callback when entering half-open state |

## Circuit States

### CLOSED (Normal Operation)
- All requests pass through
- Failures are tracked
- Opens if failure threshold is exceeded

### OPEN (Failing Fast)
- Requests fail immediately without calling the function
- No resource consumption
- Transitions to HALF_OPEN after `resetTimeoutMs`

### HALF_OPEN (Testing Recovery)
- Limited number of test requests allowed
- Success → CLOSED
- Failure → OPEN

## Metrics

Get current metrics:

```typescript
const metrics = breaker.getMetrics();
console.log({
  state: metrics.state,
  total: metrics.total,
  failures: metrics.failures,
  successes: metrics.successes,
  failureRate: metrics.failureRate,
  nextRetryAt: metrics.nextRetryAt,
});
```

## Error Handling

The circuit breaker throws two custom errors:

### CircuitBreakerOpenError
Thrown when circuit is open:
```typescript
try {
  await breaker.execute(fn);
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    console.log("Circuit open, retry at:", error.nextRetryAt);
  }
}
```

### RequestTimeoutError
Thrown when request exceeds timeout:
```typescript
try {
  await breaker.execute(fn);
} catch (error) {
  if (error instanceof RequestTimeoutError) {
    console.log("Request timed out after:", error.timeoutMs);
  }
}
```

## Best Practices

1. **Set Appropriate Thresholds**: Start conservative and adjust based on metrics
2. **Monitor State Changes**: Always log or alert on state transitions
3. **Implement Fallbacks**: Have a backup plan when circuit opens
4. **Use Multiple Breakers**: One per external dependency
5. **Define Failure Criteria**: Not all errors should open the circuit (e.g., 4xx vs 5xx)
6. **Test Recovery**: Ensure HALF_OPEN state properly tests recovery

## Example: Integration with Express

```typescript
import express from "express";
import { createCircuitBreaker, CircuitBreakerOpenError } from "@easymo/circuit-breaker";

const app = express();
const apiBreaker = createCircuitBreaker({
  name: "external-api",
  failureThreshold: 50,
  minimumRequests: 10,
  windowMs: 60000,
  resetTimeoutMs: 30000,
});

app.get("/data", async (req, res) => {
  try {
    const data = await apiBreaker.execute(async () => {
      return await fetchFromExternalAPI();
    });
    res.json(data);
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      res.status(503).json({
        error: "Service temporarily unavailable",
        retryAfter: Math.ceil((error.nextRetryAt - Date.now()) / 1000),
      });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Health check endpoint with circuit breaker status
app.get("/health", (req, res) => {
  const metrics = apiBreaker.getMetrics();
  res.json({
    status: metrics.state === "OPEN" ? "degraded" : "healthy",
    circuitBreaker: metrics,
  });
});
```

## Testing

```typescript
import { createCircuitBreaker, CircuitState } from "@easymo/circuit-breaker";

describe("Circuit Breaker", () => {
  it("should open after threshold failures", async () => {
    const breaker = createCircuitBreaker({
      failureThreshold: 50,
      minimumRequests: 2,
      windowMs: 10000,
      resetTimeoutMs: 1000,
    });

    // Simulate failures
    await expect(breaker.execute(() => Promise.reject("error"))).rejects.toThrow();
    await expect(breaker.execute(() => Promise.reject("error"))).rejects.toThrow();

    // Circuit should be open
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });
});
```
