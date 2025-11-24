/**
 * Connection Pool Manager for Supabase Client
 *
 * Implements connection pooling to:
 * - Reduce connection overhead
 * - Improve performance
 * - Manage connection lifecycle
 * - Monitor pool health
 */

import { createClient, SupabaseClient } from "../deps.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "../config.ts";

interface PooledConnection {
  client: SupabaseClient;
  id: string;
  inUse: boolean;
  lastUsed: number;
  created: number;
  queryCount: number;
}

interface PoolConfig {
  minSize: number;
  maxSize: number;
  acquireTimeout: number;
  idleTimeout: number;
}

interface PoolStats {
  totalConnections: number;
  totalQueries: number;
  totalWaitTime: number;
  poolHits: number;
  poolMisses: number;
  currentSize: number;
  inUse: number;
  available: number;
  waitQueueSize: number;
}

export class ConnectionPool {
  private pool: Map<string, PooledConnection> = new Map();
  private waitQueue: Array<(client: SupabaseClient) => void> = [];
  private config: PoolConfig;
  private stats: PoolStats = {
    totalConnections: 0,
    totalQueries: 0,
    totalWaitTime: 0,
    poolHits: 0,
    poolMisses: 0,
    currentSize: 0,
    inUse: 0,
    available: 0,
    waitQueueSize: 0,
  };
  private maintenanceInterval?: number;

  constructor(config?: Partial<PoolConfig>) {
    this.config = {
      minSize: config?.minSize ?? 5,
      maxSize: config?.maxSize ?? 20,
      acquireTimeout: config?.acquireTimeout ?? 5000,
      idleTimeout: config?.idleTimeout ?? 300000, // 5 minutes
    };

    this.initialize();
  }

  /**
   * Initialize pool with minimum connections
   */
  private initialize(): void {
    for (let i = 0; i < this.config.minSize; i++) {
      this.createConnection();
    }

    // Start maintenance task
    this.maintenanceInterval = setInterval(
      () => this.maintain(),
      30000 // Every 30 seconds
    ) as unknown as number;

    logStructuredEvent("CONNECTION_POOL_INITIALIZED", {
      minSize: this.config.minSize,
      maxSize: this.config.maxSize,
    });
  }

  /**
   * Create a new pooled connection
   */
  private createConnection(): PooledConnection | null {
    if (this.pool.size >= this.config.maxSize) {
      return null;
    }

    try {
      const client = createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            headers: {
              "x-connection-pool": "true",
            },
          },
        }
      );

      const connection: PooledConnection = {
        client,
        id: crypto.randomUUID(),
        inUse: false,
        lastUsed: Date.now(),
        created: Date.now(),
        queryCount: 0,
      };

      this.pool.set(connection.id, connection);
      this.stats.totalConnections++;
      this.stats.currentSize = this.pool.size;

      return connection;
    } catch (error) {
      logStructuredEvent("CONNECTION_CREATION_ERROR", {
        error: String(error),
      });
      return null;
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<SupabaseClient> {
    const startTime = Date.now();
    const timeout = this.config.acquireTimeout;

    while (Date.now() - startTime < timeout) {
      // Find available connection
      for (const connection of this.pool.values()) {
        if (!connection.inUse) {
          connection.inUse = true;
          connection.lastUsed = Date.now();
          connection.queryCount++;

          const waitTime = Date.now() - startTime;
          this.stats.totalWaitTime += waitTime;
          this.stats.poolHits++;
          this.stats.inUse = Array.from(this.pool.values()).filter(c => c.inUse).length;
          this.stats.available = this.pool.size - this.stats.inUse;

          return connection.client;
        }
      }

      // Try to create new connection
      const newConnection = this.createConnection();
      if (newConnection) {
        newConnection.inUse = true;
        newConnection.queryCount++;
        this.stats.poolMisses++;
        this.stats.inUse = Array.from(this.pool.values()).filter(c => c.inUse).length;
        this.stats.available = this.pool.size - this.stats.inUse;
        return newConnection.client;
      }

      // Wait for connection to become available
      await new Promise<void>((resolve) => {
        const timeoutId = setTimeout(() => resolve(), 100);
        this.waitQueue.push(() => {
          clearTimeout(timeoutId);
          resolve();
        });
        this.stats.waitQueueSize = this.waitQueue.length;
      });
    }

    throw new Error(`Connection acquire timeout after ${timeout}ms`);
  }

  /**
   * Release a connection back to the pool
   */
  release(client: SupabaseClient): void {
    const connection = Array.from(this.pool.values()).find(
      (c) => c.client === client
    );

    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
      this.stats.totalQueries++;
      this.stats.inUse = Array.from(this.pool.values()).filter(c => c.inUse).length;
      this.stats.available = this.pool.size - this.stats.inUse;

      // Notify waiting requests
      const waiter = this.waitQueue.shift();
      this.stats.waitQueueSize = this.waitQueue.length;
      
      if (waiter) {
        waiter(client);
      }
    }
  }

  /**
   * Execute operation with pooled connection
   */
  async withConnection<T>(
    operation: (client: SupabaseClient) => Promise<T>
  ): Promise<T> {
    const client = await this.acquire();
    try {
      return await operation(client);
    } finally {
      this.release(client);
    }
  }

  /**
   * Perform pool maintenance
   */
  private async maintain(): Promise<void> {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, connection] of this.pool.entries()) {
      // Remove idle connections beyond minimum
      if (
        !connection.inUse &&
        this.pool.size > this.config.minSize &&
        now - connection.lastUsed > this.config.idleTimeout
      ) {
        toRemove.push(id);
      }

      // Replace connections that are too old (1 hour)
      if (!connection.inUse && now - connection.created > 3600000) {
        toRemove.push(id);
        this.createConnection(); // Create replacement
      }
    }

    // Remove marked connections
    for (const id of toRemove) {
      this.pool.delete(id);
      this.stats.currentSize = this.pool.size;
    }

    // Ensure minimum connections
    while (this.pool.size < this.config.minSize) {
      this.createConnection();
    }

    if (toRemove.length > 0) {
      await logStructuredEvent("CONNECTION_POOL_MAINTENANCE", {
        removed: toRemove.length,
        poolSize: this.pool.size,
      });
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats & {
    avgQueriesPerConnection: number;
    avgWaitTime: number;
  } {
    return {
      ...this.stats,
      avgQueriesPerConnection:
        this.stats.totalQueries / Math.max(1, this.stats.totalConnections),
      avgWaitTime:
        this.stats.totalWaitTime /
        Math.max(1, this.stats.poolHits + this.stats.poolMisses),
    };
  }

  /**
   * Check pool health
   */
  isHealthy(): boolean {
    return (
      this.pool.size >= this.config.minSize &&
      this.pool.size <= this.config.maxSize &&
      this.stats.waitQueueSize < 10
    );
  }

  /**
   * Destroy the pool
   */
  async destroy(): Promise<void> {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }

    this.pool.clear();
    this.waitQueue = [];

    await logStructuredEvent("CONNECTION_POOL_DESTROYED", {
      stats: this.stats,
    });
  }
}

/**
 * Singleton pool instance
 */
let poolInstance: ConnectionPool | null = null;

export function getConnectionPool(): ConnectionPool {
  if (!poolInstance) {
    poolInstance = new ConnectionPool();
  }
  return poolInstance;
}

/**
 * Helper function to execute with pooled connection
 */
export async function withPooledConnection<T>(
  operation: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const pool = getConnectionPool();
  return await pool.withConnection(operation);
}
