import type {
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  RefObject,
  MediaTypeObject,
} from './OpenApiTypes';

/**
 * Fluent builder for an {@link OperationObject}.
 *
 * @example
 * ```ts
 * const op = new OperationBuilder()
 *   .operationId('createUser')
 *   .summary('Create a new user')
 *   .tag('Users')
 *   .requestBody('application/json', { schema: SchemaBuilder.ref('CreateUserDto') })
 *   .response(201, 'User created', 'application/json', { schema: SchemaBuilder.ref('UserDto') })
 *   .response(400, 'Validation error')
 *   .build();
 * ```
 */
export class OperationBuilder {
  private _operationId?: string;
  private _summary?: string;
  private _description?: string;
  private readonly _tags: string[] = [];
  private readonly _parameters: (ParameterObject | RefObject)[] = [];
  private _requestBody?: RequestBodyObject;
  private readonly _responses: Map<string, ResponseObject | RefObject> = new Map();
  private _deprecated = false;

  operationId(id: string): this {
    this._operationId = id;
    return this;
  }

  summary(summary: string): this {
    this._summary = summary;
    return this;
  }

  description(description: string): this {
    this._description = description;
    return this;
  }

  tag(...tags: string[]): this {
    this._tags.push(...tags);
    return this;
  }

  /** Adds a path, query, header or cookie parameter. */
  addParameter(param: ParameterObject): this {
    this._parameters.push(param);
    return this;
  }

  /** Sets the request body. */
  requestBody(
    contentType: string,
    media: MediaTypeObject,
    options: { description?: string; required?: boolean } = {},
  ): this {
    const content: Record<string, MediaTypeObject> = { [contentType]: media };
    const body: Record<string, unknown> = { content };
    if (options.description !== undefined) body['description'] = options.description;
    if (options.required !== undefined) body['required'] = options.required;
    this._requestBody = body as unknown as RequestBodyObject;
    return this;
  }

  /** Adds a response for a given HTTP status code (number or "default"). */
  response(
    status: number | 'default',
    description: string,
    contentType?: string,
    media?: MediaTypeObject,
  ): this {
    const resp: Record<string, unknown> = { description };
    if (contentType !== undefined && media !== undefined) {
      resp['content'] = { [contentType]: media };
    }
    this._responses.set(String(status), resp as unknown as ResponseObject);
    return this;
  }

  /** Sets a $ref response instead of an inline response object. */
  responseRef(status: number | 'default', ref: string): this {
    this._responses.set(String(status), { $ref: ref });
    return this;
  }

  deprecated(value = true): this {
    this._deprecated = value;
    return this;
  }

  build(): OperationObject {
    const responses: Record<string, ResponseObject | RefObject> = {};
    for (const [status, resp] of this._responses) {
      responses[status] = resp;
    }

    const op: Record<string, unknown> = { responses };

    if (this._operationId !== undefined) op['operationId'] = this._operationId;
    if (this._summary !== undefined) op['summary'] = this._summary;
    if (this._description !== undefined) op['description'] = this._description;
    if (this._tags.length > 0) op['tags'] = [...this._tags];
    if (this._parameters.length > 0) op['parameters'] = [...this._parameters];
    if (this._requestBody !== undefined) op['requestBody'] = this._requestBody;
    if (this._deprecated) op['deprecated'] = true;

    return op as unknown as OperationObject;
  }
}
