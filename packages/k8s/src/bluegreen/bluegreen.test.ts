/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi } from 'vitest';
import { BlueGreenDeployment } from './BlueGreenDeployment';
import type { BlueGreenConfig } from './types';

const cfg: BlueGreenConfig = {
  namespace: 'default',
  appName: 'my-app',
  image: 'my-app:v2',
  replicas: 2,
  port: 8080,
  healthCheckPath: '/health',
};

function makeHttp(ok = true) {
  return vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 503 });
}

describe('BlueGreenDeployment', () => {
  it('starts with blue as active color', () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp());
    expect(bg.activeColor).toBe('blue');
    expect(bg.inactiveColor).toBe('green');
  });

  it('deploy returns a slot', async () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp());
    const slot = await bg.deploy('green', 'my-app:v2');
    expect(slot.color).toBe('green');
    expect(slot.image).toBe('my-app:v2');
    expect(slot.readyReplicas).toBe(2);
  });

  it('getSlot returns null before deployment', () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp());
    expect(bg.getSlot('green')).toBeNull();
  });

  it('getSlot returns slot after deploy', async () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp());
    await bg.deploy('green', 'my-app:v2');
    expect(bg.getSlot('green')?.image).toBe('my-app:v2');
  });

  it('switchTraffic fails if slot not deployed', async () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp());
    const result = await bg.switchTraffic('green');
    expect(result.success).toBe(false);
    expect(bg.activeColor).toBe('blue');
  });

  it('switchTraffic succeeds and updates activeColor', async () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp());
    await bg.deploy('green', 'my-app:v2');
    const result = await bg.switchTraffic('green');
    expect(result.success).toBe(true);
    expect(result.from).toBe('blue');
    expect(result.to).toBe('green');
    expect(bg.activeColor).toBe('green');
  });

  it('switchTraffic fails if replicas not ready', async () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp());
    await bg.deploy('green', 'my-app:v2');
    const slot = bg.getSlot('green')!;
    slot.readyReplicas = 0;
    const result = await bg.switchTraffic('green');
    expect(result.success).toBe(false);
  });

  it('rollback switches traffic back', async () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp());
    await bg.deploy('green', 'my-app:v2');
    await bg.switchTraffic('green');
    expect(bg.activeColor).toBe('green');
    const result = await bg.rollback('smoke tests failed');
    expect(result.from).toBe('green');
    expect(result.to).toBe('blue');
    expect(bg.activeColor).toBe('blue');
    expect(result.reason).toBe('smoke tests failed');
  });

  it('runSmokeTests passes when health check succeeds', async () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp(true));
    const result = await bg.runSmokeTests('blue');
    expect(result.passed).toBe(true);
    expect(result.checks[0]!.name).toBe('healthcheck');
  });

  it('runSmokeTests fails when health check fails', async () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp(false));
    const result = await bg.runSmokeTests('blue');
    expect(result.passed).toBe(false);
  });

  it('custom smoke check is executed', async () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp(true));
    bg.addSmokeCheck(async () => ({ name: 'custom', passed: true }));
    const result = await bg.runSmokeTests('blue');
    expect(result.checks.length).toBe(2);
    expect(result.checks[1]!.name).toBe('custom');
  });

  it('runSmokeTests fails if custom check fails', async () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp(true));
    bg.addSmokeCheck(async () => ({ name: 'custom', passed: false, message: 'oops' }));
    const result = await bg.runSmokeTests('blue');
    expect(result.passed).toBe(false);
  });

  it('slot active flag updated on switch', async () => {
    const bg = new BlueGreenDeployment(cfg, makeHttp());
    await bg.deploy('blue', 'my-app:v1');
    await bg.deploy('green', 'my-app:v2');
    await bg.switchTraffic('green');
    expect(bg.getSlot('green')?.active).toBe(true);
    expect(bg.getSlot('blue')?.active).toBe(false);
  });
});
