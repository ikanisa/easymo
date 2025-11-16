/**
 * Structured logging utility for Node.js scripts
 * 
 * Provides JSON-formatted logging for deployment-critical scripts
 * following EasyMO observability ground rules.
 * 
 * @see docs/GROUND_RULES.md for usage guidelines
 */

/**
 * Log levels
 * @typedef {'debug' | 'info' | 'warn' | 'error'} LogLevel
 */

/**
 * Log a structured event with consistent formatting
 * 
 * @param {string} event - Event name (use ENTITY_ACTION format, e.g., "CHECK_PASSED")
 * @param {Record<string, unknown>} details - Structured event data
 * @param {LogLevel} level - Log level (default: info)
 * 
 * @example
 * logStructuredEvent("ENV_CHECK_PASSED", {
 *   variables: ["VAR1", "VAR2"],
 *   count: 2
 * });
 */
export function logStructuredEvent(event, details = {}, level = "info") {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    event,
    level,
    script: process.argv[1]?.split('/').pop() || 'unknown',
    ...details,
  };

  const output = JSON.stringify(logData);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "debug":
      console.debug(output);
      break;
    default:
      console.log(output);
  }
}

/**
 * Log an error with context
 * 
 * @param {string} scope - Error scope/category
 * @param {Error | string} error - Error object or message
 * @param {Record<string, unknown>} context - Additional context data
 * 
 * @example
 * logError("env_validation", error, {
 *   missingVars: ["VAR1", "VAR2"]
 * });
 */
export function logError(scope, error, context = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logStructuredEvent(
    `ERROR_${scope.toUpperCase()}`,
    {
      scope,
      error: message,
      stack,
      ...context,
    },
    "error",
  );
}

/**
 * Record a metric/counter
 * 
 * @param {string} name - Metric name (use dot notation, e.g., "check.passed")
 * @param {number} value - Metric value (default: 1 for counters)
 * @param {Record<string, string | number | boolean>} dimensions - Additional dimensions
 * 
 * @example
 * recordMetric("endpoint.checked", 1, {
 *   path: "/login",
 *   status: 200
 * });
 */
export function recordMetric(name, value = 1, dimensions = {}) {
  const normalizedDimensions = Object.fromEntries(
    Object.entries(dimensions)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, String(v)])
  );

  logStructuredEvent(
    "METRIC",
    {
      metric: name,
      value,
      dimensions: normalizedDimensions,
    },
    "info",
  );
}

/**
 * Record a duration metric
 * 
 * @param {string} name - Metric name
 * @param {number} startedAt - Start timestamp (from Date.now())
 * @param {Record<string, string | number | boolean>} dimensions - Additional dimensions
 * 
 * @example
 * const startTime = Date.now();
 * // ... perform operation ...
 * recordDurationMetric("check.duration", startTime, {
 *   check: "env_validation"
 * });
 */
export function recordDurationMetric(name, startedAt, dimensions = {}) {
  const durationMs = Date.now() - startedAt;
  recordMetric(name, durationMs, { ...dimensions, unit: "ms" });
}
