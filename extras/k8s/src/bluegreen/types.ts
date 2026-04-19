/**
 * Blue-Green deployment types.
 */

export type DeploymentColor = 'blue' | 'green';

export interface BlueGreenConfig {
  /** Kubernetes namespace */
  namespace: string;
  /** Application name */
  appName: string;
  /** Docker image for the new version */
  image: string;
  /** Number of replicas for the new deployment */
  replicas?: number;
  /** Service port */
  port?: number;
  /** Health check path */
  healthCheckPath?: string;
  /** Maximum time (ms) to wait for deployment readiness */
  readinessTimeoutMs?: number;
}

export interface DeploymentSlot {
  color: DeploymentColor;
  image: string;
  replicas: number;
  readyReplicas: number;
  active: boolean;
  createdAt: Date;
}

export interface TrafficSwitchResult {
  from: DeploymentColor;
  to: DeploymentColor;
  success: boolean;
  message: string;
  switchedAt: Date;
}

export interface RollbackResult {
  from: DeploymentColor;
  to: DeploymentColor;
  reason: string;
  rolledBackAt: Date;
}

export interface SmokeTestResult {
  passed: boolean;
  duration: number;
  checks: SmokeTestCheck[];
}

export interface SmokeTestCheck {
  name: string;
  passed: boolean;
  message?: string;
}

export interface BlueGreenStrategy {
  readonly activeColor: DeploymentColor;
  readonly inactiveColor: DeploymentColor;
  deploy(color: DeploymentColor, image: string): Promise<DeploymentSlot>;
  switchTraffic(to: DeploymentColor): Promise<TrafficSwitchResult>;
  rollback(reason: string): Promise<RollbackResult>;
  runSmokeTests(color: DeploymentColor): Promise<SmokeTestResult>;
  getSlot(color: DeploymentColor): DeploymentSlot | null;
}
