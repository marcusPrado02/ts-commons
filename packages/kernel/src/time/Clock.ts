/**
 * Clock abstraction for testable time-dependent code.
 */
export interface Clock {
  now(): Date;
  timestamp(): number;
}
