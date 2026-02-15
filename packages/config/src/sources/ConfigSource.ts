/**
 * Source for loading configuration.
 */
export interface ConfigSource {
  load(): Promise<Record<string, string | undefined>>;
}
