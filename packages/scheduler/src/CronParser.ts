import { InvalidCronExpressionError } from './JobErrors';

// ---------------------------------------------------------------------------
// Parsed cron fields
// ---------------------------------------------------------------------------

export interface CronFields {
  readonly minutes: ReadonlySet<number>;
  readonly hours: ReadonlySet<number>;
  readonly monthDays: ReadonlySet<number>;
  readonly months: ReadonlySet<number>;
  readonly weekDays: ReadonlySet<number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expandRange(min: number, max: number, step = 1): Set<number> {
  const result = new Set<number>();
  for (let i = min; i <= max; i += step) result.add(i);
  return result;
}

function parseSingle(raw: string, min: number, max: number, expr: string): number {
  const n = parseInt(raw.trim(), 10);
  if (isNaN(n) || n < min || n > max) {
    throw new InvalidCronExpressionError(expr, `value "${raw}" out of range [${min}-${max}]`);
  }
  return n;
}

function parseField(field: string, min: number, max: number, expr: string): Set<number> {
  if (field === '*') return expandRange(min, max);

  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    if (isNaN(step) || step <= 0) {
      throw new InvalidCronExpressionError(expr, `invalid step in "${field}"`);
    }
    return expandRange(min, max, step);
  }

  if (field.includes('-')) {
    const [lo, hi] = field.split('-');
    if (lo === undefined || hi === undefined) {
      throw new InvalidCronExpressionError(expr, `invalid range "${field}"`);
    }
    const low = parseSingle(lo, min, max, expr);
    const high = parseSingle(hi, min, max, expr);
    if (low > high) throw new InvalidCronExpressionError(expr, `range start ${low} > end ${high}`);
    return expandRange(low, high);
  }

  const result = new Set<number>();
  for (const part of field.split(',')) {
    result.add(parseSingle(part, min, max, expr));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a standard 5-field cron expression.
 *
 * Fields: `minute hour dayOfMonth month dayOfWeek`
 *
 * Supports: `*`, `*\/n`, `n`, `n-m`, comma-separated values.
 *
 * @example `parseCron('0 9 * * 1-5')` — every weekday at 09:00
 */
export function parseCron(expression: string): CronFields {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new InvalidCronExpressionError(expression, `expected 5 fields, got ${parts.length}`);
  }
  const [minF, hrF, domF, monF, wdF] = parts;
  if (
    minF === undefined ||
    hrF === undefined ||
    domF === undefined ||
    monF === undefined ||
    wdF === undefined
  ) {
    throw new InvalidCronExpressionError(expression, 'expected 5 fields');
  }
  return {
    minutes: parseField(minF, 0, 59, expression),
    hours: parseField(hrF, 0, 23, expression),
    monthDays: parseField(domF, 1, 31, expression),
    months: parseField(monF, 1, 12, expression),
    weekDays: parseField(wdF, 0, 6, expression),
  };
}

/**
 * Check whether the given {@link Date} matches parsed {@link CronFields}.
 *
 * @example
 * ```ts
 * const fields = parseCron('0 9 * * 1');
 * matchesCron(fields, new Date('2026-02-23T09:00:00')); // true (Monday 09:00)
 * ```
 */
export function matchesCron(fields: CronFields, date: Date): boolean {
  return (
    fields.minutes.has(date.getMinutes()) &&
    fields.hours.has(date.getHours()) &&
    fields.monthDays.has(date.getDate()) &&
    fields.months.has(date.getMonth() + 1) &&
    fields.weekDays.has(date.getDay())
  );
}
