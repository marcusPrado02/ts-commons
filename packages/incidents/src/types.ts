export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved';

export interface Incident {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly resolvedAt?: Date;
  readonly assignee?: string;
  readonly tags: string[];
  readonly runbookUrl?: string;
}

export interface IncidentUpdate {
  readonly incidentId: string;
  readonly message: string;
  readonly status: IncidentStatus;
  readonly timestamp: Date;
  readonly author?: string;
}

export interface PostMortem {
  readonly incidentId: string;
  readonly title: string;
  readonly summary: string;
  readonly timeline: PostMortemEvent[];
  readonly rootCauses: string[];
  readonly actionItems: ActionItem[];
  readonly createdAt: Date;
}

export interface PostMortemEvent {
  readonly timestamp: Date;
  readonly description: string;
}

export interface ActionItem {
  readonly id: string;
  readonly description: string;
  readonly owner?: string;
  readonly dueDate?: Date;
  readonly done: boolean;
}

export interface AlertPayload {
  /** Unique dedup key (idempotency) */
  readonly dedupKey?: string;
  readonly title: string;
  readonly body: string;
  readonly severity: IncidentSeverity;
  readonly url?: string;
}

/** Pluggable alert provider adapter */
export interface AlertProvider {
  readonly name: string;
  trigger(payload: AlertPayload): Promise<string>; // returns incident key
  resolve(dedupKey: string): Promise<void>;
  acknowledge(dedupKey: string): Promise<void>;
}
