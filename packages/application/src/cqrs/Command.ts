/**
 * Marker interface for commands.
 * Commands represent intent to change state.
 */
export interface Command {
  readonly _brand?: 'Command';
}
