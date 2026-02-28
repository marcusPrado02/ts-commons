import { randomBytes } from 'node:crypto';
import type { Incident, IncidentSeverity, IncidentStatus, IncidentUpdate } from './types';

type StatusHandler = (incident: Incident, update: IncidentUpdate) => void;

/**
 * Manages the incident lifecycle: creation, updates, resolution and history.
 */
export class IncidentManager {
  private readonly incidents = new Map<string, Incident>();
  private readonly updates = new Map<string, IncidentUpdate[]>();
  private readonly handlers: StatusHandler[] = [];

  /**
   * Open a new incident.
   */
  open(params: {
    title: string;
    description: string;
    severity: IncidentSeverity;
    assignee?: string;
    tags?: string[];
    runbookUrl?: string;
  }): Incident {
    const id = `inc_${randomBytes(6).toString('hex')}`;
    const now = new Date();
    const incident: Incident = {
      id,
      title: params.title,
      description: params.description,
      severity: params.severity,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      tags: params.tags ?? [],
      ...(params.assignee != null ? { assignee: params.assignee } : {}),
      ...(params.runbookUrl != null ? { runbookUrl: params.runbookUrl } : {}),
    };
    this.incidents.set(id, incident);
    return incident;
  }

  /**
   * Update an incident's status with a message.
   */
  update(
    incidentId: string,
    status: IncidentStatus,
    message: string,
    author?: string,
  ): IncidentUpdate | null {
    const incident = this.incidents.get(incidentId);
    if (incident == null) return null;

    const now = new Date();
    const updated: Incident = {
      ...incident,
      status,
      updatedAt: now,
      ...(status === 'resolved' ? { resolvedAt: now } : {}),
    };
    this.incidents.set(incidentId, updated);

    const update: IncidentUpdate = {
      incidentId,
      message,
      status,
      timestamp: now,
      ...(author != null ? { author } : {}),
    };
    const existing = this.updates.get(incidentId) ?? [];
    existing.push(update);
    this.updates.set(incidentId, existing);

    for (const h of this.handlers) h(updated, update);
    return update;
  }

  /** Convenience: resolve an incident. */
  resolve(
    incidentId: string,
    message = 'Incident resolved',
    author?: string,
  ): IncidentUpdate | null {
    return this.update(incidentId, 'resolved', message, author);
  }

  get(incidentId: string): Incident | null {
    return this.incidents.get(incidentId) ?? null;
  }

  /** List all incidents, optionally filtered by status. */
  list(status?: IncidentStatus): Incident[] {
    const all = [...this.incidents.values()];
    if (status == null) return all;
    return all.filter((i) => i.status === status);
  }

  /** Get update history for an incident. */
  getUpdates(incidentId: string): IncidentUpdate[] {
    return this.updates.get(incidentId) ?? [];
  }

  /** Register a handler called on every status transition. Returns unsubscribe fn. */
  onStatusChange(handler: StatusHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  get openCount(): number {
    return [...this.incidents.values()].filter((i) => i.status !== 'resolved').length;
  }
}
