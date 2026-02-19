/**
 * Marker interface for Domain Services.
 *
 * Domain services encapsulate domain logic that doesn't naturally belong
 * inside an entity or value object — typically when an operation involves
 * multiple aggregates or crosses aggregate boundaries.
 *
 * All domain services must provide a `serviceName` for logging / tracing.
 *
 * @example
 * ```ts
 * class TransferService implements DomainService {
 *   readonly serviceName = 'TransferService';
 *
 *   transfer(from: Account, to: Account, amount: Money): Result<void, DomainError> {
 *     const debitResult = from.debit(amount);
 *     if (debitResult.isErr()) return debitResult;
 *     return to.credit(amount);
 *   }
 * }
 * ```
 */
export interface DomainService {
  /** Human-readable name used for logging and tracing. */
  readonly serviceName: string;
}
