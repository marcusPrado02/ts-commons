export interface SliResult {
  readonly name: string;
  readonly value: number; // 0–100 percentage
  readonly timestamp: Date;
}

export interface SloConfig {
  readonly name: string;
  /** Which SLI this SLO is based on */
  readonly sliName: string;
  /** Target percentage (e.g. 99.9) */
  readonly target: number;
  /** Rolling window in milliseconds */
  readonly windowMs: number;
}

export interface ErrorBudget {
  readonly sloName: string;
  readonly target: number;
  readonly consumed: number; // fraction 0–1
  readonly remaining: number; // fraction 0–1
  readonly exhausted: boolean;
}

export interface BurnRateAlert {
  readonly sloName: string;
  /** Current burn rate (e.g. 1.0 = consuming at exactly the budgeted rate) */
  readonly burnRate: number;
  /** Threshold above which an alert fires */
  readonly threshold: number;
  readonly firing: boolean;
  readonly timestamp: Date;
}

export interface SloStatus {
  readonly slo: SloConfig;
  readonly currentSli: number;
  readonly met: boolean;
  readonly errorBudget: ErrorBudget;
  readonly burnRate: BurnRateAlert;
}

/** Pluggable SLI implementation */
export interface SliProvider {
  readonly name: string;
  measure(): Promise<number>;
}
