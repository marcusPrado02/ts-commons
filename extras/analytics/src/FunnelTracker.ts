import type { FunnelStep, FunnelResult } from './types.js';

/**
 * Tracks multi-step conversion funnels on a per-user basis.
 *
 * @example
 * ```ts
 * const tracker = new FunnelTracker();
 * tracker.createFunnel('onboarding', ['signup', 'verify-email', 'profile-complete']);
 *
 * tracker.recordStep('onboarding', 'user-1', 'signup');
 * tracker.recordStep('onboarding', 'user-1', 'verify-email');
 *
 * const result = tracker.getResult('onboarding', 'user-1');
 * // → { completedSteps: 2, totalSteps: 3, conversionRate: 0.666... }
 * ```
 */
export class FunnelTracker {
  /** funnel name → ordered step names */
  private readonly funnels = new Map<string, string[]>();
  /** `${funnelName}:${userId}` → step name → completion date */
  private readonly completions = new Map<string, Map<string, Date>>();

  /**
   * Define a named funnel with an ordered list of step names.
   * Re-defining a funnel with the same name replaces the previous definition.
   */
  createFunnel(name: string, steps: string[]): void {
    this.funnels.set(name, [...steps]);
  }

  /** Number of defined funnels. */
  funnelCount(): number {
    return this.funnels.size;
  }

  /**
   * Record that `userId` has completed `stepName` in `funnelName`.
   * If the step is already recorded, the timestamp is updated.
   *
   * @throws {Error} if the funnel is not defined.
   * @throws {Error} if the step does not belong to the funnel.
   */
  recordStep(funnelName: string, userId: string, stepName: string): void {
    const steps = this.funnels.get(funnelName);
    if (steps === undefined) {
      throw new Error(`Funnel "${funnelName}" is not defined`);
    }
    if (!steps.includes(stepName)) {
      throw new Error(`Step "${stepName}" is not part of funnel "${funnelName}"`);
    }

    const key = this.completionKey(funnelName, userId);
    if (!this.completions.has(key)) {
      this.completions.set(key, new Map());
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.completions.get(key)!.set(stepName, new Date());
  }

  /**
   * Get the current funnel progress for a user.
   *
   * @throws {Error} if the funnel is not defined.
   */
  getResult(funnelName: string, userId: string): FunnelResult {
    const stepNames = this.funnels.get(funnelName);
    if (stepNames === undefined) {
      throw new Error(`Funnel "${funnelName}" is not defined`);
    }

    const key = this.completionKey(funnelName, userId);
    const userCompletions = this.completions.get(key) ?? new Map<string, Date>();

    const steps: FunnelStep[] = stepNames.map((name) => {
      const completedAt = userCompletions.get(name);
      return completedAt !== undefined ? { name, completedAt } : { name };
    });

    const completedSteps = steps.filter((s) => s.completedAt !== undefined).length;
    const totalSteps = steps.length;
    const conversionRate = totalSteps === 0 ? 1 : completedSteps / totalSteps;

    return {
      funnelName,
      steps,
      completedSteps,
      totalSteps,
      conversionRate,
      completed: totalSteps > 0 && completedSteps === totalSteps,
    };
  }

  /**
   * Reset all recorded completions for a specific user in a funnel.
   */
  resetUser(funnelName: string, userId: string): void {
    this.completions.delete(this.completionKey(funnelName, userId));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private completionKey(funnelName: string, userId: string): string {
    return `${funnelName}:${userId}`;
  }
}
