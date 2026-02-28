import { randomUUID } from 'node:crypto';
import type {
  ChaosExperiment,
  ExperimentResult,
  NetworkChaosOptions,
  ResourceExhaustionOptions,
} from './types';

/**
 * Network chaos experiment — simulates latency and packet loss.
 */
export class NetworkChaosExperiment implements ChaosExperiment {
  readonly id: string;
  readonly name: string;
  private readonly options: Required<NetworkChaosOptions>;

  constructor(name: string, options: NetworkChaosOptions) {
    this.id = randomUUID();
    this.name = name;
    this.options = {
      latencyMs: options.latencyMs,
      jitterMs: options.jitterMs ?? 0,
      packetLossRate: options.packetLossRate ?? 0,
    };
  }

  async run(): Promise<ExperimentResult> {
    const start = Date.now();
    try {
      const jitter = (Math.random() * 2 - 1) * this.options.jitterMs;
      const actualLatency = Math.max(0, this.options.latencyMs + jitter);
      await new Promise<void>((resolve) => setTimeout(resolve, actualLatency));

      const lostPacket = Math.random() < this.options.packetLossRate;
      return {
        experimentId: this.id,
        success: !lostPacket,
        durationMs: Date.now() - start,
        details: {
          actualLatencyMs: actualLatency,
          packetLost: lostPacket,
          jitterMs: jitter,
        },
      };
    } catch (err) {
      return {
        experimentId: this.id,
        success: false,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/**
 * Service failure experiment — simulates a service going down.
 */
export class ServiceFailureExperiment implements ChaosExperiment {
  readonly id: string;
  readonly name: string;

  constructor(
    name: string,
    private readonly failureRate: number = 1.0,
    private readonly errorMessage = 'Service unavailable',
  ) {
    this.id = randomUUID();
    this.name = name;
  }

  async run(): Promise<ExperimentResult> {
    const start = Date.now();
    const failed = Math.random() < this.failureRate;
    // Simulate minimal processing time
    await new Promise<void>((resolve) => setTimeout(resolve, 1));
    return {
      experimentId: this.id,
      success: !failed,
      durationMs: Date.now() - start,
      error: failed ? this.errorMessage : undefined,
      details: { failureRate: this.failureRate, failed },
    };
  }
}

/**
 * Resource exhaustion experiment — burns CPU cycles.
 */
export class ResourceExhaustionExperiment implements ChaosExperiment {
  readonly id: string;
  readonly name: string;
  private readonly options: Required<ResourceExhaustionOptions>;

  constructor(name: string, options: ResourceExhaustionOptions = {}) {
    this.id = randomUUID();
    this.name = name;
    this.options = {
      maxMemoryBytes: options.maxMemoryBytes ?? 0,
      cpuBurnMs: options.cpuBurnMs ?? 10,
    };
  }

  async run(): Promise<ExperimentResult> {
    const start = Date.now();
    // CPU burn loop
    const burnEnd = Date.now() + this.options.cpuBurnMs;
    let iterations = 0;
    while (Date.now() < burnEnd) {
      iterations++;
    }
    // Memory allocation
    let allocated = 0;
    if (this.options.maxMemoryBytes > 0) {
      const buf = Buffer.alloc(Math.min(this.options.maxMemoryBytes, 1024 * 1024));
      allocated = buf.byteLength;
    }
    await Promise.resolve(); // yield to event loop
    return {
      experimentId: this.id,
      success: true,
      durationMs: Date.now() - start,
      details: { iterations, allocatedBytes: allocated },
    };
  }
}
