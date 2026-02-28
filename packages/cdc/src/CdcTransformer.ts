import type { CdcEvent, TransformOptions } from './types.js';

const MASKED = '***';

/**
 * Applies field-level transformations to {@link CdcEvent} `before`/`after` payloads.
 *
 * Supported transformations:
 * - **fieldMappings** — rename a key (e.g. `{ ssn: 'tax_id' }`)
 * - **maskFields** — replace a field value with `'***'`
 * - **dropFields** — remove a field entirely
 *
 * All transformations are non-destructive: the original event is not mutated.
 */
export class CdcTransformer {
  private readonly options: TransformOptions;

  constructor(options: TransformOptions = {}) {
    this.options = options;
  }

  /**
   * Return a new {@link CdcEvent} with all configured transformations applied.
   */
  transform(event: CdcEvent): CdcEvent {
    return {
      ...event,
      before: event.before !== null ? this.transformPayload(event.before) : null,
      after: event.after !== null ? this.transformPayload(event.after) : null,
    };
  }

  /**
   * Apply transformations to a batch of events.
   */
  transformAll(events: ReadonlyArray<CdcEvent>): CdcEvent[] {
    return events.map((e) => this.transform(e));
  }

  private transformPayload(payload: Record<string, unknown>): Record<string, unknown> {
    let result = { ...payload };
    result = applyMappings(result, this.options.fieldMappings);
    result = applyMasking(result, this.options.maskFields);
    result = applyDrops(result, this.options.dropFields);
    return result;
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function applyMappings(
  payload: Record<string, unknown>,
  mappings: Record<string, string> | undefined,
): Record<string, unknown> {
  if (mappings === undefined) return payload;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const newKey = mappings[key] ?? key;
    result[newKey] = value;
  }
  return result;
}

function applyMasking(
  payload: Record<string, unknown>,
  fields: string[] | undefined,
): Record<string, unknown> {
  if (fields === undefined || fields.length === 0) return payload;
  const result = { ...payload };
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(result, field)) {
      result[field] = MASKED;
    }
  }
  return result;
}

function applyDrops(
  payload: Record<string, unknown>,
  fields: string[] | undefined,
): Record<string, unknown> {
  if (fields === undefined || fields.length === 0) return payload;
  const result = { ...payload };
  for (const field of fields) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete result[field];
  }
  return result;
}
