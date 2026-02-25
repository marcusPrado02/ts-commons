/**
 * Maps arbitrary correlation keys (e.g. orderId, transactionId) to
 * the internal process IDs that handle them.
 *
 * This allows inbound events carrying only a business key to be routed
 * to the correct running process.
 */
export class ProcessCorrelator {
  private readonly map = new Map<string, string>();

  /** Associate a correlation key with a process ID. */
  register(correlationId: string, processId: string): void {
    this.map.set(correlationId, processId);
  }

  /** Look up the process ID for a correlation key. Returns `undefined` if unknown. */
  resolve(correlationId: string): string | undefined {
    return this.map.get(correlationId);
  }

  /** Remove the mapping for a correlation key. No-op if not registered. */
  deregister(correlationId: string): void {
    this.map.delete(correlationId);
  }

  /** True if the correlation key is currently registered. */
  has(correlationId: string): boolean {
    return this.map.has(correlationId);
  }

  /** Number of registered correlations. */
  size(): number {
    return this.map.size;
  }
}
