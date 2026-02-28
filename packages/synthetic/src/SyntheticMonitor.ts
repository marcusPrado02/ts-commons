import type {
  AlertConfig,
  ApiHealthCheck,
  CheckResult,
  JourneyResult,
  StepResult,
  UserJourneyStep,
} from './types';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Runs synthetic health checks against API endpoints
 * and user journey scripts.
 */
export class SyntheticMonitor {
  private readonly checks = new Map<string, ApiHealthCheck>();
  private readonly results: CheckResult[] = [];
  private readonly failureCounts = new Map<string, number>();
  private alertConfig: AlertConfig | null = null;

  constructor(private readonly fetch: FetchFn = globalThis.fetch) {}

  /** Register an API health check. */
  addCheck(check: ApiHealthCheck): this {
    this.checks.set(check.id, check);
    return this;
  }

  /** Run a specific check and record the result. */
  async runCheck(checkId: string, region = 'default'): Promise<CheckResult> {
    const check = this.checks.get(checkId);
    if (check == null) throw new Error(`Check ${checkId} not found`);
    return this.executeCheck(check, region);
  }

  /** Run all registered checks. */
  async runAll(region = 'default'): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    for (const check of this.checks.values()) {
      const result = await this.executeCheck(check, region);
      results.push(result);
    }
    return results;
  }

  /** Run a user journey (sequence of steps). */
  async runJourney(name: string, steps: UserJourneyStep[]): Promise<JourneyResult> {
    const start = Date.now();
    const stepResults: StepResult[] = [];
    let failedStep: string | undefined;
    let error: string | undefined;

    for (const step of steps) {
      const stepStart = Date.now();
      try {
        await step.action();
        stepResults.push({ name: step.name, passed: true, durationMs: Date.now() - stepStart });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stepResults.push({
          name: step.name,
          passed: false,
          durationMs: Date.now() - stepStart,
          error: msg,
        });
        failedStep = step.name;
        error = msg;
        break;
      }
    }

    return {
      journeyName: name,
      passed: failedStep == null,
      totalDurationMs: Date.now() - start,
      steps: stepResults,
      ...(failedStep != null ? { failedStep, error } : {}),
    };
  }

  /** Configure failure alerting. */
  setAlertConfig(config: AlertConfig): void {
    this.alertConfig = config;
  }

  getResults(checkId?: string): CheckResult[] {
    if (checkId != null) {
      return this.results.filter((r) => r.checkId === checkId);
    }
    return [...this.results];
  }

  getFailureRate(checkId: string): number {
    const all = this.getResults(checkId);
    if (all.length === 0) return 0;
    return all.filter((r) => !r.ok).length / all.length;
  }

  private async executeCheck(check: ApiHealthCheck, region: string): Promise<CheckResult> {
    const start = Date.now();
    const expectedStatus = check.expectedStatus ?? 200;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), check.timeoutMs ?? 5000);
      let response: Response;
      try {
        response = await this.fetch(check.url, {
          method: check.method ?? 'GET',
          headers: check.headers,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      const ok = response.status === expectedStatus;
      const result: CheckResult = {
        checkId: check.id,
        checkName: check.name,
        url: check.url,
        ok,
        statusCode: response.status,
        durationMs: Date.now() - start,
        timestamp: new Date(),
        region,
      };
      this.recordResult(result);
      return result;
    } catch (err) {
      const result: CheckResult = {
        checkId: check.id,
        checkName: check.name,
        url: check.url,
        ok: false,
        statusCode: 0,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
        region,
      };
      this.recordResult(result);
      return result;
    }
  }

  private recordResult(result: CheckResult): void {
    this.results.push(result);
    if (!result.ok && this.alertConfig != null) {
      const failures = (this.failureCounts.get(result.checkId) ?? 0) + 1;
      this.failureCounts.set(result.checkId, failures);
      if (failures >= this.alertConfig.failureThreshold) {
        this.alertConfig.onAlert(result);
        this.failureCounts.set(result.checkId, 0);
      }
    } else if (result.ok) {
      this.failureCounts.set(result.checkId, 0);
    }
  }
}
