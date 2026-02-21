/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
import { describe, it, expect, beforeEach } from 'vitest';
import { LoadTestScenario } from './loadtest/LoadTestScenario';
import { K6Adapter } from './loadtest/K6Adapter';
import { ArtilleryAdapter } from './loadtest/ArtilleryAdapter';
import { StressTestRunner } from './loadtest/StressTestRunner';
import { SpikeTestRunner } from './loadtest/SpikeTestRunner';
import { SoakTestRunner } from './loadtest/SoakTestRunner';

// ─── LoadTestScenario ─────────────────────────────────────────────────────────

describe('LoadTestScenario', () => {
  let scenario: LoadTestScenario;

  beforeEach(() => {
    scenario = new LoadTestScenario();
  });

  it('returns default values before any configuration', () => {
    expect(scenario.getName()).toBe('');
    expect(scenario.getUrl()).toBe('');
    expect(scenario.getMethod()).toBe('GET');
    expect(scenario.checkCount()).toBe(0);
  });

  it('sets name and url via fluent API', () => {
    scenario.setName('test').setUrl('https://api.example.com');
    expect(scenario.getName()).toBe('test');
    expect(scenario.getUrl()).toBe('https://api.example.com');
  });

  it('sets method', () => {
    scenario.setMethod('POST');
    expect(scenario.getMethod()).toBe('POST');
  });

  it('sets headers and returns a copy', () => {
    scenario.setHeaders({ 'Content-Type': 'application/json' });
    const headers = scenario.getHeaders();
    expect(headers['Content-Type']).toBe('application/json');
    headers['X-Extra'] = 'changed';
    expect(scenario.getHeaders()['X-Extra']).toBeUndefined();
  });

  it('sets body', () => {
    scenario.setBody('{"email":"test@example.com"}');
    expect(scenario.getBody()).toBe('{"email":"test@example.com"}');
  });

  it('adds checks and tracks count', () => {
    scenario.addCheck({ name: 'status 201', expect: 'status', value: 201 });
    scenario.addCheck({ name: 'has body', expect: 'body', value: 'id' });
    expect(scenario.checkCount()).toBe(2);
    expect(scenario.getChecks()).toHaveLength(2);
  });

  it('removes a check by name', () => {
    scenario.addCheck({ name: 'status 200', expect: 'status', value: 200 });
    const removed = scenario.removeCheck('status 200');
    expect(removed).toBe(true);
    expect(scenario.checkCount()).toBe(0);
  });

  it('returns false when removing a non-existent check', () => {
    expect(scenario.removeCheck('missing')).toBe(false);
  });

  it('build() returns scenario without optional fields when not set', () => {
    scenario.setName('basic').setUrl('/health');
    const config = scenario.build();
    expect(config.headers).toBeUndefined();
    expect(config.body).toBeUndefined();
    expect(config.checks).toBeUndefined();
  });

  it('build() includes headers, body and checks when set', () => {
    scenario
      .setName('full')
      .setUrl('/api')
      .setMethod('POST')
      .setHeaders({ Authorization: 'Bearer token' })
      .setBody('{}')
      .addCheck({ name: 'ok', expect: 'status', value: 201 });
    const config = scenario.build();
    expect(config.headers?.['Authorization']).toBe('Bearer token');
    expect(config.body).toBe('{}');
    expect(config.checks).toHaveLength(1);
  });

  it('clear() resets state and returns this for chaining', () => {
    scenario.setName('x').setUrl('/x').addCheck({ name: 'c', expect: 'status', value: 200 });
    const result = scenario.clear();
    expect(result).toBe(scenario);
    expect(scenario.getName()).toBe('');
    expect(scenario.checkCount()).toBe(0);
  });

  it('getChecks() returns a copy that does not affect internal state', () => {
    scenario.addCheck({ name: 'c', expect: 'status', value: 200 });
    const checks = scenario.getChecks();
    checks.pop();
    expect(scenario.checkCount()).toBe(1);
  });

  it('supports all HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
    for (const m of methods) {
      scenario.setMethod(m);
      expect(scenario.getMethod()).toBe(m);
    }
  });
});

