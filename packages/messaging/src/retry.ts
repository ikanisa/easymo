import { RetryExhaustedError } from "./errors.js";

export type RetryPolicyOptions = {
  attempts: number;
  backoffMs?: number;
  backoffMultiplier?: number;
  jitterMs?: number;
};

export class RetryPolicy {
  private readonly options: Required<RetryPolicyOptions>;

  constructor(options: RetryPolicyOptions) {
    this.options = {
      attempts: options.attempts,
      backoffMs: options.backoffMs ?? 250,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      jitterMs: options.jitterMs ?? 100,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let delay = this.options.backoffMs;
    for (let attempt = 0; attempt < this.options.attempts; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === this.options.attempts - 1) {
          throw new RetryExhaustedError(`Retry exhausted after ${this.options.attempts} attempts: ${(error as Error).message}`);
        }
        const jitter = Math.random() * this.options.jitterMs;
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
        delay *= this.options.backoffMultiplier;
      }
    }
    throw new RetryExhaustedError("Retry exhausted without executing function");
  }
}
