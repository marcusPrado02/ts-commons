import type { LoadTestScenarioConfig, HttpCheck } from './LoadTestTypes';

/**
 * Fluent builder for composing a {@link LoadTestScenarioConfig}.
 *
 * @example
 * ```typescript
 * const scenario = new LoadTestScenario();
 * scenario.setName('Create user').setUrl('/api/users').setMethod('POST');
 * scenario.addCheck({ name: 'status 201', expect: 'status', value: 201 });
 * const config = scenario.build();
 * ```
 */
export class LoadTestScenario {
  private name = '';
  private url = '';
  private method: LoadTestScenarioConfig['method'] = 'GET';
  private headers: Record<string, string> = {};
  private body: string | undefined = undefined;
  private readonly checks: HttpCheck[] = [];

  setName(name: string): this {
    this.name = name;
    return this;
  }

  getName(): string {
    return this.name;
  }

  setUrl(url: string): this {
    this.url = url;
    return this;
  }

  getUrl(): string {
    return this.url;
  }

  setMethod(method: LoadTestScenarioConfig['method']): this {
    this.method = method;
    return this;
  }

  getMethod(): LoadTestScenarioConfig['method'] {
    return this.method;
  }

  setHeaders(headers: Record<string, string>): this {
    this.headers = { ...headers };
    return this;
  }

  getHeaders(): Record<string, string> {
    return { ...this.headers };
  }

  setBody(body: string): this {
    this.body = body;
    return this;
  }

  getBody(): string | undefined {
    return this.body;
  }

  addCheck(check: HttpCheck): this {
    this.checks.push({ ...check });
    return this;
  }

  getChecks(): HttpCheck[] {
    return [...this.checks];
  }

  removeCheck(name: string): boolean {
    const idx = this.checks.findIndex((c) => c.name === name);
    if (idx === -1) return false;
    this.checks.splice(idx, 1);
    return true;
  }

  checkCount(): number {
    return this.checks.length;
  }

  build(): LoadTestScenarioConfig {
    const config: LoadTestScenarioConfig = {
      name: this.name,
      url: this.url,
      method: this.method,
    };
    if (Object.keys(this.headers).length > 0) {
      config.headers = { ...this.headers };
    }
    if (this.body !== undefined) {
      config.body = this.body;
    }
    if (this.checks.length > 0) {
      config.checks = [...this.checks];
    }
    return config;
  }

  clear(): this {
    this.name = '';
    this.url = '';
    this.method = 'GET';
    this.headers = {};
    this.body = undefined;
    this.checks.splice(0, this.checks.length);
    return this;
  }
}