// ─── K6Adapter ───────────────────────────────────────────────────────────────

describe('K6Adapter', () => {
  let adapter: K6Adapter;

  beforeEach(() => {
    adapter = new K6Adapter();
  });

  it('starts with empty stages', () => {
    expect(adapter.stageCount()).toBe(0);
    expect(adapter.getOptions().stages).toHaveLength(0);
  });

  it('setOptions stores stages', () => {
    adapter.setOptions({
      stages: [{ durationSeconds: 30, targetVus: 100 }],
    });
    expect(adapter.stageCount()).toBe(1);
    expect(adapter.getOptions().stages[0]?.targetVus).toBe(100);
  });

  it('getOptions returns a copy', () => {
    adapter.setOptions({ stages: [{ durationSeconds: 10, targetVus: 5 }] });
    const opts = adapter.getOptions();
    opts.stages.push({ durationSeconds: 99, targetVus: 99 });
    expect(adapter.stageCount()).toBe(1);
  });

  it('addThreshold appends a threshold rule', () => {
    adapter.addThreshold({ metric: 'http_req_duration', condition: 'p(95)<500' });
    expect(adapter.getThresholds()).toHaveLength(1);
  });

  it('clearThresholds empties the thresholds list', () => {
    adapter.addThreshold({ metric: 'http_req_duration', condition: 'p(95)<500' });
    adapter.clearThresholds();
    expect(adapter.getThresholds()).toHaveLength(0);
  });

  it('toScript generates a valid k6 script string', () => {
    adapter.setOptions({ stages: [{ durationSeconds: 30, targetVus: 10 }] });
    const scenario = new LoadTestScenario().setName('test').setUrl('/api').setMethod('GET').build();
    const script = adapter.toScript(scenario);
    expect(script).toContain("import http from 'k6/http'");
    expect(script).toContain('export const options');
    expect(script).toContain('export default function()');
    expect(script).toContain("http.get('/api')");
  });

  it('toScript includes body when scenario has one', () => {
    adapter.setOptions({ stages: [] });
    const scenario = new LoadTestScenario()
      .setName('post')
      .setUrl('/api/users')
      .setMethod('POST')
      .setBody('{}')
      .build();
    const script = adapter.toScript(scenario);
    expect(script).toContain('http.post');
    expect(script).toContain('JSON.stringify');
  });

  it('toScript includes threshold block when thresholds are set', () => {
    adapter.setOptions({ stages: [] });
    adapter.addThreshold({ metric: 'http_req_duration', condition: 'p(95)<500' });
    const scenario = new LoadTestScenario().setName('t').setUrl('/').setMethod('GET').build();
    const script = adapter.toScript(scenario);
    expect(script).toContain('thresholds');
  });

  it('toScript uses default check when no checks defined', () => {
    adapter.setOptions({ stages: [] });
    const scenario = new LoadTestScenario().setName('t').setUrl('/').setMethod('GET').build();
    const script = adapter.toScript(scenario);
    expect(script).toContain('response ok');
  });

  it('toScript uses named checks when defined', () => {
    adapter.setOptions({ stages: [] });
    const scenario = new LoadTestScenario()
      .setName('t')
      .setUrl('/')
      .setMethod('GET')
      .addCheck({ name: 'status 200', expect: 'status', value: 200 })
      .build();
    const script = adapter.toScript(scenario);
    expect(script).toContain('status 200');
  });

  it('toScript includes header check when expect is header', () => {
    adapter.setOptions({ stages: [] });
    const scenario = new LoadTestScenario()
      .setName('t')
      .setUrl('/')
      .setMethod('GET')
      .addCheck({ name: 'has content-type', expect: 'header', value: 'content-type' })
      .build();
    const script = adapter.toScript(scenario);
    expect(script).toContain('has content-type');
  });

  it('reset() clears options', () => {
    adapter.setOptions({ stages: [{ durationSeconds: 1, targetVus: 1 }] });
    adapter.reset();
    expect(adapter.stageCount()).toBe(0);
  });
});

