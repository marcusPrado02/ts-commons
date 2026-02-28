import type { ServiceInstance, ServiceRegistry, DiscoveryOptions } from './types';

export class InMemoryServiceRegistry implements ServiceRegistry {
  private readonly instances = new Map<string, ServiceInstance>();
  private readonly watchers = new Map<string, Set<(instances: ServiceInstance[]) => void>>();

  register(instance: Omit<ServiceInstance, 'registeredAt'>): ServiceInstance {
    const registered: ServiceInstance = {
      ...instance,
      registeredAt: new Date(),
    };
    this.instances.set(instance.id, registered);
    this.notifyWatchers(instance.name);
    return registered;
  }

  deregister(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    this.instances.delete(instanceId);
    this.notifyWatchers(instance.name);
    return true;
  }

  discover(serviceName: string, options: DiscoveryOptions = {}): ServiceInstance[] {
    let results = [...this.instances.values()].filter((i) => i.name === serviceName);

    if (options.healthyOnly === true) {
      results = results.filter((i) => i.health === 'healthy');
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter((i) => options.tags!.every((tag) => i.tags?.includes(tag) === true));
    }

    return results;
  }

  getHealthy(serviceName: string): ServiceInstance[] {
    return this.discover(serviceName, { healthyOnly: true });
  }

  watch(serviceName: string, handler: (instances: ServiceInstance[]) => void): () => void {
    if (!this.watchers.has(serviceName)) {
      this.watchers.set(serviceName, new Set());
    }
    this.watchers.get(serviceName)!.add(handler);
    return () => {
      this.watchers.get(serviceName)?.delete(handler);
    };
  }

  updateHealth(instanceId: string, health: ServiceInstance['health']): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    instance.health = health;
    instance.lastCheckedAt = new Date();
    this.notifyWatchers(instance.name);
    return true;
  }

  get instanceCount(): number {
    return this.instances.size;
  }

  private notifyWatchers(serviceName: string): void {
    const handlers = this.watchers.get(serviceName);
    if (!handlers) return;
    const current = this.discover(serviceName);
    for (const handler of handlers) {
      handler(current);
    }
  }
}
