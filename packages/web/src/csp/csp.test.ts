/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from 'vitest';
import { CspBuilder } from './CspBuilder';
import { NonceGenerator } from './NonceGenerator';
import { CspViolationMonitor } from './CspViolationMonitor';

// ──────────────────────────────────────────────────────────────────────────────
// CspBuilder
// ──────────────────────────────────────────────────────────────────────────────

describe('CspBuilder', () => {
  it('builds a simple policy string', () => {
    const csp = new CspBuilder()
      .add('default-src', ["'none'"])
      .add('script-src', ["'self'"])
      .build();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
  });

  it('deduplicates sources for same directive', () => {
    const csp = new CspBuilder().add('script-src', ["'self'", "'self'"]).build();
    const matches = (csp.match(/'self'/g) ?? []).length;
    expect(matches).toBe(1);
  });

  it('adds upgrade-insecure-requests from options', () => {
    const csp = new CspBuilder().withOptions({ upgradeInsecureRequests: true }).build();
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('adds block-all-mixed-content from options', () => {
    const csp = new CspBuilder().withOptions({ blockAllMixedContent: true }).build();
    expect(csp).toContain('block-all-mixed-content');
  });

  it('adds report-uri from options', () => {
    const csp = new CspBuilder().withOptions({ reportUri: '/csp-report' }).build();
    expect(csp).toContain('report-uri /csp-report');
  });

  it('adds report-to from options', () => {
    const csp = new CspBuilder().withOptions({ reportTo: 'csp-endpoint' }).build();
    expect(csp).toContain('report-to csp-endpoint');
  });

  it('clone produces independent copy', () => {
    const original = new CspBuilder().add('default-src', ["'none'"]);
    const cloned = original.clone();
    cloned.add('script-src', ["'self'"]);
    expect(original.build()).not.toContain('script-src');
    expect(cloned.build()).toContain('script-src');
  });

  it('toPolicy returns the directives as an object', () => {
    const builder = new CspBuilder().add('default-src', ["'none'"]).add('script-src', ["'self'"]);
    const policy = builder.toPolicy();
    expect(policy['default-src']).toContain("'none'");
    expect(policy['script-src']).toContain("'self'");
  });

  it('parse roundtrips a simple CSP string', () => {
    const original = "default-src 'none'; script-src 'self'";
    const rebuilt = CspBuilder.parse(original).build();
    expect(rebuilt).toContain("default-src 'none'");
    expect(rebuilt).toContain("script-src 'self'");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// NonceGenerator
// ──────────────────────────────────────────────────────────────────────────────

describe('NonceGenerator', () => {
  it('generates a non-empty nonce', () => {
    const gen = new NonceGenerator();
    expect(gen.generate().length).toBeGreaterThan(0);
  });

  it('generates unique nonces', () => {
    const gen = new NonceGenerator();
    const a = gen.generate();
    const b = gen.generate();
    expect(a).not.toBe(b);
  });

  it('formatSource wraps nonce correctly', () => {
    const gen = new NonceGenerator();
    expect(gen.formatSource('abc123')).toBe("'nonce-abc123'");
  });

  it('generatePair returns matching nonce and source', () => {
    const gen = new NonceGenerator();
    const { nonce, source } = gen.generatePair();
    expect(source).toBe(`'nonce-${nonce}'`);
  });

  it('nonce can be used in CspBuilder', () => {
    const gen = new NonceGenerator();
    const { source } = gen.generatePair();
    const csp = new CspBuilder().add('script-src', ["'self'", source]).build();
    expect(csp).toContain(source);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// CspViolationMonitor
// ──────────────────────────────────────────────────────────────────────────────

describe('CspViolationMonitor', () => {
  const validReport = {
    'csp-report': {
      'blocked-uri': 'https://evil.com/script.js',
      'document-uri': 'https://example.com/',
      'effective-directive': 'script-src',
      'original-policy': "script-src 'self'",
      'violated-directive': 'script-src',
    },
  };

  it('processes a valid violation report', () => {
    const monitor = new CspViolationMonitor();
    monitor.report(validReport);
    expect(monitor.reportCount).toBe(1);
  });

  it('calls registered violation handler', () => {
    const monitor = new CspViolationMonitor();
    const handler = vi.fn();
    monitor.onViolation(handler);
    monitor.report(validReport);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].violatedDirective).toBe('script-src');
  });

  it('unsubscribing stops handler calls', () => {
    const monitor = new CspViolationMonitor();
    const handler = vi.fn();
    const unsub = monitor.onViolation(handler);
    unsub();
    monitor.report(validReport);
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores null/invalid reports', () => {
    const monitor = new CspViolationMonitor();
    monitor.report(null);
    monitor.report('string');
    monitor.report({});
    expect(monitor.reportCount).toBe(0);
  });

  it('groups violations by directive', () => {
    const monitor = new CspViolationMonitor();
    monitor.report(validReport);
    const groups = monitor.groupByDirective();
    expect(groups.has('script-src')).toBe(true);
  });

  it('evicts oldest when maxReports reached', () => {
    const monitor = new CspViolationMonitor(2);
    monitor.report(validReport);
    monitor.report(validReport);
    monitor.report(validReport);
    expect(monitor.reportCount).toBe(2);
  });

  it('clear removes all stored reports', () => {
    const monitor = new CspViolationMonitor();
    monitor.report(validReport);
    monitor.clear();
    expect(monitor.reportCount).toBe(0);
  });

  it('getReports returns immutable copy', () => {
    const monitor = new CspViolationMonitor();
    monitor.report(validReport);
    const reports = monitor.getReports();
    expect(reports.length).toBe(1);
  });
});
