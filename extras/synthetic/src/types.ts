/**
 * Synthetic monitoring types.
 */

export interface ApiHealthCheck {
  id: string;
  name: string;
  url: string;
  method?: string;
  expectedStatus?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  tags?: string[];
}

export interface CheckResult {
  checkId: string;
  checkName: string;
  url: string;
  ok: boolean;
  statusCode: number;
  durationMs: number;
  error?: string;
  timestamp: Date;
  region?: string;
}

export interface UserJourneyStep {
  name: string;
  action: () => Promise<void>;
}

export interface JourneyResult {
  journeyName: string;
  passed: boolean;
  totalDurationMs: number;
  steps: StepResult[];
  failedStep?: string;
  error?: string;
}

export interface StepResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

export interface ProbeConfig {
  region: string;
  intervalMs: number;
  enabled: boolean;
}

export interface AlertConfig {
  failureThreshold: number; // consecutive failures before alert
  onAlert: (check: CheckResult) => void;
}
