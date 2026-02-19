/**
 * Numeric log levels — higher value = more severe.
 * Used by `LevelFilterLogger` to suppress low-priority messages at runtime.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO  = 1,
  WARN  = 2,
  ERROR = 3,
}
