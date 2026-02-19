/**
 * Lightweight wall-clock timer for asserting performance budgets in tests.
 *
 * @example
 * ```typescript
 * const t = PerformanceTimer.start();
 * await doSomething();
 * t.assertUnder(200, 'doSomething');
 * ```
 */
export class PerformanceTimer {
  private startMs: number;

  private constructor() {
    this.startMs = Date.now();
  }

  /** Creates and immediately starts a new timer. */
  static start(): PerformanceTimer {
    return new PerformanceTimer();
  }

  /** Returns milliseconds elapsed since the timer was started (or last reset). */
  elapsed(): number {
    return Date.now() - this.startMs;
  }

  /** Resets the timer's start point to now. */
  reset(): void {
    this.startMs = Date.now();
  }

  /**
   * Asserts that the elapsed time is within `budgetMs`.
   * Throws an `Error` if the budget is exceeded.
   *
   * @param budgetMs - Maximum allowed duration in milliseconds.
   * @param label    - Optional label included in the error message.
   */
  assertUnder(budgetMs: number, label = ''): void {
    const elapsed = this.elapsed();
    if (elapsed > budgetMs) {
      const suffix = label.length > 0 ? ` [${label}]` : '';
      throw new Error(
        `Performance budget exceeded${suffix}: ${elapsed}ms > ${budgetMs}ms`,
      );
    }
  }
}

/**
 * Runs an async function and returns its result together with the elapsed time.
 *
 * @example
 * ```typescript
 * const { result, elapsedMs } = await measureAsync(() => fetchUser(id));
 * expect(elapsedMs).toBeLessThan(100);
 * ```
 */
export async function measureAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; elapsedMs: number }> {
  const timer = PerformanceTimer.start();
  const result = await fn();
  return { result, elapsedMs: timer.elapsed() };
}
