import type { GraphQLPort } from './GraphQLPort';
import { OperationRegistry } from './OperationRegistry';
import type { OperationRegistration } from './OperationRegistry';
import type {
  FederationServiceInfo,
  GraphQLContext,
  GraphQLObject,
  GraphQLRequest,
  GraphQLResponse,
  GraphQLValue,
  SubscriptionHandler,
} from './GraphQLTypes';

// ---------------------------------------------------------------------------
// Operation name extraction
// ---------------------------------------------------------------------------

const OPERATION_NAME_RE = /(?:query|mutation|subscription)\s+(\w+)/;

function resolveOperationName(request: GraphQLRequest): string | undefined {
  if (request.operationName !== undefined) return request.operationName;
  const match = OPERATION_NAME_RE.exec(request.query);
  return match?.[1];
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

function buildErrorResponse(message: string): GraphQLResponse {
  return { data: null, errors: [{ message }] };
}

function buildDataResponse(name: string, value: GraphQLValue): GraphQLResponse {
  return { data: { [name]: value } };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Subscription helpers
// ---------------------------------------------------------------------------

function addHandler(
  map: Map<string, Set<SubscriptionHandler>>,
  topic: string,
  handler: SubscriptionHandler,
): void {
  const existing = map.get(topic) ?? new Set<SubscriptionHandler>();
  existing.add(handler);
  map.set(topic, existing);
}

// ---------------------------------------------------------------------------
// InMemoryGraphQLAdapter
// ---------------------------------------------------------------------------

/**
 * In-memory implementation of {@link GraphQLPort}.
 *
 * Executes GraphQL operations by first resolving the `operationName` from
 * the request (via explicit field or regex against the `query` string),
 * then dispatching to a registered resolver.
 *
 * Subscription support uses an in-process pub/sub backed by a `Map<topic,
 * Set<handler>>`.
 *
 * @example
 * ```ts
 * const adapter = new InMemoryGraphQLAdapter();
 * adapter.registerOperation({ type: 'query', name: 'GetUser', handler: getUserFn });
 * const result = await adapter.execute({ query: 'query GetUser { id }' }, ctx);
 * ```
 */
export class InMemoryGraphQLAdapter implements GraphQLPort {
  private readonly operations: OperationRegistry;
  private readonly subscriptions = new Map<string, Set<SubscriptionHandler>>();
  private readonly federationServices = new Map<string, FederationServiceInfo>();

  constructor(operations?: OperationRegistry) {
    this.operations = operations ?? new OperationRegistry();
  }

  registerOperation(registration: OperationRegistration): void {
    this.operations.register(registration);
  }

  async execute(request: GraphQLRequest, context: GraphQLContext): Promise<GraphQLResponse> {
    const name = resolveOperationName(request);
    if (name === undefined) return buildErrorResponse('Could not determine operation name');
    const reg = this.operations.get(name);
    if (reg === undefined) return buildErrorResponse(`Operation "${name}" not found`);
    return this.runHandler(reg.name, reg.handler, request, context);
  }

  private async runHandler(
    name: string,
    handler: OperationRegistration['handler'],
    request: GraphQLRequest,
    context: GraphQLContext,
  ): Promise<GraphQLResponse> {
    try {
      const result = await handler({}, request.variables ?? {}, context);
      return buildDataResponse(name, result);
    } catch (err) {
      return buildErrorResponse(errorMessage(err));
    }
  }

  subscribe(topic: string, handler: SubscriptionHandler): () => void {
    addHandler(this.subscriptions, topic, handler);
    return () => {
      const handlers = this.subscriptions.get(topic);
      if (handlers !== undefined) handlers.delete(handler);
    };
  }

  publish(topic: string, payload: GraphQLObject): void {
    const handlers = this.subscriptions.get(topic);
    if (handlers === undefined) return;
    for (const handler of handlers) {
      handler({ topic, payload });
    }
  }

  checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }

  // ---------------------------------------------------------------------------
  // Federation registry
  // ---------------------------------------------------------------------------

  registerFederationService(info: FederationServiceInfo): void {
    this.federationServices.set(info.name, info);
  }

  getFederationService(name: string): FederationServiceInfo | undefined {
    return this.federationServices.get(name);
  }

  getFederationServices(): readonly FederationServiceInfo[] {
    return [...this.federationServices.values()];
  }
}
