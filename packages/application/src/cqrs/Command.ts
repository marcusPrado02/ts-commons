/**
 * Marker interface for commands.
 * Commands represent intent to change state.
 */
export interface Command {
  readonly _brand?: 'Command';
}

/**
 * Base class for commands to ensure proper typing
 */
export abstract class BaseCommand implements Command {
  readonly _brand?: 'Command';
}
