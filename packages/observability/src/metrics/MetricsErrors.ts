/** Thrown when a metrics push/export to an external backend fails. */
export class MetricsExportError extends Error {
  override readonly name = 'MetricsExportError';
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/** Thrown when the metrics backend cannot be reached at all. */
export class MetricsUnavailableError extends Error {
  override readonly name = 'MetricsUnavailableError';
  constructor(readonly cause?: unknown) {
    super('Metrics backend is unavailable');
  }
}