// ─── ArtilleryAdapter ────────────────────────────────────────────────────────

describe('ArtilleryAdapter', () => {
  let adapter: ArtilleryAdapter;

  beforeEach(() => {
    adapter = new ArtilleryAdapter();
  });

  it('starts with empty target and phases', () => {
    expect(adapter.getTarget()).toBe('');
    expect(adapter.phaseCount()).toBe(0);
  });

  it('setTarget stores the URL', () => {
    adapter.setTarget('https://api.example.com');
    expect(adapter.getTarget()).toBe('https://api.example.com');
  });

  it('addPhase increments phaseCount', () => {
    adapter.addPhase({ duration: 60, arrivalRate: 10 });
    expect(adapter.phaseCount()).toBe(1);
  });

  it('getPhases returns copies of all phases', () => {
    adapter.addPhase({ duration: 60, arrivalRate: 5, rampTo: 20 });
    const phases = adapter.getPhases();
    expect(phases).toHaveLength(1);
    expect(phases[0]?.rampTo).toBe(20);
  });

  it('removePhase removes the phase at the given index', () => {
    adapter.addPhase({ duration: 30, arrivalRate: 5 });
    adapter.addPhase({ duration: 60, arrivalRate: 10 });
    const removed = adapter.removePhase(0);
    expect(removed).toBe(true);
    expect(adapter.phaseCount()).toBe(1);
  });

  it('removePhase returns false for out-of-range index', () => {
    expect(adapter.removePhase(0)).toBe(false);
    expect(adapter.removePhase(-1)).toBe(false);
  });

  it('setDefaultHeaders stores headers', () => {
    adapter.setDefaultHeaders({ Authorization: 'Bearer token' });
    expect(adapter.getDefaultHeaders()['Authorization']).toBe('Bearer token');
  });

  it('toConfig omits defaults when headers are empty', () => {
    adapter.setTarget('http://localhost');
    adapter.addPhase({ duration: 30, arrivalRate: 5 });
    const config = adapter.toConfig();
    expect(config.defaults).toBeUndefined();
  });

  it('toConfig includes defaults when headers are set', () => {
    adapter.setTarget('http://localhost');
    adapter.addPhase({ duration: 30, arrivalRate: 5 });
    adapter.setDefaultHeaders({ 'X-Token': 'abc' });
    const config = adapter.toConfig();
    expect(config.defaults?.headers?.['X-Token']).toBe('abc');
  });

  it('toYaml includes target and phase fields', () => {
    adapter.setTarget('http://localhost:3000');
    adapter.addPhase({ duration: 60, arrivalRate: 10, rampTo: 50 });
    const yaml = adapter.toYaml();
    expect(yaml).toContain("target: 'http://localhost:3000'");
    expect(yaml).toContain('arrivalRate: 10');
    expect(yaml).toContain('rampTo: 50');
  });

  it('toYaml skips rampTo when not defined', () => {
    adapter.setTarget('http://localhost');
    adapter.addPhase({ duration: 30, arrivalRate: 5 });
    const yaml = adapter.toYaml();
    expect(yaml).not.toContain('rampTo');
  });

  it('clear() resets all state', () => {
    adapter.setTarget('http://example.com');
    adapter.addPhase({ duration: 30, arrivalRate: 5 });
    adapter.setDefaultHeaders({ 'X-Test': '1' });
    adapter.clear();
    expect(adapter.getTarget()).toBe('');
    expect(adapter.phaseCount()).toBe(0);
    expect(Object.keys(adapter.getDefaultHeaders()).length).toBe(0);
  });
});

// ─── StressTestRunner ────────────────────────────────────────────────────────

