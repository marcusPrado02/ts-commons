import type { IdempotencyKey } from './IdempotencyKey';
import type { Command } from '../cqrs/Command';

/**
 * Command with idempotency key.
 */
export interface IdempotentCommand extends Command {
  readonly idempotencyKey: IdempotencyKey;
}
