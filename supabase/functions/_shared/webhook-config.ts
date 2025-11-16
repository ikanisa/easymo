/**
 * WhatsApp Webhook Configuration
 * 
 * Centralized configuration for webhook processing including timeouts,
 * retry policies, circuit breakers, and deduplication settings.
 * 
 * @module webhook-config
 */

/**
 * Timeout configuration for different operation types
 */
export const WEBHOOK_TIMEOUTS = {
  /** Default timeout for normal webhook operations (30 seconds) */
  default: 30000,
  
  /** Timeout for AI agent operations (2 minutes) */
  aiAgent: 120000,
  
  /** Timeout for payment operations (1 minute) */
  payment: 60000,
  
  /** Timeout for external API calls (30 seconds) */
  externalApi: 30000,
  
  /** Timeout for database operations (10 seconds) */
  database: 10000,
  
  /** Timeout for media upload/download (5 minutes) */
  media: 300000,
} as const;

/**
 * Retry policy configuration
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  maxAttempts: 3,
  
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: 2,
  
  /** Initial delay in milliseconds before first retry */
  initialDelayMs: 1000,
  
  /** Maximum delay between retries */
  maxDelayMs: 30000,
  
  /** Jitter factor (0-1) to add randomness to backoff */
  jitterFactor: 0.1,
} as const;

/**
 * Circuit breaker configuration for external services
 */
export const CIRCUIT_BREAKER_CONFIG = {
  /** Failure threshold percentage before opening circuit (0-100) */
  failureThreshold: 50,
  
  /** Time in milliseconds to wait before attempting to close circuit */
  resetTimeoutMs: 60000,
  
  /** Number of requests to allow in half-open state */
  halfOpenRequests: 3,
  
  /** Minimum number of requests before evaluating error rate */
  volumeThreshold: 5,
  
  /** Request timeout in milliseconds */
  timeoutMs: 30000,
} as const;

/**
 * Circuit breaker configuration for AI agents (more lenient)
 */
export const AI_AGENT_CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 60, // AI agents can have higher failure tolerance
  resetTimeoutMs: 120000, // 2 minutes
  halfOpenRequests: 2,
  volumeThreshold: 3,
  timeoutMs: 120000, // 2 minutes for AI processing
} as const;

/**
 * Message deduplication configuration
 */
