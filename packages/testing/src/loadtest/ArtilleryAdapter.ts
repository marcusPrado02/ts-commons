import type { ArtilleryConfig, ArtilleryPhase } from './LoadTestTypes';

/**
 * Builds Artillery load-test configuration from phases and target definitions.
 *
 * @example
 * ```typescript
 * const adapter = new ArtilleryAdapter();
 * adapter.setTarget('https://api.example.com');
 * adapter.addPhase({ duration: 60, arrivalRate: 10, rampTo: 50 });
 * const config = adapter.toConfig();
 * ```
 */
export class ArtilleryAdapter {
  private target = '';
  private readonly phases: ArtilleryPhase[] = [];
  private defaultHeaders: Record<string, string> = {};

  setTarget(url: string): void {
    this.target = url;
  }

  getTarget(): string {
    return this.target;
  }

  addPhase(phase: ArtilleryPhase): void {
    this.phases.push({ ...phase });
  }

  getPhases(): ArtilleryPhase[] {
    return this.phases.map((p) => ({ ...p }));
  }

  removePhase(index: number): boolean {
    if (index < 0 || index >= this.phases.length) return false;
    this.phases.splice(index, 1);
    return true;
  }

  setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...headers };
  }

  getDefaultHeaders(): Record<string, string> {
    return { ...this.defaultHeaders };
  }

  phaseCount(): number {
    return this.phases.length;
  }

  toConfig(): ArtilleryConfig {
    const config: ArtilleryConfig = {
      target: this.target,
      phases: this.getPhases(),
    };
    if (Object.keys(this.defaultHeaders).length > 0) {
      config.defaults = { headers: { ...this.defaultHeaders } };
    }
    return config;
  }

  private phaseToYaml(phase: ArtilleryPhase): string[] {
    const lines = [`    - duration: ${phase.duration}`, `      arrivalRate: ${phase.arrivalRate}`];
    if (phase.rampTo !== undefined) {
      lines.push(`      rampTo: ${phase.rampTo}`);
    }
    return lines;
  }

  toYaml(): string {
    const lines: string[] = [`target: '${this.target}'`, 'config:', '  phases:'];
    for (const phase of this.phases) {
      lines.push(...this.phaseToYaml(phase));
    }
    return lines.join('\n');
  }

  clear(): void {
    this.target = '';
    this.phases.splice(0, this.phases.length);
    this.defaultHeaders = {};
  }
}
