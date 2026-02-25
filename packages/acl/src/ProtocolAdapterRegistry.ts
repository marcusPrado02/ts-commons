import type { ProtocolAdapter } from './types.js';

type AnyProtocolAdapter = ProtocolAdapter<unknown, unknown, unknown, unknown>;

/**
 * Registry that maps string keys to {@link ProtocolAdapter} instances.
 *
 * A protocol adapter translates between the external wire representation
 * (e.g. HTTP/JSON, gRPC, SOAP) and the internal domain model.
 */
export class ProtocolAdapterRegistry {
  private readonly map = new Map<string, AnyProtocolAdapter>();

  /**
   * Register a protocol adapter under a given key.
   * Returns `this` for a fluent API.
   */
  register<TExtReq, TIntReq, TIntRes, TExtRes>(
    key: string,
    adapter: ProtocolAdapter<TExtReq, TIntReq, TIntRes, TExtRes>,
  ): this {
    this.map.set(key, adapter as AnyProtocolAdapter);
    return this;
  }

  /**
   * Translate an external request to the internal domain representation.
   * @throws {Error} when no adapter is registered for `key`.
   */
  adaptRequest<TExtReq, TIntReq>(key: string, external: TExtReq): TIntReq {
    const adapter = this.map.get(key);
    if (adapter === undefined) {
      throw new Error(`No protocol adapter registered for: "${key}"`);
    }
    return adapter.adaptRequest(external) as TIntReq;
  }

  /**
   * Translate an internal response to the external wire representation.
   * @throws {Error} when no adapter is registered for `key`.
   */
  adaptResponse<TIntRes, TExtRes>(key: string, internal: TIntRes): TExtRes {
    const adapter = this.map.get(key);
    if (adapter === undefined) {
      throw new Error(`No protocol adapter registered for: "${key}"`);
    }
    return adapter.adaptResponse(internal) as TExtRes;
  }

  /** Returns `true` if an adapter is registered under `key`. */
  has(key: string): boolean {
    return this.map.has(key);
  }

  /** Number of registered adapters. */
  size(): number {
    return this.map.size;
  }
}
