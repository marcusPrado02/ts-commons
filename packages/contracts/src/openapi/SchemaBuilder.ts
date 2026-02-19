import type { SchemaObject, RefObject } from './OpenApiTypes';

/**
 * Fluent builder for {@link SchemaObject}.
 *
 * @example
 * ```ts
 * const schema = SchemaBuilder.object()
 *   .property('id', SchemaBuilder.string().format('uuid').build())
 *   .property('email', SchemaBuilder.string().format('email').build())
 *   .required('id', 'email')
 *   .build();
 * ```
 */
export class SchemaBuilder {
  private readonly _schema: Record<string, unknown> = {};

  private constructor(type?: string) {
    if (type !== undefined) {
      this._schema['type'] = type;
    }
  }

  // ---- Static factories -----------------------------------------------

  static string(): SchemaBuilder {
    return new SchemaBuilder('string');
  }

  static number(): SchemaBuilder {
    return new SchemaBuilder('number');
  }

  static integer(): SchemaBuilder {
    return new SchemaBuilder('integer');
  }

  static boolean(): SchemaBuilder {
    return new SchemaBuilder('boolean');
  }

  static object(): SchemaBuilder {
    return new SchemaBuilder('object');
  }

  static array(): SchemaBuilder {
    return new SchemaBuilder('array');
  }

  /** Creates a schema for an array whose items match the given schema. */
  static arrayOf(items: SchemaObject | RefObject): SchemaBuilder {
    return new SchemaBuilder('array').items(items);
  }

  /** Creates a $ref pointer to a named component schema. */
  static ref(name: string): RefObject {
    return { $ref: `#/components/schemas/${name}` };
  }

  // ---- Fluent setters -------------------------------------------------

  format(format: string): this {
    this._schema['format'] = format;
    return this;
  }

  description(description: string): this {
    this._schema['description'] = description;
    return this;
  }

  example(value: unknown): this {
    this._schema['example'] = value;
    return this;
  }

  nullable(value = true): this {
    this._schema['nullable'] = value;
    return this;
  }

  readOnly(value = true): this {
    this._schema['readOnly'] = value;
    return this;
  }

  writeOnly(value = true): this {
    this._schema['writeOnly'] = value;
    return this;
  }

  enum(values: unknown[]): this {
    this._schema['enum'] = values;
    return this;
  }

  minimum(value: number): this {
    this._schema['minimum'] = value;
    return this;
  }

  maximum(value: number): this {
    this._schema['maximum'] = value;
    return this;
  }

  minLength(value: number): this {
    this._schema['minLength'] = value;
    return this;
  }

  maxLength(value: number): this {
    this._schema['maxLength'] = value;
    return this;
  }

  pattern(regex: string): this {
    this._schema['pattern'] = regex;
    return this;
  }

  items(schema: SchemaObject | RefObject): this {
    this._schema['items'] = schema;
    return this;
  }

  minItems(value: number): this {
    this._schema['minItems'] = value;
    return this;
  }

  maxItems(value: number): this {
    this._schema['maxItems'] = value;
    return this;
  }

  /** Adds a named property to an object schema. */
  property(name: string, schema: SchemaObject | RefObject): this {
    if (this._schema['properties'] === undefined) {
      this._schema['properties'] = {} as Record<string, unknown>;
    }
    (this._schema['properties'] as Record<string, unknown>)[name] = schema;
    return this;
  }

  /** Marks one or more property names as required. */
  required(...names: string[]): this {
    const current = (this._schema['required'] as string[] | undefined) ?? [];
    this._schema['required'] = [...current, ...names];
    return this;
  }

  allOf(schemas: (SchemaObject | RefObject)[]): this {
    this._schema['allOf'] = schemas;
    return this;
  }

  oneOf(schemas: (SchemaObject | RefObject)[]): this {
    this._schema['oneOf'] = schemas;
    return this;
  }

  anyOf(schemas: (SchemaObject | RefObject)[]): this {
    this._schema['anyOf'] = schemas;
    return this;
  }

  build(): SchemaObject {
    return { ...this._schema } as SchemaObject;
  }
}
