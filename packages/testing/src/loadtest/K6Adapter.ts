import type { LoadTestOptions, ThresholdRule, LoadTestScenarioConfig } from './LoadTestTypes';

/**
 * Builds k6 load-test scripts from scenario and options objects.
 *
 * @example
 * ```typescript
 * const adapter = new K6Adapter();
 * adapter.setOptions({ stages: [{ durationSeconds: 30, targetVus: 100 }] });
 * const script = adapter.toScript(scenario);
 * ```
 */
export class K6Adapter {
  private options: LoadTestOptions = { stages: [] };

  setOptions(options: LoadTestOptions): void {
    this.options = {
      stages: [...options.stages],
      ...(options.thresholds !== undefined && { thresholds: options.thresholds }),
    };
  }

  getOptions(): LoadTestOptions {
    return {
      stages: [...this.options.stages],
      ...(this.options.thresholds !== undefined && { thresholds: this.options.thresholds }),
    };
  }

  addThreshold(rule: ThresholdRule): void {
    const existing = this.options.thresholds ?? [];
    this.options = { ...this.options, thresholds: [...existing, rule] };
  }

  getThresholds(): ThresholdRule[] {
    return this.options.thresholds ?? [];
  }

  clearThresholds(): void {
    this.options = { ...this.options, thresholds: [] };
  }

  stageCount(): number {
    return this.options.stages.length;
  }

  private buildStagesString(): string {
    return this.options.stages
      .map((s) => `  { duration: '${s.durationSeconds}s', target: ${s.targetVus} }`)
      .join(',\n');
  }

  private buildThresholdsString(): string {
    const thresholds = this.options.thresholds ?? [];
    if (thresholds.length === 0) return '';
    const lines = thresholds.map((t) => `    '${t.metric}': ['${t.condition}']`).join(',\n');
    return `  thresholds: {\n${lines}\n  },\n`;
  }

  private buildChecksLines(scenario: LoadTestScenarioConfig): string[] {
    const checks = scenario.checks ?? [];
    if (checks.length === 0) return [`    'response ok': (r) => r.status === 200,`];
    return checks.map((c) => {
      if (c.expect === 'status') return `    '${c.name}': (r) => r.status === ${c.value},`;
      if (c.expect === 'body') return `    '${c.name}': (r) => r.body !== null,`;
      return `    '${c.name}': (r) => r.headers['${c.value}'] !== undefined,`;
    });
  }

  toScript(scenario: LoadTestScenarioConfig): string {
    const stages = this.buildStagesString();
    const thresholds = this.buildThresholdsString();
    const bodyArg = scenario.body === undefined ? '' : `, JSON.stringify(${scenario.body})`;
    const method = scenario.method.toLowerCase();
    const checkLines = this.buildChecksLines(scenario);
    return [
      `import http from 'k6/http';`,
      `import { check } from 'k6';`,
      ``,
      `export const options = {`,
      `  stages: [\n${stages}\n  ],`,
      `${thresholds}};`,
      ``,
      `export default function() {`,
      `  const res = http.${method}('${scenario.url}'${bodyArg});`,
      `  check(res, {`,
      ...checkLines,
      `  });`,
      `}`,
    ].join('\n');
  }

  reset(): void {
    this.options = { stages: [] };
  }
}
