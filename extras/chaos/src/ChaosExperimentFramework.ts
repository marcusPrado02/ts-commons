import type { ChaosExperiment, ExperimentResult } from './types';

export interface ExperimentSchedule {
  experiment: ChaosExperiment;
  intervalMs: number;
  maxRuns?: number;
}

export interface FrameworkResult {
  experimentId: string;
  name: string;
  results: ExperimentResult[];
  successRate: number;
  avgDurationMs: number;
  totalRuns: number;
}

/**
 * ChaosExperimentFramework orchestrates running chaos experiments
 * and collecting their results.
 */
export class ChaosExperimentFramework {
  private readonly experiments = new Map<string, ChaosExperiment>();
  private readonly results = new Map<string, ExperimentResult[]>();
  private enabled = true;

  /** Register an experiment. */
  register(experiment: ChaosExperiment): this {
    this.experiments.set(experiment.id, experiment);
    return this;
  }

  /** Run a single experiment by id and record result. */
  async run(experimentId: string): Promise<ExperimentResult> {
    const exp = this.experiments.get(experimentId);
    if (exp == null) throw new Error(`Experiment ${experimentId} not found`);
    if (!this.enabled) {
      return {
        experimentId,
        success: true,
        durationMs: 0,
        details: { skipped: true, reason: 'framework disabled' },
      };
    }
    const result = await exp.run();
    const existing = this.results.get(experimentId) ?? [];
    existing.push(result);
    this.results.set(experimentId, existing);
    return result;
  }

  /** Run all registered experiments sequentially. */
  async runAll(): Promise<FrameworkResult[]> {
    const results: FrameworkResult[] = [];
    for (const exp of this.experiments.values()) {
      await this.run(exp.id);
      results.push(this.getSummary(exp.id));
    }
    return results;
  }

  getSummary(experimentId: string): FrameworkResult {
    const exp = this.experiments.get(experimentId);
    if (exp == null) throw new Error(`Experiment ${experimentId} not found`);
    const runs = this.results.get(experimentId) ?? [];
    const successCount = runs.filter((r) => r.success).length;
    const totalDuration = runs.reduce((sum, r) => sum + r.durationMs, 0);
    return {
      experimentId,
      name: exp.name,
      results: runs,
      successRate: runs.length === 0 ? 0 : successCount / runs.length,
      avgDurationMs: runs.length === 0 ? 0 : totalDuration / runs.length,
      totalRuns: runs.length,
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get experimentCount(): number {
    return this.experiments.size;
  }
}
