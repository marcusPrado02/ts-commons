import type { RetentionPolicy, RetentionResult, TimeSeriesAdapter } from './types.js';

/**
 * Registry and coordinator for {@link RetentionPolicy} objects.
 *
 * Policies are stored in-memory by name and can be selectively applied to
 * any {@link TimeSeriesAdapter}.
 *
 * @example
 * ```ts
 * const mgr = new RetentionPolicyManager();
 * mgr.register({ name: '30d', measurement: 'cpu', durationMs: 30 * 24 * 3600_000 });
 * const results = await mgr.applyAll(adapter);
 * ```
 */
export class RetentionPolicyManager {
  private readonly policies = new Map<string, RetentionPolicy>();

  /** Register or overwrite a retention policy. */
  register(policy: RetentionPolicy): void {
    this.policies.set(policy.name, policy);
  }

  /** Return all registered policies (insertion order). */
  list(): RetentionPolicy[] {
    return [...this.policies.values()];
  }

  /** Look up a policy by name; returns `undefined` if not found. */
  get(name: string): RetentionPolicy | undefined {
    return this.policies.get(name);
  }

  /** Remove a policy by name. Returns `true` if it existed. */
  remove(name: string): boolean {
    return this.policies.delete(name);
  }

  /** Apply a single policy via the given adapter. */
  async apply(adapter: TimeSeriesAdapter, policy: RetentionPolicy): Promise<RetentionResult> {
    return adapter.applyRetentionPolicy(policy);
  }

  /**
   * Apply **all** registered policies via the given adapter.
   * Results are returned in the order policies were registered.
   */
  async applyAll(adapter: TimeSeriesAdapter): Promise<RetentionResult[]> {
    const results: RetentionResult[] = [];
    for (const policy of this.policies.values()) {
      results.push(await adapter.applyRetentionPolicy(policy));
    }
    return results;
  }
}
