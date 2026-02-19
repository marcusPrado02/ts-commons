import { expect } from 'vitest';
import { Option, Result } from '@acme/kernel';

interface MatcherResult {
  pass: boolean;
  message: () => string;
}

const acmeMatchers = {
  toBeOk(received: unknown): MatcherResult {
    const pass = received instanceof Result && received.isOk();
    return {
      pass,
      message: () =>
        pass
          ? 'Expected value not to be an Ok Result'
          : 'Expected value to be an Ok Result, but it was Err or not a Result',
    };
  },

  toBeErr(received: unknown): MatcherResult {
    const pass = received instanceof Result && received.isErr();
    return {
      pass,
      message: () =>
        pass
          ? 'Expected value not to be an Err Result'
          : 'Expected value to be an Err Result, but it was Ok or not a Result',
    };
  },

  toBeSome(received: unknown): MatcherResult {
    const pass = received instanceof Option && received.isSome();
    return {
      pass,
      message: () =>
        pass
          ? 'Expected Option not to be Some'
          : 'Expected Option to be Some, but it was None or not an Option',
    };
  },

  toBeNone(received: unknown): MatcherResult {
    const pass = received instanceof Option && received.isNone();
    return {
      pass,
      message: () =>
        pass
          ? 'Expected Option not to be None'
          : 'Expected Option to be None, but it was Some or not an Option',
    };
  },
};

/**
 * Registers the custom `@acme` Vitest matchers.
 * Call once in a `beforeAll` or setup file.
 *
 * @example
 * ```typescript
 * import { registerAcmeMatchers } from '@acme/testing';
 * beforeAll(() => registerAcmeMatchers());
 *
 * it('...', () => {
 *   expect(Result.ok(42)).toBeOk();
 *   expect(Option.none()).toBeNone();
 * });
 * ```
 */
export function registerAcmeMatchers(): void {
  expect.extend(acmeMatchers);
}

// ─── Type augmentation ────────────────────────────────────────────────────────

declare module 'vitest' {
  interface Assertion<T> {
    /** Asserts that the value is a `Result.ok(...)`. */
    toBeOk(): T;
    /** Asserts that the value is a `Result.err(...)`. */
    toBeErr(): T;
    /** Asserts that the value is an `Option.some(...)`. */
    toBeSome(): T;
    /** Asserts that the value is an `Option.none()`. */
    toBeNone(): T;
  }
  interface AsymmetricMatchersContaining {
    toBeOk(): void;
    toBeErr(): void;
    toBeSome(): void;
    toBeNone(): void;
  }
}
