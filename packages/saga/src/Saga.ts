import { SagaTransaction } from './SagaTransaction';
import type { SagaResult, SagaTransactionOptions } from './types';

export function sagaOk<T>(value: T): SagaResult<T> {
  return { success: true, value };
}

export function sagaErr<T>(error: unknown): SagaResult<T> {
  return { success: false, error };
}

export abstract class Saga<I = unknown, O = unknown> {
  protected begin(options?: SagaTransactionOptions): SagaTransaction {
    return new SagaTransaction(options);
  }

  abstract execute(input: I): Promise<SagaResult<O>>;
}
