export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly backoffMultiplier?: number;
  readonly maxDelayMs?: number;
}

export class Retry {
  static async execute<T>(
    fn: () => Promise<T>,
    policy: RetryPolicy,
  ): Promise<T> {
    let lastError: Error | undefined;
    let delay = policy.delayMs;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < policy.maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));

          if (policy.backoffMultiplier) {
            delay = Math.min(
              delay * policy.backoffMultiplier,
              policy.maxDelayMs ?? Infinity,
            );
          }
        }
      }
    }

    throw lastError ?? new Error('Retry failed');
  }
}
