/**
 * Fallback pattern: executes a primary operation and falls back to a secondary
 * on any failure. Errors from the fallback propagate as-is.
 */
export class Fallback {
  /**
   * Try primary; if it throws/rejects, return the result of `fallback`.
   */
  static async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    try {
      return await primary();
    } catch {
      return fallback();
    }
  }

  /**
   * Try primary; if it throws/rejects, return `defaultValue` synchronously.
   */
  static async withDefault<T>(
    primary: () => Promise<T>,
    defaultValue: T,
  ): Promise<T> {
    try {
      return await primary();
    } catch {
      return defaultValue;
    }
  }
}
