import { randomBytes } from 'node:crypto';
import type { PostMortem, PostMortemEvent, ActionItem, Incident } from './types';

/**
 * Builder for incident post-mortems.
 */
export class PostMortemBuilder {
  private readonly events: PostMortemEvent[] = [];
  private readonly rootCauses: string[] = [];
  private readonly actionItems: ActionItem[] = [];
  private summaryText = '';

  constructor(private readonly incident: Incident) {}

  summary(text: string): this {
    this.summaryText = text;
    return this;
  }

  addEvent(timestamp: Date, description: string): this {
    this.events.push({ timestamp, description });
    return this;
  }

  addRootCause(cause: string): this {
    this.rootCauses.push(cause);
    return this;
  }

  addActionItem(description: string, owner?: string, dueDate?: Date): this {
    const id = randomBytes(4).toString('hex');
    const item: ActionItem = {
      id,
      description,
      done: false,
      ...(owner != null ? { owner } : {}),
      ...(dueDate != null ? { dueDate } : {}),
    };
    this.actionItems.push(item);
    return this;
  }

  build(): PostMortem {
    return {
      incidentId: this.incident.id,
      title: `Post-Mortem: ${this.incident.title}`,
      summary: this.summaryText,
      timeline: [...this.events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
      rootCauses: [...this.rootCauses],
      actionItems: [...this.actionItems],
      createdAt: new Date(),
    };
  }

  /** Generate a markdown report for the post-mortem. */
  toMarkdown(): string {
    const pm = this.build();
    const lines = [
      `# ${pm.title}`,
      '',
      `**Date**: ${pm.createdAt.toISOString()}  `,
      `**Incident ID**: ${pm.incidentId}  `,
      '',
      '## Summary',
      '',
      pm.summary,
      '',
      '## Timeline',
      '',
      ...pm.timeline.map((e) => `- **${e.timestamp.toISOString()}**: ${e.description}`),
      '',
      '## Root Causes',
      '',
      ...pm.rootCauses.map((c) => `- ${c}`),
      '',
      '## Action Items',
      '',
      ...pm.actionItems.map(
        (a) => `- [ ] ${a.description}${a.owner != null ? ` (@${a.owner})` : ''}`,
      ),
      '',
    ];
    return lines.join('\n');
  }
}
