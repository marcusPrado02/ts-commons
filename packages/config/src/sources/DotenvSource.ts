import type { ConfigSource } from './ConfigSource';
import { readFile } from 'node:fs/promises';

/**
 * Config source from .env file.
 * Only use in development; production should use process.env.
 */
export class DotenvSource implements ConfigSource {
  constructor(private readonly path: string = '.env') {}

  async load(): Promise<Record<string, string | undefined>> {
    try {
      const content = await readFile(this.path, 'utf-8');
      return this.parse(content);
    } catch (error: unknown) {
      // .env file is optional - this is expected behavior
      // Error could be ENOENT (file not found) or permission issues
      return {};
    }
  }

  private parse(content: string): Record<string, string> {
    const result: Record<string, string> = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split('=');
      if (key !== undefined && key !== '' && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        // Remove quotes if present
        result[key.trim()] = value.replaceAll(/^["']|["']$/g, '');
      }
    }

    return result;
  }
}
