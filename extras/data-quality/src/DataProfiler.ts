import type { DataRecord, DataProfile, FieldProfile } from './types.js';

/**
 * Profiles a dataset by computing per-field statistics such as null counts,
 * unique value counts, min/max, and mean (for numeric fields).
 */
export class DataProfiler {
  /**
   * Profile the given records.
   *
   * @returns A {@link DataProfile} snapshot taken at the current timestamp.
   */
  profile(records: readonly DataRecord[]): DataProfile {
    const fieldNames = this.collectFieldNames(records);
    const fields = fieldNames.map((f) => this.profileField(f, records));

    return {
      totalRecords: records.length,
      fields,
      profiledAt: new Date(),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private collectFieldNames(records: readonly DataRecord[]): string[] {
    const names = new Set<string>();
    for (const record of records) {
      for (const key of Object.keys(record)) {
        names.add(key);
      }
    }
    return [...names];
  }

  private profileField(field: string, records: readonly DataRecord[]): FieldProfile {
    const values = records.map((r) => r[field]);
    const nonNull = values.filter((v) => v !== null && v !== undefined);
    const unique = new Set(nonNull.map((v) => JSON.stringify(v)));

    const numerics = nonNull.filter((v): v is number => typeof v === 'number');
    const mean = this.computeMean(numerics);
    const sorted = [...numerics].sort((a, b) => a - b);

    const minVal: unknown = sorted.length > 0 ? sorted[0] : undefined;
    const maxVal: unknown = sorted.length > 0 ? sorted[sorted.length - 1] : undefined;

    return {
      field,
      count: values.length,
      nullCount: values.length - nonNull.length,
      uniqueCount: unique.size,
      min: minVal,
      max: maxVal,
      mean,
    };
  }

  private computeMean(numerics: number[]): number | undefined {
    if (numerics.length === 0) return undefined;
    const sum = numerics.reduce((acc, n) => acc + n, 0);
    return sum / numerics.length;
  }
}
