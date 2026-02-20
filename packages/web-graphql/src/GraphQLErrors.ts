/** Thrown when an SDL fragment or schema definition is invalid. */
export class GraphQLSchemaError extends Error {
  override readonly name = 'GraphQLSchemaError';
  constructor(
    readonly fragmentName: string,
    reason: string,
  ) {
    super(`Schema error in fragment "${fragmentName}": ${reason}`);
  }
}

/** Thrown when a resolver function throws an unexpected exception. */
export class GraphQLResolverError extends Error {
  override readonly name = 'GraphQLResolverError';
  constructor(
    readonly operationName: string,
    override readonly cause?: unknown,
  ) {
    super(`Resolver error for operation "${operationName}"`);
  }
}

/** Thrown when a subscription operation fails. */
export class GraphQLSubscriptionError extends Error {
  override readonly name = 'GraphQLSubscriptionError';
  constructor(
    readonly topic: string,
    override readonly cause?: unknown,
  ) {
    super(`Subscription error for topic "${topic}"`);
  }
}

/** Thrown when a federation service cannot be reached or introspected. */
export class GraphQLFederationError extends Error {
  override readonly name = 'GraphQLFederationError';
  constructor(
    readonly serviceName: string,
    override readonly cause?: unknown,
  ) {
    super(`Federation error for service "${serviceName}"`);
  }
}

/** Thrown when the requested operation is not registered. */
export class GraphQLOperationNotFoundError extends Error {
  override readonly name = 'GraphQLOperationNotFoundError';
  constructor(readonly operationName: string) {
    super(`GraphQL operation "${operationName}" is not registered`);
  }
}

/** Thrown when a schema fragment is registered more than once. */
export class GraphQLFragmentAlreadyRegisteredError extends Error {
  override readonly name = 'GraphQLFragmentAlreadyRegisteredError';
  constructor(readonly fragmentName: string) {
    super(`Schema fragment "${fragmentName}" is already registered`);
  }
}
