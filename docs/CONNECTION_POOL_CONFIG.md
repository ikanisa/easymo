# Database Connection Pool Configuration

## Overview

Proper database connection pooling is critical for application performance and resource management.
This guide covers connection pool configuration for PostgreSQL (Prisma), Redis, and Kafka.

## PostgreSQL Connection Pooling

### Prisma Configuration

**File:** `packages/db/src/index.ts`

```typescript
import { PrismaClient } from "@prisma/client";

/**
 * Recommended pool configuration for production
 */
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// Connection pool limits are configured via DATABASE_URL
// Example: postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10
```

### Environment Variables

```bash
# Connection pool settings
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10&connect_timeout=5"

# Recommended settings by service:
# - wallet-service: connection_limit=20 (high transaction volume)
# - agent-core: connection_limit=15 (moderate load)
# - ranking-service: connection_limit=10 (read-heavy)
# - vendor-service: connection_limit=10 (moderate load)
```

### Pool Size Guidelines

| Environment               | Connection Limit | Pool Timeout | Connect Timeout |
| ------------------------- | ---------------- | ------------ | --------------- |
| Development               | 5                | 10s          | 5s              |
| Staging                   | 10               | 10s          | 5s              |
| Production (Low Traffic)  | 15               | 10s          | 5s              |
| Production (High Traffic) | 20-30            | 10s          | 5s              |

**Formula:** `connections = ((core_count * 2) + effective_spindle_count)`

For typical cloud instances:

- 2 CPU cores → 10 connections
- 4 CPU cores → 20 connections
- 8 CPU cores → 30 connections

### Connection Pool Monitoring

```typescript
// Add to your service startup
import { PrismaService } from "@easymo/db";

async function bootstrap() {
  const prisma = new PrismaService();

  // Monitor pool status
  setInterval(async () => {
    const metrics = await prisma.$metrics.json();
    console.log({
      event: "DB_POOL_METRICS",
      activeConnections: metrics.gauges.find((g) => g.key === "prisma_pool_connections_busy")
        ?.value,
      idleConnections: metrics.gauges.find((g) => g.key === "prisma_pool_connections_idle")?.value,
    });
  }, 60000); // Every minute
}
```

### PgBouncer (Recommended for Production)

For production deployments with multiple services, use PgBouncer as a connection pooler:

**Installation:**

```bash
# Ubuntu/Debian
sudo apt-get install pgbouncer

# macOS
brew install pgbouncer
```

**Configuration:** `/etc/pgbouncer/pgbouncer.ini`

```ini
[databases]
easymo = host=db.supabase.co port=5432 dbname=postgres

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3

# Logging
admin_users = postgres
stats_users = postgres
```

**Update CONNECTION_URL:**

```bash
# Direct connection (development)
DATABASE_URL="postgresql://user:pass@host:5432/postgres"

# Via PgBouncer (production)
DATABASE_URL="postgresql://user:pass@localhost:6432/easymo"
```

---

## Redis Connection Pooling

### IORedis Configuration

**File:** `packages/commons/src/redis.ts`

```typescript
import Redis from "ioredis";

/**
 * Create Redis client with connection pool
 */
export function createRedisClient(options?: Partial<Redis.RedisOptions>): Redis {
  return new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0"),

    // Connection pool settings
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },

    // Connection timeout
    connectTimeout: 10000,

    // Keep-alive
    keepAlive: 30000,

    // Enable offline queue
    enableOfflineQueue: true,

    // Reconnect on error
    reconnectOnError: (err: Error) => {
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true; // Reconnect on Redis cluster failover
      }
      return false;
    },

    ...options,
  });
}

/**
 * Create Redis cluster client
 */
export function createRedisCluster(nodes: { host: string; port: number }[]): Redis.Cluster {
  return new Redis.Cluster(nodes, {
    redisOptions: {
      password: process.env.REDIS_PASSWORD,
    },
    clusterRetryStrategy: (times: number) => {
      return Math.min(100 * times, 2000);
    },
  });
}
```

### Environment Variables

```bash
# Single Redis instance
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# Redis Cluster
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379
```

### Usage Example

```typescript
import { createRedisClient } from "@easymo/commons";

const redis = createRedisClient();

// Use for caching
async function getUser(userId: string) {
  const cached = await redis.get(`user:${userId}`);
  if (cached) return JSON.parse(cached);

  const user = await db.user.findUnique({ where: { id: userId } });
  await redis.setex(`user:${userId}`, 300, JSON.stringify(user));

  return user;
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  await redis.quit();
});
```

---

## Kafka Connection Configuration

### KafkaJS Configuration

**File:** `packages/messaging/src/kafka.ts`