describe('StressTestRunner', () => {
  let runner: StressTestRunner;

  beforeEach(() => {
    runner = new StressTestRunner();
  });

  it('returns default configuration values', () => {
    expect(runner.getMaxVus()).toBe(100);
    expect(runner.getStepSize()).toBe(20);
    expect(runner.getStepDurationSeconds()).toBe(30);
  });

  it('configure() updates all values', () => {
    runner.configure(200, 50, 60);
    expect(runner.getMaxVus()).toBe(200);
    expect(runner.getStepSize()).toBe(50);
    expect(runner.getStepDurationSeconds()).toBe(60);
  });

  it('buildStages() always ends with 0 VUs ramp-down', () => {
    runner.configure(100, 50, 30);
    const stages = runner.buildStages();
    expect(stages.at(-1)?.targetVus).toBe(0);
  });

  it('buildStages() includes a hold-at-max stage', () => {
    runner.configure(100, 50, 30);
    const stages = runner.buildStages();
    const maxStages = stages.filter((s) => s.targetVus === 100);
    expect(maxStages.length).toBeGreaterThanOrEqual(1);
  });

  it('buildStages() produces correct ramp-up steps', () => {
    runner.configure(100, 50, 30);
    const stages = runner.buildStages();
    expect(stages[0]?.targetVus).toBe(50);
    expect(stages[1]?.targetVus).toBe(100);
  });

  it('stepCount() returns the number of ramp steps', () => {
    runner.configure(100, 25, 30);
    expect(runner.stepCount()).toBe(4);
  });

  it('stepCount() rounds up when maxVus is not divisible by stepSize', () => {
    runner.configure(100, 30, 30);
    expect(runner.stepCount()).toBe(4);
  });

  it('estimateDurationSeconds() accounts for ramp-up, hold, and ramp-down', () => {
    runner.configure(100, 50, 30);
    const estimate = runner.estimateDurationSeconds();
    expect(estimate).toBeGreaterThan(0);
    expect(estimate).toBe(2 * 30 + 2 * 30 + 30);
  });

  it('all stages have positive durations', () => {
    runner.configure(60, 20, 10);
    const stages = runner.buildStages();
    for (const stage of stages) {
      expect(stage.durationSeconds).toBeGreaterThan(0);
    }
  });

  it('reset() restores default values', () => {
    runner.configure(500, 100, 90);
    runner.reset();
    expect(runner.getMaxVus()).toBe(100);
    expect(runner.getStepSize()).toBe(20);
    expect(runner.getStepDurationSeconds()).toBe(30);
  });

  it('buildStages() produces at least 3 stages (ramp-up + hold + ramp-down)', () => {
    runner.configure(40, 20, 10);
    expect(runner.buildStages().length).toBeGreaterThanOrEqual(3);
  });
});

// ─── SpikeTestRunner ─────────────────────────────────────────────────────────

describe('SpikeTestRunner', () => {
  let runner: SpikeTestRunner;

  beforeEach(() => {
    runner = new SpikeTestRunner();
  });

  it('returns default values', () => {
    expect(runner.getNormalVus()).toBe(10);
    expect(runner.getSpikeVus()).toBe(200);
    expect(runner.getSpikeDurationSeconds()).toBe(30);
    expect(runner.getRampSeconds()).toBe(10);
  });

  it('configure() updates normal, spike VUs and spike duration', () => {
    runner.configure(20, 500, 60);
    expect(runner.getNormalVus()).toBe(20);
    expect(runner.getSpikeVus()).toBe(500);
    expect(runner.getSpikeDurationSeconds()).toBe(60);
  });

  it('setRampSeconds() updates ramp duration', () => {
    runner.setRampSeconds(5);
    expect(runner.getRampSeconds()).toBe(5);
  });

  it('buildStages() returns exactly 5 stages', () => {
    expect(runner.buildStages()).toHaveLength(5);
  });

  it('buildStages() first and last stages hold normal VUs', () => {
    runner.configure(10, 200, 30);
    const stages = runner.buildStages();
    expect(stages[0]?.targetVus).toBe(10);
    expect(stages.at(-1)?.targetVus).toBe(10);
  });

  it('buildStages() spike stages use spikeVus', () => {
    runner.configure(10, 300, 30);
    const stages = runner.buildStages();
    const spikeStages = stages.filter((s) => s.targetVus === 300);
    expect(spikeStages.length).toBe(2);
  });

  it('spikeRatio() returns spike / normal ratio', () => {
    runner.configure(10, 200, 30);
    expect(runner.spikeRatio()).toBe(20);
  });

  it('spikeRatio() returns 0 when normalVus is 0', () => {
    runner.configure(0, 100, 30);
    expect(runner.spikeRatio()).toBe(0);
  });

  it('estimateTotalDurationSeconds() sums all phase durations', () => {
    runner.configure(10, 200, 30);
    runner.setRampSeconds(10);
    const total = runner.estimateTotalDurationSeconds();
    expect(total).toBe(60 + 10 + 30 + 10 + 60);
  });

  it('all stages have positive durations', () => {
    runner.configure(5, 100, 20);
    for (const stage of runner.buildStages()) {
      expect(stage.durationSeconds).toBeGreaterThan(0);
    }
  });

  it('reset() restores default values', () => {
    runner.configure(50, 1000, 120);
    runner.setRampSeconds(60);
    runner.reset();
    expect(runner.getNormalVus()).toBe(10);
    expect(runner.getSpikeVus()).toBe(200);
    expect(runner.getSpikeDurationSeconds()).toBe(30);
    expect(runner.getRampSeconds()).toBe(10);
  });
});

