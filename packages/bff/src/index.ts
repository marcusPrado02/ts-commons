// Types
export type {
  ClientType,
  BffResponse,
  ServiceCall,
  AggregationResult,
  ResponseShaper,
  GraphQlField,
  GraphQlResult,
  GraphQlFieldError,
} from './types.js';

// Aggregation
export { ServiceAggregator } from './ServiceAggregator.js';

// Response shaping
export { FunctionResponseShaper, ResponseShaperRegistry } from './ResponseShaper.js';

// BFF response factory
export { createBffResponse } from './BffResponse.js';

// BFF implementations
export { RestBff } from './RestBff.js';
export { GraphQlBff } from './GraphQlBff.js';

// Router
export { BffRouter } from './BffRouter.js';
