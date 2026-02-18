import type { ConfigSource } from './ConfigSource';

/**
 * Config source from process.env.
 */
export class ProcessEnvSource implements ConfigSource {
  async load(): Promise<Record<string, string | undefined>> {
    return { ...process.env };
  }
}