```typescript
import { Kafka, logLevel } from "kafkajs";

/**
 * Create Kafka client with optimized settings
 */
export function createKafkaClient(): Kafka {
  return new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || "easymo-service",
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),

    // Connection settings
    connectionTimeout: 10000,
    requestTimeout: 30000,

    // Retry settings
    retry: {
      initialRetryTime: 100,
      retries: 8,
      maxRetryTime: 30000,
      multiplier: 2,
    },

    // Logging
    logLevel: process.env.NODE_ENV === "production" ? logLevel.ERROR : logLevel.INFO,

    // SSL/SASL (if needed)
    ssl: process.env.KAFKA_SSL === "true",
    sasl: process.env.KAFKA_USERNAME
      ? {
          mechanism: "plain",
          username: process.env.KAFKA_USERNAME,
          password: process.env.KAFKA_PASSWORD,
        }
      : undefined,
  });
}

/**
 * Create Kafka producer with optimized settings
 */
export async function createKafkaProducer(kafka: Kafka) {
  const producer = kafka.producer({
    // Batching for better throughput
    maxInFlightRequests: 5,

    // Idempotence for exactly-once semantics
    idempotent: true,

    // Compression
    compression: 1, // GZIP

    // Retry
    retry: {
      initialRetryTime: 100,
      retries: 3,
    },
  });

  await producer.connect();
  return producer;
}

/**
 * Create Kafka consumer with optimized settings
 */
export async function createKafkaConsumer(kafka: Kafka, groupId: string) {
  const consumer = kafka.consumer({
    groupId,

    // Session timeout
    sessionTimeout: 30000,

    // Heartbeat interval
    heartbeatInterval: 3000,

    // Rebalance timeout
    rebalanceTimeout: 60000,

    // Max wait time for fetch
    maxWaitTimeInMs: 5000,

    // Max bytes per partition
    maxBytesPerPartition: 1048576, // 1MB
  });

  await consumer.connect();
  return consumer;
}
```

### Environment Variables

```bash
# Kafka configuration
KAFKA_CLIENT_ID=wallet-service
KAFKA_BROKERS=localhost:9092,localhost:9093
KAFKA_USERNAME=admin
KAFKA_PASSWORD=secret
KAFKA_SSL=false

# Consumer group
KAFKA_GROUP_ID=wallet-service-group
```

---

## Connection Pool Best Practices

### 1. Right-Size Your Pools

❌ **Too Small:**

- Requests queue up
- Increased latency
- Timeouts under load

❌ **Too Large:**

- Wasted resources
- Database overload
- Memory pressure

✅ **Just Right:**

- Monitor actual usage
- Start conservative
- Scale based on metrics

### 2. Monitor Pool Metrics

**What to Monitor:**

- Active connections
- Idle connections
- Wait time for connections
- Connection errors
- Query duration

**Alerting Thresholds:**

```yaml
# Example Prometheus alerts
- alert: HighConnectionUtilization
  expr: db_connections_active / db_connections_max > 0.8
  annotations:
    summary: "Database connection pool is 80% utilized"

- alert: ConnectionPoolExhausted
  expr: db_connection_wait_time_seconds > 5
  annotations:
    summary: "Requests waiting >5s for database connection"
```

### 3. Implement Graceful Shutdown

```typescript
// Express app
const server = app.listen(port);

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, starting graceful shutdown");

  // Stop accepting new requests
  server.close();

  // Close database connections
  await prisma.$disconnect();

  // Close Redis connections
  await redis.quit();

  // Close Kafka producer
  await producer.disconnect();

  console.log("Shutdown complete");
  process.exit(0);
});
```

### 4. Handle Connection Errors

```typescript
// Retry logic with exponential backoff
async function connectWithRetry(connect: () => Promise<void>, maxRetries = 5): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await connect();
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      console.log(`Connection failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Usage
await connectWithRetry(async () => {
  await prisma.$connect();
});
```

### 5. Connection Pool Testing

```bash
# Test connection pool under load
# Install Apache Bench
sudo apt-get install apache2-utils

# Send 1000 requests with 50 concurrent connections
ab -n 1000 -c 50 -H "Authorization: Bearer $TOKEN" \
  http://localhost:4400/health

# Monitor connection pool during test
watch -n 1 'psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '\''easymo'\'';"'
```

---

## Troubleshooting

### Issue: Connection Pool Exhausted

**Symptoms:**

- "Connection pool exhausted" errors
- High wait times for connections
- 503 Service Unavailable responses

**Solutions:**

1. Increase connection pool size
2. Optimize slow queries
3. Implement connection pooler (PgBouncer)
4. Add read replicas for read-heavy workloads

### Issue: Connection Leaks

**Symptoms:**

- Connections never released
- Pool size grows over time
- Eventually all connections used

**Solutions:**

1. Ensure transactions are properly closed
2. Use `try/finally` blocks
3. Enable connection leak detection:

```typescript
const prisma = new PrismaClient({
  log: [
    { level: "warn", emit: "event" },
    { level: "error", emit: "event" },
  ],
});

prisma.$on("warn", (e) => {
  if (e.message.includes("Connection leak")) {
    console.error("Connection leak detected!", e);
  }
});
```

### Issue: Connection Timeout

**Symptoms:**

- "Connection timeout" errors
- Intermittent connectivity issues

**Solutions:**

1. Increase `connect_timeout` in connection string
2. Check network connectivity
3. Verify firewall rules
4. Use connection pooler closer to database

---

## Performance Optimization

### Query Optimization

```sql
-- Find slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Find missing indexes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1;
```

### Connection Pooler Metrics

```sql
-- PgBouncer stats
SHOW POOLS;
SHOW DATABASES;
SHOW CLIENTS;
SHOW SERVERS;
```

---

**Last Updated:** 2024-03-15  
**Version:** 1.0  
**Owner:** DevOps Team
