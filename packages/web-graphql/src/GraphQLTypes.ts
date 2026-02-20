// ---------------------------------------------------------------------------
// Scalar / value types
// ---------------------------------------------------------------------------

export type GraphQLScalar = string | number | boolean | null;
export type GraphQLObject = Readonly<Record<string, unknown>>;
export type GraphQLList = ReadonlyArray<unknown>;
export type GraphQLValue =
  | GraphQLScalar
  | Readonly<Record<string, unknown>>
  | ReadonlyArray<unknown>;
export type GraphQLVariables = Readonly<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Request / response
// ---------------------------------------------------------------------------

export interface GraphQLRequest {
  readonly query: string;
  readonly operationName?: string;
  readonly variables?: GraphQLVariables;
}

export interface GraphQLErrorLocation {
  readonly line: number;
  readonly column: number;
}

/** RFC 7807 Problem Details fields surfaced as GraphQL error extensions. */
export interface GraphQLErrorExtensions {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
}

export interface GraphQLError {
  readonly message: string;
  readonly locations?: readonly GraphQLErrorLocation[];
  readonly path?: readonly (string | number)[];
  readonly extensions?: GraphQLErrorExtensions;
}

export interface GraphQLResponse {
  readonly data?: GraphQLObject | null;
  readonly errors?: readonly GraphQLError[];
  readonly extensions?: GraphQLObject;
}

// ---------------------------------------------------------------------------
// Resolver types
// ---------------------------------------------------------------------------

export interface GraphQLContext {
  readonly requestId: string;
  readonly userId?: string;
  readonly tenantId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export type ResolverFn = (
  parent: GraphQLObject,
  args: GraphQLVariables,
  context: GraphQLContext,
) => Promise<GraphQLValue>;

// ---------------------------------------------------------------------------
// Subscription types
// ---------------------------------------------------------------------------

export interface SubscriptionEvent {
  readonly topic: string;
  readonly payload: GraphQLObject;
}

export type SubscriptionHandler = (event: SubscriptionEvent) => void;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface SDLFragment {
  /** Unique name identifying this schema fragment (e.g. 'User', 'Query'). */
  readonly name: string;
  /** SDL text for this fragment. */
  readonly sdl: string;
}

// ---------------------------------------------------------------------------
// Federation
// ---------------------------------------------------------------------------

export interface FederationServiceInfo {
  readonly name: string;
  readonly url: string;
  readonly sdl: string;
}
