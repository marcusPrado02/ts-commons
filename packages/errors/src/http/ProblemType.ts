/**
 * Standard problem types following RFC 7807.
 */
export const ProblemType = {
  BAD_REQUEST: 'https://httpstatuses.com/400',
  UNAUTHORIZED: 'https://httpstatuses.com/401',
  FORBIDDEN: 'https://httpstatuses.com/403',
  NOT_FOUND: 'https://httpstatuses.com/404',
  CONFLICT: 'https://httpstatuses.com/409',
  UNPROCESSABLE_ENTITY: 'https://httpstatuses.com/422',
  INTERNAL_SERVER_ERROR: 'https://httpstatuses.com/500',
  SERVICE_UNAVAILABLE: 'https://httpstatuses.com/503',
} as const;
