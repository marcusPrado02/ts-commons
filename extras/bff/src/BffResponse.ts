import type { BffResponse, ClientType } from './types.js';

/**
 * Convenience factory for building a {@link BffResponse}.
 *
 * @param data        The response payload.
 * @param clientType  The consuming client type.
 * @param statusCode  HTTP-like status code (defaults to `200`).
 */
export function createBffResponse<T>(
  data: T,
  clientType: ClientType,
  statusCode = 200,
): BffResponse<T> {
  return {
    data,
    statusCode,
    clientType,
    respondedAt: new Date(),
  };
}
