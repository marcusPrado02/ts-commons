import { ChaosError, type ChaosConfig } from './types';

/**
 * ChaosMonkey injects latency and errors into application code
 * to test resilience under adverse conditions.
 */
export class ChaosMonkey {
  private _faultCount = 0;
  private readonly probability: number;
  private enabled: boolean;

  constructor(config: ChaosConfig) {
    this.probability = Math.max(0, Math.min(1, config.probability));
    this.enabled = config.enabled ?? true;
  }

  /**
   * Inject a random latency between min and max milliseconds
   * with the configured probability.
   */
  async injectLatency(minMs: number, maxMs: number): Promise<void> {
    if (!this.enabled || Math.random() >= this.probability) return;
    const delay = Math.random() * (maxMs - minMs) + minMs;
    this._faultCount++;
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Throw a ChaosError with the given errorRate probability.
   */
  injectError(errorRate: number, message = 'Simulated chaos error'): void {
    if (!this.enabled) return;
    if (Math.random() < errorRate) {
      this._faultCount++;
      throw new ChaosError(message);
    }
  }

  /**
   * Wrap an async function: inject latency before calling it,
   * then optionally inject an error after.
   */
  async wrap<T>(
    fn: () => Promise<T>,
    latencyRange: [number, number] = [0, 0],
    errorRate = 0,
  ): Promise<T> {
    await this.injectLatency(latencyRange[0], latencyRange[1]);
    this.injectError(errorRate);
    return fn();
  }

  /** Enable or disable chaos injection without changing probability. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  get faultCount(): number {
    return this._faultCount;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }
}