export const DEDUPLICATION_CONFIG = {
  /** Time window in milliseconds for deduplication (5 minutes) */
  windowMs: 300000,
  
  /** Storage key prefix for deduplication cache */
  storageKey: "processed_messages",
  
  /** Enable deduplication by default */
  enabled: true,
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT_CONFIG = {
  /** Maximum requests per user per minute */
  perUserPerMinute: 30,
  
  /** Maximum requests per IP per minute */
  perIpPerMinute: 100,
  
  /** Maximum concurrent processing per user */
  maxConcurrentPerUser: 3,
  
  /** Burst allowance (extra requests allowed in short bursts) */
  burstAllowance: 10,
} as const;

/**
 * Workflow timeout configuration
 */
export const WORKFLOW_TIMEOUTS = {
  /** Order workflow timeout (15 minutes) */
  order: 900000,
  
  /** Payment workflow timeout (10 minutes) */
  payment: 600000,
  
  /** Job application workflow timeout (30 minutes) */
  job_application: 1800000,
  
  /** Property inquiry workflow timeout (1 hour) */
  property_inquiry: 3600000,
  
  /** Ride request workflow timeout (5 minutes) */
  ride_request: 300000,
  
  /** Insurance claim workflow timeout (1 hour) */
  insurance_claim: 3600000,
  
  /** Default workflow timeout (30 minutes) */
  default: 1800000,
} as const;

/**
 * AI Agent specific configuration
 */
export const AI_AGENT_CONFIG = {
  /** Maximum conversation history length to keep */
  maxHistoryLength: 20,
  
  /** Maximum token count before truncating history */
  maxTokenCount: 4000,
  
  /** Session timeout in milliseconds (30 minutes) */
  sessionTimeoutMs: 1800000,
  
  /** Maximum concurrent AI requests per user */
  maxConcurrentRequests: 2,
  
  /** Enable context persistence */
  persistContext: true,
  
  /** Context TTL in milliseconds (24 hours) */
  contextTtlMs: 86400000,
} as const;

/**
 * Message queue configuration
 */
export const MESSAGE_QUEUE_CONFIG = {
  /** Maximum queue size before rejecting new messages */
  maxQueueSize: 10000,
  
  /** Message processing timeout (5 minutes) */
  processingTimeoutMs: 300000,
  
  /** Batch size for processing messages */
  batchSize: 10,
  
  /** Polling interval in milliseconds */
  pollIntervalMs: 1000,
  
  /** Enable priority processing */
  enablePriority: true,
  
  /** Retention period for completed messages (7 days) */
  retentionDays: 7,
} as const;

/**
 * Health check configuration
 */
export const HEALTH_CHECK_CONFIG = {
  /** Interval for checking service health (30 seconds) */
  intervalMs: 30000,
  
  /** Timeout for health check requests (3 seconds) */
  timeoutMs: 3000,
  
  /** Number of consecutive failures before marking unhealthy */
  failureThreshold: 3,
  
  /** Enable automatic recovery checks */
  enableAutoRecovery: true,
} as const;

/**
 * Observability configuration
 */
export const OBSERVABILITY_CONFIG = {
  /** Enable structured logging */
  enableStructuredLogging: true,
  
  /** Enable metrics collection */
  enableMetrics: true,
  
  /** Enable distributed tracing */
  enableTracing: true,
  
  /** Sample rate for traces (0-1) */
  traceSampleRate: 0.1,
  
  /** Log level for production */
  logLevel: "info" as const,
  
  /** Mask PII in logs */
  maskPII: true,
} as const;

/**
 * Get timeout for specific workflow type
 * 
 * @param workflowType - Type of workflow
 * @returns Timeout in milliseconds
 */
export function getWorkflowTimeout(
  workflowType: keyof typeof WORKFLOW_TIMEOUTS | string
): number {
  return (WORKFLOW_TIMEOUTS as any)[workflowType] || WORKFLOW_TIMEOUTS.default;
}

/**
 * Calculate retry delay with exponential backoff and jitter
 * 
 * @param attempt - Current attempt number (0-indexed)
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(attempt: number): number {
  const baseDelay = RETRY_CONFIG.initialDelayMs * 
    Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  
  const delayWithCap = Math.min(baseDelay, RETRY_CONFIG.maxDelayMs);
  
  // Add jitter to prevent thundering herd
  const jitter = delayWithCap * RETRY_CONFIG.jitterFactor * Math.random();
  
  return Math.floor(delayWithCap + jitter);
}

/**
 * Check if a message should be deduplicated
 * 
 * @param messageId - WhatsApp message ID
 * @param processedMessages - Set of recently processed message IDs
 * @returns True if message should be processed
 */
export function shouldProcessMessage(
  messageId: string,
  processedMessages: Set<string>
): boolean {
  if (!DEDUPLICATION_CONFIG.enabled) {
    return true;
  }
  
  return !processedMessages.has(messageId);
}

/**
 * Complete webhook configuration object
 */
export const WEBHOOK_CONFIG = {
  timeouts: WEBHOOK_TIMEOUTS,
  retry: RETRY_CONFIG,
  circuitBreaker: CIRCUIT_BREAKER_CONFIG,
  aiAgentCircuitBreaker: AI_AGENT_CIRCUIT_BREAKER_CONFIG,
  deduplication: DEDUPLICATION_CONFIG,
  rateLimit: RATE_LIMIT_CONFIG,
  workflow: WORKFLOW_TIMEOUTS,
  aiAgent: AI_AGENT_CONFIG,
  messageQueue: MESSAGE_QUEUE_CONFIG,
  healthCheck: HEALTH_CHECK_CONFIG,
  observability: OBSERVABILITY_CONFIG,
} as const;

export default WEBHOOK_CONFIG;
