/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import {
  QualityValidator,
  DataProfiler,
  ZScoreAnomalyDetector,
  NullAnomalyDetector,
  CompositeAnomalyDetector,
  QualityMetricsCalculator,
  QualityReportEngine,
} from './index.js';
import type { DataRecord, QualityRule } from './index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recs(...ids: number[]): DataRecord[] {
  return ids.map((id) => ({ id }));
}

const requiredId: QualityRule = {
  name: 'required-id',
  validate: (r) => (typeof r['id'] === 'number' ? undefined : 'id must be a number'),
};

const positiveId: QualityRule = {
  name: 'positive-id',
  validate: (r) => ((r['id'] as number) > 0 ? undefined : 'id must be positive'),
};

// ─── QualityValidator ─────────────────────────────────────────────────────────

describe('QualityValidator', () => {
  it('addRule() is fluent', () => {
    const v = new QualityValidator();
    expect(v.addRule(requiredId)).toBe(v);
  });

  it('ruleCount() reflects registered rules', () => {
    const v = new QualityValidator().addRule(requiredId).addRule(positiveId);
    expect(v.ruleCount()).toBe(2);
  });

  it('validate() returns [] for a passing record', () => {
    const v = new QualityValidator().addRule(requiredId);
    expect(v.validate({ id: 5 })).toHaveLength(0);
  });

  it('validate() returns error messages for failing record', () => {
    const v = new QualityValidator().addRule(requiredId);
    expect(v.validate({ id: 'bad' })).toContain('id must be a number');
  });

  it('validate() aggregates multiple rule failures', () => {
    const v = new QualityValidator().addRule(requiredId).addRule(positiveId);
    expect(v.validate({ id: -1 })).toHaveLength(1); // requiredId passes, positiveId fails
  });

  it('validateAll() valid=true when all records pass', () => {
    const v = new QualityValidator().addRule(requiredId);
    const report = v.validateAll(recs(1, 2, 3));
    expect(report.valid).toBe(true);
    expect(report.violations).toHaveLength(0);
  });

  it('validateAll() valid=false when any record fails', () => {
    const v = new QualityValidator().addRule(requiredId);
    const report = v.validateAll([{ id: 1 }, { id: 'nope' }]);
    expect(report.valid).toBe(false);
    expect(report.violations).toHaveLength(1);
  });

  it('validateAll() populates ruleNames in violation', () => {
    const v = new QualityValidator().addRule(requiredId);
    const report = v.validateAll([{ id: 'x' }]);
    expect(report.violations[0]?.ruleNames).toContain('required-id');
  });

  it('validateAll() totalRecords and validRecords are correct', () => {
    const v = new QualityValidator().addRule(requiredId);
    const report = v.validateAll([{ id: 1 }, { id: 'x' }, { id: 3 }]);
    expect(report.totalRecords).toBe(3);
    expect(report.validRecords).toBe(2);
  });

  it('validateAll() with empty array returns valid=true', () => {
    const v = new QualityValidator().addRule(requiredId);
    const report = v.validateAll([]);
    expect(report.valid).toBe(true);
    expect(report.totalRecords).toBe(0);
  });
});

// ─── DataProfiler ─────────────────────────────────────────────────────────────

describe('DataProfiler', () => {
  const profiler = new DataProfiler();

  it('totalRecords matches input length', () => {
    const p = profiler.profile(recs(1, 2, 3));
    expect(p.totalRecords).toBe(3);
  });

  it('profiledAt is a Date', () => {
    const p = profiler.profile(recs(1));
    expect(p.profiledAt).toBeInstanceOf(Date);
  });

  it('fields contains an entry for each discovered column', () => {
    const p = profiler.profile([{ id: 1, name: 'Alice' }]);
    const fieldNames = p.fields.map((f) => f.field);
    expect(fieldNames).toContain('id');
    expect(fieldNames).toContain('name');
  });

  it('nullCount is correct', () => {
    const p = profiler.profile([{ id: 1 }, { id: null }]);
    const idField = p.fields.find((f) => f.field === 'id');
    expect(idField?.nullCount).toBe(1);
  });

  it('uniqueCount counts distinct values', () => {
    const p = profiler.profile([{ id: 1 }, { id: 1 }, { id: 2 }]);
    const idField = p.fields.find((f) => f.field === 'id');
    expect(idField?.uniqueCount).toBe(2);
  });

  it('mean is computed for numeric fields', () => {
    const p = profiler.profile([{ n: 2 }, { n: 4 }]);
    const f = p.fields.find((f) => f.field === 'n');
    expect(f?.mean).toBe(3);
  });

  it('mean is undefined when no numeric values exist', () => {
    const p = profiler.profile([{ name: 'Alice' }, { name: 'Bob' }]);
    const f = p.fields.find((f) => f.field === 'name');
    expect(f?.mean).toBeUndefined();
  });

  it('min and max are correct for numeric fields', () => {
    const p = profiler.profile([{ v: 10 }, { v: 2 }, { v: 7 }]);
    const f = p.fields.find((f) => f.field === 'v');
    expect(f?.min).toBe(2);
    expect(f?.max).toBe(10);
  });

  it('empty dataset returns empty fields array', () => {
    const p = profiler.profile([]);
    expect(p.fields).toHaveLength(0);
    expect(p.totalRecords).toBe(0);
  });
});

