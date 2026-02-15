import type { Middleware } from '../http/Middleware';
import { CORRELATION_ID_HEADER } from '@acme/contracts';
import { CorrelationId } from '@acme/kernel';

export function correlationMiddleware(): Middleware {
  return async (context, next) => {
    const correlationIdHeader = context.request.headers[CORRELATION_ID_HEADER.toLowerCase()];
    const correlationId =
      typeof correlationIdHeader === 'string'
        ? CorrelationId.fromString(correlationIdHeader)
        : CorrelationId.create();

    context.locals.set('correlationId', correlationId);

    if (!context.response.headers) {
      context.response = { ...context.response, headers: {} };
    }
    context.response.headers![CORRELATION_ID_HEADER] = correlationId.value;

    await next();
  };
}
