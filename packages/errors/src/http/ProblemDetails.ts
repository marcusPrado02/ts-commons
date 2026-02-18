/**
 * RFC 7807 Problem Details for HTTP APIs.
 */
export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly errors?: Record<string, string[]>;
  readonly traceId?: string;
  readonly correlationId?: string;
}

export class ProblemDetailsBuilder {
  private constructor(
    private readonly type: string,
    private readonly title: string,
    private readonly status: number,
  ) {}

  static create(type: string, title: string, status: number): ProblemDetailsBuilder {
    return new ProblemDetailsBuilder(type, title, status);
  }

  private detail?: string;
  private instance?: string;
  private errors?: Record<string, string[]>;
  private traceId?: string;
  private correlationId?: string;

  withDetail(detail: string): this {
    this.detail = detail;
    return this;
  }

  withInstance(instance: string): this {
    this.instance = instance;
    return this;
  }

  withErrors(errors: Record<string, string[]>): this {
    this.errors = errors;
    return this;
  }

  withTraceId(traceId: string): this {
    this.traceId = traceId;
    return this;
  }

  withCorrelationId(correlationId: string): this {
    this.correlationId = correlationId;
    return this;
  }

  build(): ProblemDetails {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      ...(this.detail !== undefined && { detail: this.detail }),
      ...(this.instance !== undefined && { instance: this.instance }),
      ...(this.errors !== undefined && { errors: this.errors }),
      ...(this.traceId !== undefined && { traceId: this.traceId }),
      ...(this.correlationId !== undefined && { correlationId: this.correlationId }),
    };
  }
}
