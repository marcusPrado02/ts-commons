/**
 * Chaos engineering types.
 */

export interface ChaosConfig {
  /** Probability (0–1) of injecting a fault */
  probability: number;
  /** Whether chaos is globally enabled */
  enabled?: boolean;
}

export class ChaosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChaosError';
  }
}

export interface ChaosExperiment {
  readonly id: string;
  readonly name: string;
  run(): Promise<ExperimentResult>;
}

export interface ExperimentResult {
  experimentId: string;
  success: boolean;
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface NetworkChaosOptions {
  /** Latency to add in milliseconds */
  latencyMs: number;
  /** Random jitter range ±jitterMs */
  jitterMs?: number;
  /** Packet loss probability (0–1) */
  packetLossRate?: number;
}

export interface ResourceExhaustionOptions {
  /** Max memory usage to simulate (bytes) */
  maxMemoryBytes?: number;
  /** CPU burn duration (ms) */
  cpuBurnMs?: number;
}
