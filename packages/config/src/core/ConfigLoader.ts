import type { ConfigSchema } from './ConfigSchema';
import type { ConfigSource } from '../sources/ConfigSource';
import { ConfigError } from './ConfigError';

/**
 * Config loader with schema validation.
 */
export class ConfigLoader<T> {
  constructor(
    private readonly schema: ConfigSchema<T>,
    private readonly sources: ConfigSource[],
  ) {}

  async load(): Promise<T> {
    const rawConfig: Record<string, string | undefined> = {};

    // Load from all sources (later sources override earlier ones)
    for (const source of this.sources) {
      const sourceConfig = await source.load();
      Object.assign(rawConfig, sourceConfig);
    }

    // Validate against schema
    const result = this.schema.validate(rawConfig);

    return result.match({
      ok: (config) => config,
      err: (errors) => {
        throw new ConfigError('Configuration validation failed', errors);
      },
    });
  }
}
