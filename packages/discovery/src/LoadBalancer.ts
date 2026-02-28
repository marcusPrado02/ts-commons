import type { LoadBalancer, ServiceInstance } from './types';

export class RoundRobinBalancer implements LoadBalancer {
  private index = 0;

  next(instances: ServiceInstance[]): ServiceInstance | undefined {
    if (instances.length === 0) return undefined;
    const instance = instances[this.index % instances.length];
    this.index = (this.index + 1) % instances.length;
    return instance;
  }

  reset(): void {
    this.index = 0;
  }
}

export class RandomBalancer implements LoadBalancer {
  next(instances: ServiceInstance[]): ServiceInstance | undefined {
    if (instances.length === 0) return undefined;
    const idx = Math.floor(Math.random() * instances.length);
    return instances[idx];
  }
}

export class LeastConnectionsBalancer implements LoadBalancer {
  private readonly connections = new Map<string, number>();

  next(instances: ServiceInstance[]): ServiceInstance | undefined {
    if (instances.length === 0) return undefined;
    let chosen = instances[0]!;
    let minConns = this.connections.get(chosen.id) ?? 0;
    for (const inst of instances.slice(1)) {
      const conns = this.connections.get(inst.id) ?? 0;
      if (conns < minConns) {
        minConns = conns;
        chosen = inst;
      }
    }
    this.connections.set(chosen.id, (this.connections.get(chosen.id) ?? 0) + 1);
    return chosen;
  }

  release(instanceId: string): void {
    const current = this.connections.get(instanceId) ?? 0;
    if (current > 0) {
      this.connections.set(instanceId, current - 1);
    }
  }

  getConnections(instanceId: string): number {
    return this.connections.get(instanceId) ?? 0;
  }
}
