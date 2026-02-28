/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry } from './SchemaRegistry';
import {
  IncompatibleSchemaError,
  SubjectNotFoundError,
  SchemaVersionNotFoundError,
} from './errors';
import type { Schema } from './types';

const jsonSchema: Schema = {
  type: 'JSON',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'name', type: 'string' },
  ],
};

const avroSchema: Schema = {
  type: 'AVRO',
  namespace: 'com.acme',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'email', type: 'string' },
  ],
};

describe('SchemaRegistry', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry();
  });

  it('registers a schema and returns a numeric id', async () => {
    const id = await registry.register('user-events', jsonSchema);
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('getLatest returns the most recently registered schema', async () => {
    await registry.register('user-events', jsonSchema);
    const schema = await registry.getLatest('user-events');
    expect(schema.fields).toHaveLength(2);
  });

  it('getLatest throws SubjectNotFoundError for unknown subject', async () => {
    await expect(registry.getLatest('unknown')).rejects.toThrow(SubjectNotFoundError);
  });

  it('version numbers increment per subject', async () => {
    await registry.register('orders', jsonSchema);
    const schema2: Schema = {
      ...jsonSchema,
      fields: [...jsonSchema.fields, { name: 'total', type: 'number', optional: true }],
    };
    await registry.register('orders', schema2);
    const v1 = await registry.getVersion('orders', 1);
    const v2 = await registry.getVersion('orders', 2);
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
  });

  it('getVersion throws SchemaVersionNotFoundError for missing version', async () => {
    await registry.register('orders', jsonSchema);
    await expect(registry.getVersion('orders', 99)).rejects.toThrow(SchemaVersionNotFoundError);
  });

  it('listSubjects returns all registered subjects', async () => {
    await registry.register('a', jsonSchema);
    await registry.register('b', avroSchema);
    expect(registry.listSubjects()).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('listVersions returns version numbers for a subject', async () => {
    await registry.register('ev', jsonSchema);
    const evSchema2: Schema = {
      ...jsonSchema,
      fields: [...jsonSchema.fields, { name: 'ts', type: 'number', optional: true }],
    };
    await registry.register('ev', evSchema2);
    expect(registry.listVersions('ev')).toEqual([1, 2]);
  });

  it('deleteSubject removes the subject', async () => {
    await registry.register('tmp', jsonSchema);
    expect(registry.deleteSubject('tmp')).toBe(true);
    expect(registry.listSubjects()).not.toContain('tmp');
  });

  it('deleteSubject returns false for unknown subject', () => {
    expect(registry.deleteSubject('nope')).toBe(false);
  });

  it('subjectCount tracks registered subjects', async () => {
    await registry.register('a', jsonSchema);
    await registry.register('b', avroSchema);
    expect(registry.subjectCount).toBe(2);
  });

  describe('BACKWARD compatibility (default)', () => {
    it('allows adding optional fields', async () => {
      await registry.register('ev', jsonSchema);
      const evolved: Schema = {
        ...jsonSchema,
        fields: [...jsonSchema.fields, { name: 'extra', type: 'string', optional: true }],
      };
      await expect(registry.register('ev', evolved)).resolves.toBeGreaterThan(0);
    });

    it('rejects removing a required field', async () => {
      await registry.register('ev', jsonSchema);
      const broken: Schema = { type: 'JSON', fields: [{ name: 'id', type: 'string' }] };
      await expect(registry.register('ev', broken)).rejects.toThrow(IncompatibleSchemaError);
    });
  });

  describe('NONE compatibility', () => {
    it('always allows any schema change', async () => {
      const r = new SchemaRegistry('NONE');
      await r.register('ev', jsonSchema);
      const totally: Schema = { type: 'JSON', fields: [{ name: 'x', type: 'number' }] };
      await expect(r.register('ev', totally)).resolves.toBeGreaterThan(0);
    });
  });

  describe('FORWARD compatibility', () => {
    it('rejects removing an optional field (old readers need it)', async () => {
      const r = new SchemaRegistry('FORWARD');
      const withOpt: Schema = {
        type: 'JSON',
        fields: [
          { name: 'id', type: 'string' },
          { name: 'nickname', type: 'string', optional: true },
        ],
      };
      await r.register('ev', withOpt);
      const withoutOpt: Schema = { type: 'JSON', fields: [{ name: 'id', type: 'string' }] };
      await expect(r.register('ev', withoutOpt)).rejects.toThrow(IncompatibleSchemaError);
    });
  });

  describe('FULL compatibility', () => {
    it('rejects removing a required field', async () => {
      const r = new SchemaRegistry('FULL');
      await r.register('ev', jsonSchema);
      const broken: Schema = { type: 'JSON', fields: [{ name: 'id', type: 'string' }] };
      await expect(r.register('ev', broken)).rejects.toThrow(IncompatibleSchemaError);
    });
  });

  describe('per-subject compatibility', () => {
    it('setCompatibility overrides default for a subject', async () => {
      registry.setCompatibility('special', 'NONE');
      await registry.register('special', jsonSchema);
      const totally: Schema = { type: 'JSON', fields: [{ name: 'z', type: 'boolean' }] };
      await expect(registry.register('special', totally)).resolves.toBeGreaterThan(0);
    });

    it('getCompatibility returns subject-level mode', () => {
      registry.setCompatibility('ev', 'FULL');
      expect(registry.getCompatibility('ev')).toBe('FULL');
    });

    it('getCompatibility returns global default when not set', () => {
      expect(registry.getCompatibility('unknown')).toBe('BACKWARD');
    });
  });

  describe('schema types', () => {
    it('registers AVRO schema', async () => {
      const id = await registry.register('avro-events', avroSchema);
      expect(id).toBeGreaterThan(0);
    });

    it('registers PROTOBUF schema', async () => {
      const proto: Schema = { type: 'PROTOBUF', fields: [{ name: 'id', type: 'int32' }] };
      const id = await registry.register('proto-ev', proto);
      expect(id).toBeGreaterThan(0);
    });
  });
});
