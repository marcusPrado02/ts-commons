import type {
  OpenApiDocument,
  InfoObject,
  PathItemObject,
  OperationObject,
  HttpMethod,
  SchemaObject,
  RefObject,
  ServerObject,
  ResponseObject,
  ParameterObject,
  RequestBodyObject,
} from './OpenApiTypes';

/**
 * Fluent builder for a complete {@link OpenApiDocument} (OpenAPI 3.0.3).
 *
 * @example
 * ```ts
 * const spec = new OpenApiSpecBuilder('Acme API', '1.0.0')
 *   .description('Internal platform API')
 *   .server('https://api.acme.com', 'Production')
 *   .addOperation('/users', 'post', createUserOp)
 *   .addSchemaComponent('UserDto', userSchema)
 *   .build();
 * ```
 */
export class OpenApiSpecBuilder {
  private readonly _info: Record<string, unknown>;
  private readonly _paths: Map<string, Record<string, OperationObject>> = new Map();
  private readonly _servers: ServerObject[] = [];
  private readonly _schemaComponents: Map<string, SchemaObject | RefObject> = new Map();
  private readonly _responseComponents: Map<string, ResponseObject | RefObject> = new Map();
  private readonly _parameterComponents: Map<string, ParameterObject | RefObject> = new Map();
  private readonly _requestBodyComponents: Map<string, RequestBodyObject | RefObject> = new Map();
  private readonly _tags: { name: string; description?: string }[] = [];

  constructor(title: string, version: string) {
    this._info = { title, version };
  }

  description(description: string): this {
    this._info['description'] = description;
    return this;
  }

  termsOfService(url: string): this {
    this._info['termsOfService'] = url;
    return this;
  }

  contact(info: { name?: string; url?: string; email?: string }): this {
    this._info['contact'] = info;
    return this;
  }

  license(name: string, url?: string): this {
    const lic: Record<string, unknown> = { name };
    if (url !== undefined) lic['url'] = url;
    this._info['license'] = lic;
    return this;
  }

  /** Adds a server entry. */
  server(url: string, description?: string): this {
    const s: Record<string, unknown> = { url };
    if (description !== undefined) s['description'] = description;
    this._servers.push(s as unknown as ServerObject);
    return this;
  }

  /** Registers a tag with an optional description. */
  tag(name: string, description?: string): this {
    const t: Record<string, unknown> = { name };
    if (description !== undefined) t['description'] = description;
    this._tags.push(t as { name: string; description?: string });
    return this;
  }

  /** Adds an operation at the given path and HTTP method. */
  addOperation(path: string, method: HttpMethod, operation: OperationObject): this {
    const existing = this._paths.get(path) ?? {};
    existing[method] = operation;
    this._paths.set(path, existing);
    return this;
  }

  /** Adds an entire path item (all methods at once). */
  addPath(path: string, item: PathItemObject): this {
    const existing = this._paths.get(path) ?? {};
    for (const [method, op] of Object.entries(item) as [HttpMethod, OperationObject][]) {
      existing[method] = op;
    }
    this._paths.set(path, existing);
    return this;
  }

  // ---- Component helpers -------------------------------------------------

  addSchemaComponent(name: string, schema: SchemaObject | RefObject): this {
    this._schemaComponents.set(name, schema);
    return this;
  }

  addResponseComponent(name: string, response: ResponseObject | RefObject): this {
    this._responseComponents.set(name, response);
    return this;
  }

  addParameterComponent(name: string, parameter: ParameterObject | RefObject): this {
    this._parameterComponents.set(name, parameter);
    return this;
  }

  addRequestBodyComponent(name: string, requestBody: RequestBodyObject | RefObject): this {
    this._requestBodyComponents.set(name, requestBody);
    return this;
  }

  build(): OpenApiDocument {
    const paths: Record<string, PathItemObject> = {};
    for (const [path, methods] of this._paths) {
      paths[path] = methods as PathItemObject;
    }

    const doc: Record<string, unknown> = {
      openapi: '3.0.3' as const,
      info: this._info as unknown as InfoObject,
      paths,
    };

    if (this._servers.length > 0) doc['servers'] = [...this._servers];
    if (this._tags.length > 0) doc['tags'] = [...this._tags];

    const components = this.buildComponents();
    if (components !== undefined) doc['components'] = components;

    return doc as unknown as OpenApiDocument;
  }

  private buildComponents(): Record<string, unknown> | undefined {
    const hasAny =
      this._schemaComponents.size > 0 ||
      this._responseComponents.size > 0 ||
      this._parameterComponents.size > 0 ||
      this._requestBodyComponents.size > 0;

    if (!hasAny) return undefined;

    const components: Record<string, unknown> = {};
    this.copyMapToRecord(this._schemaComponents, components, 'schemas');
    this.copyMapToRecord(this._responseComponents, components, 'responses');
    this.copyMapToRecord(this._parameterComponents, components, 'parameters');
    this.copyMapToRecord(this._requestBodyComponents, components, 'requestBodies');
    return components;
  }

  private copyMapToRecord<T>(
    map: Map<string, T>,
    target: Record<string, unknown>,
    key: string,
  ): void {
    if (map.size === 0) return;
    const record: Record<string, T> = {};
    for (const [name, value] of map) {
      record[name] = value;
    }
    target[key] = record;
  }

  /**
   * Serializes the document to a JSON string.
   * Compatible with Swagger UI and ReDoc `spec` option.
   */
  toJSON(): string {
    return JSON.stringify(this.build(), null, 2);
  }
}
