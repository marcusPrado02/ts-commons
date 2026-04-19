import type { CdcEvent, FilterOptions } from './types.js';

/**
 * Filters {@link CdcEvent} objects based on configurable inclusion/exclusion rules.
 *
 * Filter precedence:
 * 1. `database` — event must match exactly.
 * 2. `excludeTables` — event table must NOT be in the list.
 * 3. `includeTables` — event table MUST be in the list (absent = allow all).
 * 4. `includeOperations` — event operation MUST be in the list (absent = allow all).
 */
export class CdcFilter {
  private readonly options: FilterOptions;

  constructor(options: FilterOptions = {}) {
    this.options = options;
  }

  /**
   * Returns `true` if the event passes all configured filter criteria.
   */
  matches(event: CdcEvent): boolean {
    if (!this.matchesDatabase(event)) return false;
    if (!this.matchesExcludeTables(event)) return false;
    if (!this.matchesIncludeTables(event)) return false;
    if (!this.matchesOperations(event)) return false;
    return true;
  }

  /**
   * Filter an array of events, returning only those that pass.
   */
  filter(events: ReadonlyArray<CdcEvent>): CdcEvent[] {
    return events.filter((e) => this.matches(e));
  }

  private matchesDatabase(event: CdcEvent): boolean {
    return this.options.database === undefined || event.database === this.options.database;
  }

  private matchesExcludeTables(event: CdcEvent): boolean {
    return this.options.excludeTables?.includes(event.table) !== true;
  }

  private matchesIncludeTables(event: CdcEvent): boolean {
    return (
      this.options.includeTables === undefined || this.options.includeTables.includes(event.table)
    );
  }

  private matchesOperations(event: CdcEvent): boolean {
    return (
      this.options.includeOperations === undefined ||
      this.options.includeOperations.includes(event.operation)
    );
  }
}
