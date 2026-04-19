import type { MigrationAction, MigrationRequest, MigrationEntry } from '../cli/CliTypes';

/**
 * Manages a list of migration entries and simulates common migration operations
 * (create, up, down, status) without requiring a real database connection.
 *
 * @example
 * ```typescript
 * const cmd = new MigrationCommand();
 * cmd.register({ name: 'AddUserTable', status: 'pending' });
 * cmd.execute({ action: 'up' });
 * ```
 */
export class MigrationCommand {
  private readonly entries: MigrationEntry[] = [];

  private readonly supportedActions: MigrationAction[] = ['create', 'up', 'down', 'status'];

  /** Register a migration by hand (used in tests / dry-run mode). */
  register(entry: MigrationEntry): void {
    this.entries.push({ ...entry });
  }

  /** All registered migrations in registration order. */
  getAll(): MigrationEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }

  getByStatus(status: MigrationEntry['status']): MigrationEntry[] {
    return this.entries.filter((e) => e.status === status).map((e) => ({ ...e }));
  }

  count(): number {
    return this.entries.length;
  }

  isSupported(action: string): action is MigrationAction {
    return this.supportedActions.includes(action as MigrationAction);
  }

  getSupportedActions(): MigrationAction[] {
    return [...this.supportedActions];
  }

  /**
   * Execute a migration request against the in-memory registry.
   * Returns a human-readable summary string.
   */
  execute(request: MigrationRequest): string {
    switch (request.action) {
      case 'create':
        return this.handleCreate(request.name);
      case 'up':
        return this.handleUp(request.steps ?? 0);
      case 'down':
        return this.handleDown(request.steps ?? 1);
      case 'status':
        return this.handleStatus();
    }
  }

  private handleCreate(name: string | undefined): string {
    if (name === undefined || name.trim().length === 0) {
      return 'ERROR: Migration name is required for "create"';
    }
    const entry: MigrationEntry = { name, status: 'pending' };
    this.entries.push(entry);
    return `Created migration: ${name}`;
  }

  private handleUp(steps: number): string {
    const pending = this.entries.filter((e) => e.status === 'pending');
    const toApply = steps > 0 ? pending.slice(0, steps) : pending;
    if (toApply.length === 0) return 'No pending migrations to apply';
    for (const e of this.entries) {
      if (toApply.some((t) => t.name === e.name)) {
        e.status = 'applied';
        e.appliedAt = new Date();
      }
    }
    return `Applied ${toApply.length} migration(s)`;
  }

  private handleDown(steps: number): string {
    const applied = this.entries.filter((e) => e.status === 'applied').reverse();
    const toRevert = applied.slice(0, steps);
    if (toRevert.length === 0) return 'No applied migrations to revert';
    for (const e of this.entries) {
      if (toRevert.some((t) => t.name === e.name)) {
        e.status = 'reverted';
      }
    }
    return `Reverted ${toRevert.length} migration(s)`;
  }

  private handleStatus(): string {
    if (this.entries.length === 0) return 'No migrations registered';
    const lines = this.entries.map(
      (e) =>
        `  [${e.status.padEnd(8)}] ${e.name}${e.appliedAt !== undefined ? ` (applied at ${e.appliedAt.toISOString()})` : ''}`,
    );
    return `Migrations:\n${lines.join('\n')}`;
  }

  clear(): void {
    this.entries.splice(0, this.entries.length);
  }
}
