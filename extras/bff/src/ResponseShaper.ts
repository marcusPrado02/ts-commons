import type { ResponseShaper, ClientType } from './types.js';

/**
 * Wraps a plain function as a {@link ResponseShaper}.
 */
export class FunctionResponseShaper<TFrom, TTo> implements ResponseShaper<TFrom, TTo> {
  constructor(
    readonly clientType: ClientType,
    private readonly fn: (data: TFrom) => TTo,
  ) {}

  shape(data: TFrom): TTo {
    return this.fn(data);
  }
}

/**
 * Registry that maps {@link ClientType} values to {@link ResponseShaper}
 * instances, allowing client-specific response shaping to be looked up
 * at runtime.
 */
export class ResponseShaperRegistry<TFrom, TTo> {
  private readonly map = new Map<ClientType, ResponseShaper<TFrom, TTo>>();

  /**
   * Register a shaper for a given client type.
   * Returns `this` for a fluent API.
   */
  register(shaper: ResponseShaper<TFrom, TTo>): this {
    this.map.set(shaper.clientType, shaper);
    return this;
  }

  /**
   * Shape `data` for `clientType`, or return it unchanged when no shaper
   * is registered for that client.
   */
  shape(clientType: ClientType, data: TFrom): TFrom | TTo {
    const shaper = this.map.get(clientType);
    if (shaper === undefined) {
      return data;
    }
    return shaper.shape(data);
  }

  /** Returns `true` if a shaper is registered for `clientType`. */
  has(clientType: ClientType): boolean {
    return this.map.has(clientType);
  }

  /** Number of registered shapers. */
  size(): number {
    return this.map.size;
  }
}
