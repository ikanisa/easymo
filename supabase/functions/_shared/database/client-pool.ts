/**
 * Supabase Client Pool
 * Manages Supabase client instances for optimal connection reuse
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEnv } from "../config/index.ts";
import { logStructuredEvent } from "../observability/index.ts";

// ============================================================================
// TYPES
// ============================================================================

export type ClientPoolConfig = {
  /** Maximum number of clients to pool */
  maxClients: number;
  /** Idle timeout in milliseconds */
  idleTimeoutMs: number;
  /** Enable health checks */
  healthCheck: boolean;
  /** Health check interval in milliseconds */
  healthCheckIntervalMs: number;
};

type PooledClient = {
  client: SupabaseClient;
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
  healthy: boolean;
};

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_POOL_CONFIG: ClientPoolConfig = {
  maxClients: 10,
  idleTimeoutMs: 5 * 60 * 1000, // 5 minutes
  healthCheck: true,
  healthCheckIntervalMs: 60 * 1000, // 1 minute
};

// ============================================================================
// CLIENT POOL CLASS
// ============================================================================

class SupabaseClientPool {
  private clients: PooledClient[] = [];
  private config: ClientPoolConfig;
  private healthCheckInterval: number | null = null;
  private initialized: boolean = false;

  constructor(config: Partial<ClientPoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
  }

  /**
   * Initialize the pool
   */
  initialize(): void {
    if (this.initialized) return;

    // Create initial client
    this.createClient();

    // Start health check if enabled
    if (this.config.healthCheck) {
      this.startHealthCheck();
    }

    this.initialized = true;
    logStructuredEvent("CLIENT_POOL_INITIALIZED", {
      maxClients: this.config.maxClients,
    });
  }

  /**
   * Get a client from the pool
   */
  acquire(): SupabaseClient {
    if (!this.initialized) {
      this.initialize();
    }

    // Find an available healthy client
    const available = this.clients.find((c) => c.healthy);
    if (available) {
      available.lastUsedAt = Date.now();
      available.useCount++;
      return available.client;
    }

    // Create new client if under limit
    if (this.clients.length < this.config.maxClients) {
      const pooled = this.createClient();
      return pooled.client;
    }

    // Return least recently used client
    const lru = this.clients.sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0];
    lru.lastUsedAt = Date.now();
    lru.useCount++;
    return lru.client;
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    size: number;
    healthy: number;
    totalUses: number;
    oldestClientAge: number;
  } {
    const now = Date.now();
    return {
      size: this.clients.length,
      healthy: this.clients.filter((c) => c.healthy).length,
      totalUses: this.clients.reduce((sum, c) => sum + c.useCount, 0),
      oldestClientAge: this.clients.length > 0
        ? now - Math.min(...this.clients.map((c) => c.createdAt))
        : 0,
    };
  }

  /**
   * Cleanup idle clients
   */
  cleanup(): number {
    const now = Date.now();
    const idleThreshold = now - this.config.idleTimeoutMs;
    const initialSize = this.clients.length;

    // Keep at least one client
    this.clients = this.clients.filter((c, i) => {
      if (i === 0) return true; // Keep first client
      return c.lastUsedAt > idleThreshold;
    });

    const cleaned = initialSize - this.clients.length;
    if (cleaned > 0) {
      logStructuredEvent("CLIENT_POOL_CLEANUP", { cleaned });
    }

    return cleaned;
  }

  /**
   * Shutdown the pool
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.clients = [];
    this.initialized = false;
    logStructuredEvent("CLIENT_POOL_SHUTDOWN");
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private createClient(): PooledClient {
    const env = getEnv();
    const client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const pooled: PooledClient = {
      client,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      useCount: 0,
      healthy: true,
    };

    this.clients.push(pooled);
    return pooled;
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const pooled of this.clients) {
        try {
          const { error } = await pooled.client
            .from("profiles")
            .select("user_id")
            .limit(1);
          pooled.healthy = !error;
        } catch {
          pooled.healthy = false;
        }
      }

      // Cleanup unhealthy clients (keep at least one)
      if (this.clients.length > 1) {
        this.clients = this.clients.filter((c, i) => i === 0 || c.healthy);
      }
    }, this.config.healthCheckIntervalMs);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let poolInstance: SupabaseClientPool | null = null;

/**
 * Get the client pool instance
 */
export function getClientPool(): SupabaseClientPool {
  if (!poolInstance) {
    poolInstance = new SupabaseClientPool();
  }
  return poolInstance;
}

/**
 * Get a Supabase client from the pool
 */
export function getPooledClient(): SupabaseClient {
  return getClientPool().acquire();
}

/**
 * Quick access to Supabase client (creates if needed)
 */
export function getSupabaseClient(): SupabaseClient {
  return getPooledClient();
}

export { SupabaseClientPool };
