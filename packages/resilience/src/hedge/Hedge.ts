export interface HedgeOptions {
  /** Number of parallel copies to launch (default: 2). */
  copies?: number;
  /** Delay in ms between launching each successive copy (default: 100). */
  delayMs?: number;
}

/**
 * Hedge pattern (speculative execution): launches multiple copies of the same
 * operation with a configurable staggered delay.  The first copy to fulfill
 * wins; if every copy rejects the last rejection is propagated.
 *
 * Pending timer count is tracked so that a fast rejection from the first copy
 * does not prematurely settle the promise while later copies could still succeed.
 */
export class Hedge {
  // eslint-disable-next-line max-lines-per-function
  static execute<T>(fn: () => Promise<T>, options: HedgeOptions = {}): Promise<T> {
    const copies = options.copies ?? 2;
    const delayMs = options.delayMs ?? 100;

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let pending = 0;
      let timersPending = copies - 1; // decremented as each timer fires
      let lastError: unknown;

      const tryReject = (): void => {
        if (pending === 0 && timersPending === 0 && !settled) {
          settled = true;
          reject(lastError instanceof Error ? lastError : new Error(String(lastError)));
        }
      };

      const launch = (): void => {
        pending++;
        fn().then(
          (value) => {
            if (!settled) {
              settled = true;
              resolve(value);
            }
          },
          (err: unknown) => {
            lastError = err;
            pending--;
            tryReject();
          },
        );
      };

      // First copy launches immediately
      launch();

      // Subsequent copies launch after staggered delays
      for (let i = 1; i < copies; i++) {
        const delay = delayMs * i;
        setTimeout(() => {
          timersPending--;
          if (!settled) {
            launch();
          } else {
            tryReject();
          }
        }, delay);
      }
    });
  }
}
