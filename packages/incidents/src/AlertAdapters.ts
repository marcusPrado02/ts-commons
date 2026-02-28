import type { AlertPayload, AlertProvider, IncidentSeverity } from './types';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * PagerDuty Events API v2 adapter.
 */
export class PagerDutyAdapter implements AlertProvider {
  readonly name = 'pagerduty';

  constructor(
    private readonly integrationKey: string,
    private readonly fetch: FetchFn,
  ) {}

  async trigger(payload: AlertPayload): Promise<string> {
    const body = {
      routing_key: this.integrationKey,
      event_action: 'trigger',
      dedup_key: payload.dedupKey,
      payload: {
        summary: payload.title,
        severity: this.mapSeverity(payload.severity),
        source: payload.url ?? 'unknown',
        custom_details: { body: payload.body },
      },
    };
    const response = await this.fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`PagerDuty error: ${response.status}`);
    const data = (await response.json()) as Record<string, unknown>;
    return typeof data['dedup_key'] === 'string' ? data['dedup_key'] : (payload.dedupKey ?? '');
  }

  async resolve(dedupKey: string): Promise<void> {
    await this.fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: this.integrationKey,
        event_action: 'resolve',
        dedup_key: dedupKey,
      }),
    });
  }

  async acknowledge(dedupKey: string): Promise<void> {
    await this.fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: this.integrationKey,
        event_action: 'acknowledge',
        dedup_key: dedupKey,
      }),
    });
  }

  private mapSeverity(s: IncidentSeverity): string {
    const map: Record<IncidentSeverity, string> = {
      critical: 'critical',
      high: 'error',
      medium: 'warning',
      low: 'info',
    };
    return map[s];
  }
}

/**
 * Opsgenie Alerts API adapter.
 */
export class OpsgenieAdapter implements AlertProvider {
  readonly name = 'opsgenie';

  constructor(
    private readonly apiKey: string,
    private readonly fetch: FetchFn,
  ) {}

  async trigger(payload: AlertPayload): Promise<string> {
    const body = {
      message: payload.title,
      description: payload.body,
      priority: this.mapPriority(payload.severity),
      ...(payload.dedupKey != null ? { alias: payload.dedupKey } : {}),
      ...(payload.url != null ? { details: { url: payload.url } } : {}),
    };
    const response = await this.fetch('https://api.opsgenie.com/v2/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `GenieKey ${this.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Opsgenie error: ${response.status}`);
    const data = (await response.json()) as Record<string, unknown>;
    return typeof data['requestId'] === 'string' ? data['requestId'] : '';
  }

  async resolve(dedupKey: string): Promise<void> {
    await this.fetch(`https://api.opsgenie.com/v2/alerts/${encodeURIComponent(dedupKey)}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `GenieKey ${this.apiKey}` },
      body: JSON.stringify({}),
    });
  }

  async acknowledge(dedupKey: string): Promise<void> {
    await this.fetch(
      `https://api.opsgenie.com/v2/alerts/${encodeURIComponent(dedupKey)}/acknowledge`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `GenieKey ${this.apiKey}` },
        body: JSON.stringify({}),
      },
    );
  }

  private mapPriority(s: IncidentSeverity): string {
    const map: Record<IncidentSeverity, string> = {
      critical: 'P1',
      high: 'P2',
      medium: 'P3',
      low: 'P4',
    };
    return map[s];
  }
}