// ─── ZScoreAnomalyDetector ────────────────────────────────────────────────────

describe('ZScoreAnomalyDetector', () => {
  it('detects outlier beyond threshold', () => {
    const data: DataRecord[] = [{ v: 1 }, { v: 2 }, { v: 2 }, { v: 2 }, { v: 2 }, { v: 100 }];
    const d = new ZScoreAnomalyDetector('v', 2.0);
    const report = d.detect(data);
    expect(report.anomalies.length).toBeGreaterThan(0);
    expect(report.anomalies[0]?.field).toBe('v');
  });

  it('returns no anomalies when all values are uniform', () => {
    const data = [{ v: 5 }, { v: 5 }, { v: 5 }];
    const d = new ZScoreAnomalyDetector('v');
    expect(d.detect(data).anomalies).toHaveLength(0);
  });

  it('returns no anomalies when dataset has fewer than 2 values', () => {
    const d = new ZScoreAnomalyDetector('v');
    expect(d.detect([{ v: 99 }]).anomalies).toHaveLength(0);
  });

  it('skips non-numeric values', () => {
    const data = [{ v: 1 }, { v: 2 }, { v: 'text' }];
    const d = new ZScoreAnomalyDetector('v');
    const report = d.detect(data);
    expect(report.totalChecked).toBe(3);
  });

  it('totalChecked matches record count', () => {
    const d = new ZScoreAnomalyDetector('v');
    expect(d.detect([{ v: 1 }, { v: 2 }, { v: 3 }]).totalChecked).toBe(3);
  });
});

// ─── NullAnomalyDetector ──────────────────────────────────────────────────────

describe('NullAnomalyDetector', () => {
  it('flags null values', () => {
    const d = new NullAnomalyDetector('email');
    const report = d.detect([{ email: null }, { email: 'x@y.com' }]);
    expect(report.anomalies).toHaveLength(1);
    expect(report.anomalies[0]?.severity).toBe('high');
  });

  it('flags missing (undefined) values', () => {
    const d = new NullAnomalyDetector('email');
    const report = d.detect([{ id: 1 }]); // 'email' absent
    expect(report.anomalies).toHaveLength(1);
  });

  it('no anomalies when all values are present', () => {
    const d = new NullAnomalyDetector('id');
    expect(d.detect(recs(1, 2, 3)).anomalies).toHaveLength(0);
  });

  it('message includes the field name', () => {
    const d = new NullAnomalyDetector('email');
    const report = d.detect([{ email: null }]);
    expect(report.anomalies[0]?.message).toContain('email');
  });
});

// ─── CompositeAnomalyDetector ─────────────────────────────────────────────────

describe('CompositeAnomalyDetector', () => {
  it('addDetector() is fluent', () => {
    const c = new CompositeAnomalyDetector();
    expect(c.addDetector(new NullAnomalyDetector('id'))).toBe(c);
  });

  it('detectorCount() reflects registered detectors', () => {
    const c = new CompositeAnomalyDetector()
      .addDetector(new NullAnomalyDetector('id'))
      .addDetector(new NullAnomalyDetector('name'));
    expect(c.detectorCount()).toBe(2);
  });

  it('aggregates anomalies from all detectors', () => {
    const c = new CompositeAnomalyDetector()
      .addDetector(new NullAnomalyDetector('id'))
      .addDetector(new NullAnomalyDetector('name'));
    const report = c.detect([{ id: null, name: null }]);
    expect(report.anomalies).toHaveLength(2);
  });

  it('returns empty anomalies when all pass', () => {
    const c = new CompositeAnomalyDetector().addDetector(new NullAnomalyDetector('id'));
    expect(c.detect(recs(1, 2)).anomalies).toHaveLength(0);
  });

  it('totalChecked matches input length', () => {
    const c = new CompositeAnomalyDetector().addDetector(new NullAnomalyDetector('id'));
    expect(c.detect(recs(1, 2, 3)).totalChecked).toBe(3);
  });
});

// ─── QualityMetricsCalculator ─────────────────────────────────────────────────

