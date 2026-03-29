# @acme/incidents

Incident management and alerting. Raises, tracks, and resolves incidents with PagerDuty and OpsGenie, and generates post-mortems with structured action items.

## Installation

```bash
pnpm add @acme/incidents
```

## Quick Start

```typescript
import { IncidentManager, PagerDutyAdapter } from '@acme/incidents';

const alert = new PagerDutyAdapter({ routingKey: process.env.PD_ROUTING_KEY! });
const manager = new IncidentManager(alert);

// Raise an incident
const incident = await manager.trigger({
  title: 'Database latency spike',
  severity: 'high',
  source: 'order-service',
  details: { p99LatencyMs: 4200 },
});

// Resolve it later
await manager.resolve(incident.id, 'Latency returned to baseline after cache warm-up');
```

## Providers

| Provider  | Adapter            |
| --------- | ------------------ |
| PagerDuty | `PagerDutyAdapter` |
| OpsGenie  | `OpsgenieAdapter`  |

## Post-Mortem

```typescript
import { PostMortemBuilder } from '@acme/incidents';

const pm = new PostMortemBuilder(incident)
  .summary('Cache eviction caused cascading DB load')
  .timeline([
    { at: new Date('2026-03-01T14:00:00Z'), event: 'Alert triggered' },
    { at: new Date('2026-03-01T14:45:00Z'), event: 'Root cause identified' },
    { at: new Date('2026-03-01T15:00:00Z'), event: 'Resolved' },
  ])
  .action('Add cache warm-up on deploy', 'team-platform', 'medium')
  .build();
```

## See Also

- [`@acme/observability`](../observability) — metrics and SLO tracking
- [`@acme/synthetic`](../synthetic) — proactive health monitoring