// ─── SoakTestRunner ──────────────────────────────────────────────────────────

describe('SoakTestRunner', () => {
  let runner: SoakTestRunner;

  beforeEach(() => {
    runner = new SoakTestRunner();
  });

  it('returns default values', () => {
    expect(runner.getTargetVus()).toBe(50);
    expect(runner.getSoakDurationMinutes()).toBe(60);
    expect(runner.getRampDurationSeconds()).toBe(60);
  });

  it('configure() updates target VUs and soak duration', () => {
    runner.configure(100, 120);
    expect(runner.getTargetVus()).toBe(100);
    expect(runner.getSoakDurationMinutes()).toBe(120);
  });

  it('setRampDurationSeconds() updates ramp duration', () => {
    runner.setRampDurationSeconds(90);
    expect(runner.getRampDurationSeconds()).toBe(90);
  });

  it('buildStages() returns exactly 3 stages', () => {
    expect(runner.buildStages()).toHaveLength(3);
  });

  it('buildStages() first stage ramps to targetVus', () => {
    runner.configure(80, 30);
    const stages = runner.buildStages();
    expect(stages[0]?.targetVus).toBe(80);
  });

  it('buildStages() second stage sustains at targetVus', () => {
    runner.configure(80, 30);
    const stages = runner.buildStages();
    expect(stages[1]?.targetVus).toBe(80);
    expect(stages[1]?.durationSeconds).toBe(30 * 60);
  });

  it('buildStages() last stage ramps down to 0', () => {
    const stages = runner.buildStages();
    expect(stages.at(-1)?.targetVus).toBe(0);
  });

  it('estimateTotalDurationSeconds() sums ramps and soak period', () => {
    runner.configure(50, 60);
    runner.setRampDurationSeconds(60);
    const expected = 60 + 60 * 60 + 60;
    expect(runner.estimateTotalDurationSeconds()).toBe(expected);
  });

  it('estimateTotalDurationMinutes() rounds up correctly', () => {
    runner.configure(50, 1);
    runner.setRampDurationSeconds(0);
    expect(runner.estimateTotalDurationMinutes()).toBe(1);
  });

  it('estimateTotalDurationMinutes() is at least 1 with defaults', () => {
    expect(runner.estimateTotalDurationMinutes()).toBeGreaterThanOrEqual(1);
  });

  it('reset() restores default values', () => {
    runner.configure(200, 480);
    runner.setRampDurationSeconds(120);
    runner.reset();
    expect(runner.getTargetVus()).toBe(50);
    expect(runner.getSoakDurationMinutes()).toBe(60);
    expect(runner.getRampDurationSeconds()).toBe(60);
  });

  it('all stages have non-negative durations', () => {
    runner.configure(20, 10);
    for (const stage of runner.buildStages()) {
      expect(stage.durationSeconds).toBeGreaterThanOrEqual(0);
    }
  });
});