describe('QualityMetricsCalculator', () => {
  const calc = new QualityMetricsCalculator();

  it('completeness=1 when no nulls', () => {
    const v = new QualityValidator();
    const report = v.validateAll(recs(1, 2));
    const m = calc.compute(recs(1, 2), report);
    expect(m.completeness).toBe(1);
  });

  it('completeness < 1 when nulls present', () => {
    const records: DataRecord[] = [{ id: 1 }, { id: null }];
    const v = new QualityValidator();
    const report = v.validateAll(records);
    const m = calc.compute(records, report);
    expect(m.completeness).toBeLessThan(1);
  });

  it('validity=1 when all records pass validation', () => {
    const v = new QualityValidator().addRule(requiredId);
    const records = recs(1, 2);
    const report = v.validateAll(records);
    const m = calc.compute(records, report);
    expect(m.validity).toBe(1);
  });

  it('validity < 1 when some records fail validation', () => {
    const v = new QualityValidator().addRule(requiredId);
    const records: DataRecord[] = [{ id: 1 }, { id: 'bad' }];
    const report = v.validateAll(records);
    const m = calc.compute(records, report);
    expect(m.validity).toBe(0.5);
  });

  it('uniqueness=1 when all records are distinct', () => {
    const records = recs(1, 2, 3);
    const v = new QualityValidator();
    const m = calc.compute(records, v.validateAll(records));
    expect(m.uniqueness).toBe(1);
  });

  it('uniqueness < 1 when duplicates present', () => {
    const records: DataRecord[] = [{ id: 1 }, { id: 1 }, { id: 2 }];
    const v = new QualityValidator();
    const m = calc.compute(records, v.validateAll(records));
    expect(m.uniqueness).toBeCloseTo(2 / 3);
  });

  it('computedAt is a Date', () => {
    const v = new QualityValidator();
    const m = calc.compute(recs(1), v.validateAll(recs(1)));
    expect(m.computedAt).toBeInstanceOf(Date);
  });

  it('totalRecords matches input', () => {
    const v = new QualityValidator();
    const records = recs(1, 2, 3, 4);
    const m = calc.compute(records, v.validateAll(records));
    expect(m.totalRecords).toBe(4);
  });

  it('returns perfect scores for empty dataset', () => {
    const v = new QualityValidator().addRule(requiredId);
    const m = calc.compute([], v.validateAll([]));
    expect(m.completeness).toBe(1);
    expect(m.validity).toBe(1);
    expect(m.uniqueness).toBe(1);
  });
});

// ─── QualityReportEngine ──────────────────────────────────────────────────────

describe('QualityReportEngine', () => {
  it('addRule() is fluent', () => {
    const e = new QualityReportEngine();
    expect(e.addRule(requiredId)).toBe(e);
  });

  it('addDetector() is fluent', () => {
    const e = new QualityReportEngine();
    expect(e.addDetector(new NullAnomalyDetector('id'))).toBe(e);
  });

  it('run() returns a QualityReport with all sub-reports', () => {
    const e = new QualityReportEngine().addRule(requiredId);
    const report = e.run(recs(1, 2, 3));
    expect(report.metrics).toBeDefined();
    expect(report.validation).toBeDefined();
    expect(report.profile).toBeDefined();
    expect(report.anomalies).toBeDefined();
    expect(report.generatedAt).toBeInstanceOf(Date);
  });

  it('run() validation detects violations', () => {
    const e = new QualityReportEngine().addRule(requiredId);
    const report = e.run([{ id: 1 }, { id: 'bad' }]);
    expect(report.validation.valid).toBe(false);
  });

  it('run() detector finds anomalies', () => {
    const e = new QualityReportEngine().addDetector(new NullAnomalyDetector('id'));
    const report = e.run([{ id: null }, { id: 1 }]);
    expect(report.anomalies.anomalies).toHaveLength(1);
  });

  it('run() profile totalRecords matches input', () => {
    const e = new QualityReportEngine();
    const report = e.run(recs(1, 2, 3, 4, 5));
    expect(report.profile.totalRecords).toBe(5);
  });

  it('run() metrics validity=1 when all valid', () => {
    const e = new QualityReportEngine().addRule(requiredId);
    const report = e.run(recs(1, 2, 3));
    expect(report.metrics.validity).toBe(1);
  });

  it('run() with no rules and no detectors returns clean report', () => {
    const e = new QualityReportEngine();
    const report = e.run(recs(1, 2));
    expect(report.validation.valid).toBe(true);
    expect(report.anomalies.anomalies).toHaveLength(0);
  });

  it('run() with empty dataset returns valid report', () => {
    const e = new QualityReportEngine().addRule(requiredId);
    const report = e.run([]);
    expect(report.validation.totalRecords).toBe(0);
    expect(report.metrics.validity).toBe(1);
  });
});
