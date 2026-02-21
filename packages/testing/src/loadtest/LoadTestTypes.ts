/**
 * Shared types for the load testing framework (Item 51).
 */

/** A single stage in a load test ramp-up / ramp-down sequence. */
export interface LoadStage {
  durationSeconds: number;
  targetVus: number;
}

/** A threshold rule for a k6 metric. */
export interface ThresholdRule {
  metric: string;
  condition: string;
}

/** Top-level load test options (k6-style). */
export interface LoadTestOptions {
  stages: LoadStage[];
  thresholds?: ThresholdRule[];
}

/** Aggregated result from a load test run. */
export interface LoadTestResult {
  passedChecks: number;
  failedChecks: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  errorRate: number;
}

/** A single HTTP assertion to run against a response. */
export interface HttpCheck {
  name: string;
  expect: 'status' | 'body' | 'header';
  value: number | string;
}

/** Full configuration for a load-test scenario. */
export interface LoadTestScenarioConfig {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  checks?: HttpCheck[];
}

/** An Artillery load phase. */
export interface ArtilleryPhase {
  duration: number;
  arrivalRate: number;
  rampTo?: number;
}

/** Top-level Artillery YAML configuration. */
export interface ArtilleryConfig {
  target: string;
  phases: ArtilleryPhase[];
  defaults?: { headers?: Record<string, string> };
}
