import type { Projection } from './Projection.js';
import type { ProjectedEvent, RebuildResult } from './types.js';

/**
 * Manages full and partial projection rebuilds by replaying event streams.
 */
export class ProjectionRebuildManager {
  private readonly projections = new Map<string, Projection>();

  register(projection: Projection): void {
    this.projections.set(projection.name, projection);
  }

  getRegisteredProjections(): string[] {
    return Array.from(this.projections.keys());
  }

  async rebuild(projectionName: string, events: ProjectedEvent[]): Promise<RebuildResult> {
    const projection = this.projections.get(projectionName);
    if (!projection) {
      throw new Error(`Projection not registered: ${projectionName}`);
    }

    await projection.reset();

    const start = Date.now();
    let errors = 0;

    for (const event of events) {
      try {
        await projection.project(event);
      } catch {
        errors++;
      }
    }

    return {
      projectionName,
      eventsProcessed: events.length,
      errors,
      durationMs: Date.now() - start,
    };
  }

  async rebuildAll(events: ProjectedEvent[]): Promise<Map<string, RebuildResult>> {
    const results = new Map<string, RebuildResult>();
    for (const name of this.projections.keys()) {
      results.set(name, await this.rebuild(name, events));
    }
    return results;
  }
}
