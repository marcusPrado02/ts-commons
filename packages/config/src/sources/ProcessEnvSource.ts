import type { ConfigSource } from './ConfigSource';

/**
 * Config source from process.env.
 */
export class ProcessEnvSource implements ConfigSource {
  load(): Promise<Record<string, string | undefined>> {
    return Promise.resolve({ ...process.env });
  }
}
