export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown';

export interface ServiceInstance {
  id: string;
  name: string;
  host: string;
  port: number;
  tags?: string[];
  metadata?: Record<string, string>;
  health: HealthStatus;
  registeredAt: Date;
  lastCheckedAt?: Date;
}

export interface DiscoveryOptions {
  healthyOnly?: boolean;
  tags?: string[];
}

export type LoadBalancingStrategy = 'round-robin' | 'random' | 'least-connections';

export interface ServiceRegistry {
  register(instance: Omit<ServiceInstance, 'registeredAt'>): ServiceInstance;
  deregister(instanceId: string): boolean;
  discover(serviceName: string, options?: DiscoveryOptions): ServiceInstance[];
  getHealthy(serviceName: string): ServiceInstance[];
  watch(serviceName: string, handler: (instances: ServiceInstance[]) => void): () => void;
}

export interface LoadBalancer {
  next(instances: ServiceInstance[]): ServiceInstance | undefined;
}

export interface HealthCheckConfig {
  instanceId: string;
  checkFn: () => Promise<boolean>;
  intervalMs?: number;
}
