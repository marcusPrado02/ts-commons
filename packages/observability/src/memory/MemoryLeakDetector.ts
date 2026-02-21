import type { HeapSnapshot, LeakRecord } from './MemoryTypes';

/** Minimum snapshots needed before detecting a leak trend. */
const MIN_SAMPLES_FOR_DETECTION = 3;

function isConsistentGrowth(snapshots: HeapSnapshot[]): boolean {
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    if (prev === undefined || curr === undefined) return false;
    if (curr.heapUsedBytes <= prev.heapUsedBytes) return false;
  }
  return true;
}

/**
 * Analyses a series of heap snapshots to detect consistent upward memory
 * growth patterns that may indicate a leak.
 *
 * @example
 * ```typescript
 * const detector = new MemoryLeakDetector(10_000); // 10 KB threshold
 * snapshots.forEach(s => detector.observe(s));
 * const leaks = detector.getLeaks();
 * ```
 */
export class MemoryLeakDetector {
  private readonly observations: HeapSnapshot[] = [];
  private readonly leaks: LeakRecord[] = [];
  private readonly growthThresholdBytes: number;

  constructor(growthThresholdBytes = 5 * 1024 * 1024) {
    this.growthThresholdBytes = growthThresholdBytes;
  }

  /** Feed a new snapshot for analysis. */
  observe(snapshot: HeapSnapshot): void {
    this.observations.push(snapshot);
    this.evaluate();
  }

  private evaluate(): void {
    const n = this.observations.length;
    if (n < MIN_SAMPLES_FOR_DETECTION) return;

    const window = this.observations.slice(-MIN_SAMPLES_FOR_DETECTION);
    const first = window[0];
    const last = window[MIN_SAMPLES_FOR_DETECTION - 1];
    if (first === undefined || last === undefined) return;

    const growth = last.heapUsedBytes - first.heapUsedBytes;
    if (growth >= this.growthThresholdBytes && isConsistentGrowth(window)) {
      this.leaks.push({
        detectedAt: new Date(),
        growthBytes: growth,
        snapshotCount: n,
        message: `Consistent heap growth of ${growth} bytes over ${MIN_SAMPLES_FOR_DETECTION} observations`,
      });
    }
  }

  /** All recorded leak events. */
  getLeaks(): LeakRecord[] {
    return [...this.leaks];
  }

  hasLeaks(): boolean {
    return this.leaks.length > 0;
  }

  leakCount(): number {
    return this.leaks.length;
  }

  observationCount(): number {
    return this.observations.length;
  }

  getGrowthThresholdBytes(): number {
    return this.growthThresholdBytes;
  }

  clear(): void {
    this.observations.splice(0, this.observations.length);
    this.leaks.splice(0, this.leaks.length);
  }
}
