import type { BurnRateAlert, ErrorBudget, SliProvider, SloConfig, SloStatus } from './types';

type AlertHandler = (alert: BurnRateAlert) => void;

/**
 * SLO tracker — evaluates SLO compliance, error budget and burn rate.
 */
export class SloTracker {
  private readonly sliHistory: Map<string, number[]> = new Map();
  private readonly alertHandlers: AlertHandler[] = [];
  private burnRateThreshold: number;

  constructor(
    private readonly config: SloConfig,
    private readonly sliProvider: SliProvider,
    burnRateThreshold = 2.0,
  ) {
    this.burnRateThreshold = burnRateThreshold;
  }

  /** Collect a new SLI measurement and evaluate the SLO. */
  async evaluate(): Promise<SloStatus> {
    const value = await this.sliProvider.measure();
    const history = this.getHistory();
    history.push(value);
    this.sliHistory.set(this.config.sliName, history);

    const currentSli = value;
    const met = currentSli >= this.config.target;
    const errorBudget = this.calcErrorBudget(history);
    const burnRate = this.calcBurnRate(history, errorBudget);

    if (burnRate.firing) {
      for (const h of this.alertHandlers) h(burnRate);
    }

    return { slo: this.config, currentSli, met, errorBudget, burnRate };
  }

  /** Register a burn-rate alert handler. Returns unsubscribe fn. */
  onBurnRateAlert(handler: AlertHandler): () => void {
    this.alertHandlers.push(handler);
    return () => {
      const idx = this.alertHandlers.indexOf(handler);
      if (idx >= 0) this.alertHandlers.splice(idx, 1);
    };
  }

  /** Set a custom burn rate threshold (default 2.0 = 2× normal consumption). */
  setBurnRateThreshold(threshold: number): void {
    this.burnRateThreshold = threshold;
  }

  private getHistory(): number[] {
    return this.sliHistory.get(this.config.sliName) ?? [];
  }

  private calcErrorBudget(history: number[]): ErrorBudget {
    if (history.length === 0) {
      return {
        sloName: this.config.name,
        target: this.config.target,
        consumed: 0,
        remaining: 1,
        exhausted: false,
      };
    }
    const avg = history.reduce((s, v) => s + v, 0) / history.length;
    const allowedError = (100 - this.config.target) / 100;
    const actualError = (100 - avg) / 100;
    const consumed =
      allowedError > 0 ? Math.min(1, actualError / allowedError) : actualError > 0 ? 1 : 0;
    const remaining = Math.max(0, 1 - consumed);
    return {
      sloName: this.config.name,
      target: this.config.target,
      consumed,
      remaining,
      exhausted: consumed >= 1,
    };
  }

  private calcBurnRate(history: number[], budget: ErrorBudget): BurnRateAlert {
    const burnRate = budget.consumed > 0 ? budget.consumed * history.length : 0;
    const normalised = history.length > 0 ? burnRate / history.length : 0;
    return {
      sloName: this.config.name,
      burnRate: normalised,
      threshold: this.burnRateThreshold,
      firing: normalised > this.burnRateThreshold,
      timestamp: new Date(),
    };
  }
}
