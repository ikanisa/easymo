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
    let attempt = 0;
    let delay = this.options.backoffMs;
    while (true) {
      try {
        return await fn();
      } catch (error) {
        attempt += 1;
        if (attempt >= this.options.attempts) {
          throw new RetryExhaustedError(`Retry exhausted after ${attempt} attempts: ${(error as Error).message}`);
        }
        const jitter = Math.random() * this.options.jitterMs;
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
        delay *= this.options.backoffMultiplier;
      }
    }
  }
}
