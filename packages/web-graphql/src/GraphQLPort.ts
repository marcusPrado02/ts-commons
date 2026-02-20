import type {
  GraphQLContext,
  GraphQLObject,
  GraphQLRequest,
  GraphQLResponse,
  SubscriptionHandler,
} from './GraphQLTypes';

/**
 * Primary port for executing GraphQL operations and managing subscriptions.
 *
 * Uses a schema-first model where SDL fragments are registered separately
 * via {@link SchemaRegistry} and resolvers are registered via
 * {@link OperationRegistry}.
 */
export interface GraphQLPort {
  /**
   * Execute a query or mutation.
   *
   * Never throws — errors are captured in `response.errors`.
   */
  execute(request: GraphQLRequest, context: GraphQLContext): Promise<GraphQLResponse>;

  /**
   * Subscribe to events published on `topic`.
   *
   * Returns an unsubscribe function.
   */
  subscribe(topic: string, handler: SubscriptionHandler): () => void;

  /**
   * Publish an event to all subscribers of `topic`.
   */
  publish(topic: string, payload: GraphQLObject): void;

  /** Return `true` when the adapter is ready to serve requests. */
  checkHealth(): Promise<boolean>;
}
