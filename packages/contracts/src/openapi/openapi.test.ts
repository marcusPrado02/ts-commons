/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import { SchemaBuilder } from '../openapi/SchemaBuilder';
import { OperationBuilder } from '../openapi/OperationBuilder';
import { OpenApiSpecBuilder } from '../openapi/OpenApiSpecBuilder';
import { ApiVersion } from '../versioning/ApiVersion';

// ---------------------------------------------------------------------------
// Suite 1: SchemaBuilder
// ---------------------------------------------------------------------------

describe('SchemaBuilder', () => {
  it('string() produces type:string schema', () => {
    const schema = SchemaBuilder.string().build();
    expect(schema.type).toBe('string');
  });

  it('number().format() sets format on the schema', () => {
    const schema = SchemaBuilder.number().format('float').build();
    expect(schema.type).toBe('number');
    expect(schema.format).toBe('float');
  });

  it('object().property().required() builds an object schema', () => {
    const schema = SchemaBuilder.object()
      .property('id', SchemaBuilder.string().format('uuid').build())
      .property('name', SchemaBuilder.string().build())
      .required('id', 'name')
      .build();

    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('id');
    expect(schema.properties).toHaveProperty('name');
    expect(schema.required).toContain('id');
    expect(schema.required).toContain('name');
  });

  it('arrayOf() wraps a schema as items', () => {
    const itemSchema = SchemaBuilder.string().build();
    const schema = SchemaBuilder.arrayOf(itemSchema).build();
    expect(schema.type).toBe('array');
    expect(schema.items).toEqual(itemSchema);
  });

  it('ref() creates a $ref pointer to components/schemas', () => {
    const ref = SchemaBuilder.ref('UserDto');
    expect(ref.$ref).toBe('#/components/schemas/UserDto');
  });
});

// ---------------------------------------------------------------------------
// Suite 2: OperationBuilder
// ---------------------------------------------------------------------------

describe('OperationBuilder', () => {
  it('operationId() and summary() are reflected in build()', () => {
    const op = new OperationBuilder()
      .operationId('listUsers')
      .summary('List all users')
      .response(200, 'OK')
      .build();

    expect(op.operationId).toBe('listUsers');
    expect(op.summary).toBe('List all users');
  });

  it('addParameter() adds a query parameter', () => {
    const op = new OperationBuilder()
      .addParameter({ name: 'page', in: 'query', required: false })
      .response(200, 'OK')
      .build();

    expect(op.parameters).toHaveLength(1);
    expect(op.parameters?.[0]).toMatchObject({ name: 'page', in: 'query' });
  });

  it('requestBody() sets content on the operation', () => {
    const op = new OperationBuilder()
      .requestBody('application/json', { schema: SchemaBuilder.ref('CreateUserDto') }, { required: true })
      .response(201, 'Created')
      .build();

    expect(op.requestBody).toBeDefined();
    expect(op.requestBody?.content).toHaveProperty('application/json');
  });

  it('response() maps status codes to response objects', () => {
    const op = new OperationBuilder()
      .response(200, 'OK')
      .response(404, 'Not found')
      .build();

    expect(op.responses).toHaveProperty('200');
    expect(op.responses).toHaveProperty('404');
    expect(op.responses['200']).toMatchObject({ description: 'OK' });
  });

  it('tag() and deprecated() are included in the built operation', () => {
    const op = new OperationBuilder()
      .tag('Users', 'Admin')
      .deprecated()
      .response(200, 'OK')
      .build();

    expect(op.tags).toEqual(['Users', 'Admin']);
    expect(op.deprecated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: OpenApiSpecBuilder
// ---------------------------------------------------------------------------

describe('OpenApiSpecBuilder', () => {
  it('build() sets openapi version, title and version from constructor', () => {
    const doc = new OpenApiSpecBuilder('Acme API', '1.2.3').build();

    expect(doc.openapi).toBe('3.0.3');
    expect(doc.info.title).toBe('Acme API');
    expect(doc.info.version).toBe('1.2.3');
  });

  it('server() adds entries to the servers array', () => {
    const doc = new OpenApiSpecBuilder('API', '1.0.0')
      .server('https://api.acme.com', 'Production')
      .server('https://staging.acme.com', 'Staging')
      .build();

    expect(doc.servers).toHaveLength(2);
    expect(doc.servers?.[0]?.url).toBe('https://api.acme.com');
  });

  it('addOperation() places the operation under the correct path and method', () => {
    const op = new OperationBuilder().operationId('getUser').response(200, 'OK').build();
    const doc = new OpenApiSpecBuilder('API', '1.0.0').addOperation('/users/{id}', 'get', op).build();

    expect(doc.paths['/users/{id}']).toBeDefined();
    expect(doc.paths['/users/{id}']?.get?.operationId).toBe('getUser');
  });

  it('addSchemaComponent() populates components.schemas', () => {
    const schema = SchemaBuilder.object()
      .property('id', SchemaBuilder.string().build())
      .build();

    const doc = new OpenApiSpecBuilder('API', '1.0.0').addSchemaComponent('UserDto', schema).build();

    expect(doc.components?.schemas).toHaveProperty('UserDto');
  });

  it('toJSON() serializes to a valid JSON string', () => {
    const json = new OpenApiSpecBuilder('API', '1.0.0')
      .server('/api')
      .addOperation('/ping', 'get', new OperationBuilder().response(200, 'OK').build())
      .toJSON();

    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed['openapi']).toBe('3.0.3');
    expect(parsed['paths']).toHaveProperty('/ping');
  });
});

// ---------------------------------------------------------------------------
// Suite 4: ApiVersion
// ---------------------------------------------------------------------------

describe('ApiVersion', () => {
  it('of() captures major and minor correctly', () => {
    const v = ApiVersion.of(2, 3);
    expect(v.major).toBe(2);
    expect(v.minor).toBe(3);
  });

  it('toPath() prepends the version segment to a path', () => {
    expect(ApiVersion.of(1).toPath('/users')).toBe('/v1/users');
    expect(ApiVersion.of(2).toPath('orders')).toBe('/v2/orders');
  });

  it('isCompatibleWith() returns true for same major', () => {
    const v1 = ApiVersion.of(1);
    const v1minor = ApiVersion.of(1, 2);
    const v2 = ApiVersion.of(2);

    expect(v1.isCompatibleWith(v1minor)).toBe(true);
    expect(v1.isCompatibleWith(v2)).toBe(false);
  });

  it('compareTo() orders versions correctly', () => {
    const v1 = ApiVersion.of(1);
    const v2 = ApiVersion.of(2);
    const v2a = ApiVersion.of(2);

    expect(v1.compareTo(v2)).toBe(-1);
    expect(v2.compareTo(v1)).toBe(1);
    expect(v2.compareTo(v2a)).toBe(0);
  });
});
