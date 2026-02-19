/**
 * Core OpenAPI 3.0 type definitions.
 * https://spec.openapis.org/oas/v3.0.3
 */

/** Primitive JSON Schema types used in OpenAPI. */
export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

/** Common string formats. */
export type StringFormat = 'date' | 'date-time' | 'email' | 'uri' | 'uuid' | 'password' | 'byte' | 'binary';

/** Common number formats. */
export type NumberFormat = 'float' | 'double' | 'int32' | 'int64';

/** An OpenAPI Schema Object (subset of JSON Schema). */
export interface SchemaObject {
  readonly type?: SchemaType;
  readonly format?: string;
  readonly description?: string;
  readonly example?: unknown;
  readonly nullable?: boolean;
  readonly readOnly?: boolean;
  readonly writeOnly?: boolean;
  /** Property schemas keyed by property name. */
  readonly properties?: Record<string, SchemaObject | RefObject>;
  /** Required property names. */
  readonly required?: string[];
  /** Schema for array items. */
  readonly items?: SchemaObject | RefObject;
  /** Minimum number of items. */
  readonly minItems?: number;
  /** Maximum number of items. */
  readonly maxItems?: number;
  /** Enum of allowed values. */
  readonly enum?: unknown[];
  /** Minimum value (numeric). */
  readonly minimum?: number;
  /** Maximum value (numeric). */
  readonly maximum?: number;
  /** Minimum string length. */
  readonly minLength?: number;
  /** Maximum string length. */
  readonly maxLength?: number;
  /** Pattern (regex) for string values. */
  readonly pattern?: string;
  /** Combines schemas with allOf. */
  readonly allOf?: (SchemaObject | RefObject)[];
  /** Combines schemas with oneOf. */
  readonly oneOf?: (SchemaObject | RefObject)[];
  /** Combines schemas with anyOf. */
  readonly anyOf?: (SchemaObject | RefObject)[];
}

/** A JSON Reference object ($ref pointer). */
export interface RefObject {
  readonly $ref: string;
}

/** Where a parameter appears. */
export type ParameterIn = 'query' | 'header' | 'path' | 'cookie';

/** An OpenAPI Parameter Object. */
export interface ParameterObject {
  readonly name: string;
  readonly in: ParameterIn;
  readonly description?: string;
  readonly required?: boolean;
  readonly schema?: SchemaObject | RefObject;
  readonly example?: unknown;
}

/** Media type object within a request body or response. */
export interface MediaTypeObject {
  readonly schema?: SchemaObject | RefObject;
  readonly example?: unknown;
}

/** Request Body Object. */
export interface RequestBodyObject {
  readonly description?: string;
  readonly content: Record<string, MediaTypeObject>;
  readonly required?: boolean;
}

/** Response Object. */
export interface ResponseObject {
  readonly description: string;
  readonly content?: Record<string, MediaTypeObject>;
  readonly headers?: Record<string, ParameterObject | RefObject>;
}

/** An OpenAPI Operation Object. */
export interface OperationObject {
  readonly operationId?: string;
  readonly summary?: string;
  readonly description?: string;
  readonly tags?: string[];
  readonly parameters?: (ParameterObject | RefObject)[];
  readonly requestBody?: RequestBodyObject;
  readonly responses: Record<string, ResponseObject | RefObject>;
  readonly deprecated?: boolean;
}

/** Allowed HTTP methods. */
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace';

/** A Path Item Object — operations keyed by HTTP method. */
export type PathItemObject = Partial<Record<HttpMethod, OperationObject>>;

/** Info Object. */
export interface InfoObject {
  readonly title: string;
  readonly version: string;
  readonly description?: string;
  readonly termsOfService?: string;
  readonly contact?: { name?: string; url?: string; email?: string };
  readonly license?: { name: string; url?: string };
}

/** Server Object. */
export interface ServerObject {
  readonly url: string;
  readonly description?: string;
}

/** Components Object. */
export interface ComponentsObject {
  readonly schemas?: Record<string, SchemaObject | RefObject>;
  readonly responses?: Record<string, ResponseObject | RefObject>;
  readonly parameters?: Record<string, ParameterObject | RefObject>;
  readonly requestBodies?: Record<string, RequestBodyObject | RefObject>;
}

/** A complete OpenAPI 3.0 Document. */
export interface OpenApiDocument {
  readonly openapi: '3.0.3';
  readonly info: InfoObject;
  readonly paths: Record<string, PathItemObject>;
  readonly servers?: ServerObject[];
  readonly components?: ComponentsObject;
  readonly tags?: { name: string; description?: string }[];
}
