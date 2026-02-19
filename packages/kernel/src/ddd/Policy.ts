/**
 * Abstract base for domain policies.
 *
 * Policies encapsulate a specific business rule or calculation.
 * They follow the Strategy pattern and can be composed via `andThen()`.
 *
 * @template TInput  The input type this policy evaluates.
 * @template TOutput The result type produced by the policy.
 *
 * @example
 * ```ts
 * class SeasonalDiscountPolicy extends Policy<Order, number> {
 *   apply(order: Order): number {
 *     return order.isInSeason() ? order.total * 0.1 : 0;
 *   }
 * }
 *
 * // Compose policies
 * const totalDiscount = seasonalPolicy.andThen(loyaltyPolicy);
 * const discount = totalDiscount.apply(order);
 * ```
 */
export abstract class Policy<TInput, TOutput> {
  /** Evaluates the policy for the given input and returns the result. */
  abstract apply(input: TInput): TOutput;

  /**
   * Composes this policy with another, piping the output of this policy
   * as the input to the next.
   */
  andThen<TNext>(next: Policy<TOutput, TNext>): Policy<TInput, TNext> {
    return new ComposedPolicy<TInput, TOutput, TNext>(this, next);
  }
}

class ComposedPolicy<TInput, TMid, TOutput> extends Policy<TInput, TOutput> {
  constructor(
    private readonly first: Policy<TInput, TMid>,
    private readonly second: Policy<TMid, TOutput>,
  ) {
    super();
  }

  apply(input: TInput): TOutput {
    return this.second.apply(this.first.apply(input));
  }
}
