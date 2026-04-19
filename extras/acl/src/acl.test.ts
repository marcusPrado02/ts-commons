/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import {
  FunctionTranslator,
  CompositeTranslator,
  createTranslationResult,
  TranslatorRegistry,
  DataFormatRegistry,
  ProtocolAdapterRegistry,
  LegacyFacade,
  AntiCorruptionLayer,
} from './index.js';
import { AclException } from './index.js';
import type { DataConverter, ProtocolAdapter } from './index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface LegacyUserDto {
  user_id: string;
  full_name: string;
  email_address: string;
}

interface UserModel {
  id: string;
  name: string;
  email: string;
}

interface UserDto {
  userId: string;
  displayName: string;
}

const legacyToModel = new FunctionTranslator<LegacyUserDto, UserModel>((src) => ({
  id: src.user_id,
  name: src.full_name,
  email: src.email_address,
}));

const modelToDto = new FunctionTranslator<UserModel, UserDto>((src) => ({
  userId: src.id,
  displayName: src.name,
}));

const sampleLegacy: LegacyUserDto = {
  user_id: 'u-1',
  full_name: 'Alice',
  email_address: 'alice@example.com',
};

// ─── FunctionTranslator ───────────────────────────────────────────────────────

describe('FunctionTranslator', () => {
  it('translates using the provided function', () => {
    const t = new FunctionTranslator<string, number>((s) => s.length);
    expect(t.translate('hello')).toBe(5);
  });

  it('acts as identity when fn is (x) => x', () => {
    const t = new FunctionTranslator<string, string>((s) => s);
    expect(t.translate('abc')).toBe('abc');
  });

  it('supports type transformation', () => {
    const result = legacyToModel.translate(sampleLegacy);
    expect(result.id).toBe('u-1');
    expect(result.name).toBe('Alice');
    expect(result.email).toBe('alice@example.com');
  });

  it('calls the fn each time translate() is invoked', () => {
    const fn = vi.fn((s: string) => s.toUpperCase());
    const t = new FunctionTranslator(fn);
    t.translate('a');
    t.translate('b');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ─── CompositeTranslator ──────────────────────────────────────────────────────

describe('CompositeTranslator', () => {
  it('chains two translators in order', () => {
    const composite = new CompositeTranslator(legacyToModel, modelToDto);
    const result = composite.translate(sampleLegacy);
    expect(result.userId).toBe('u-1');
    expect(result.displayName).toBe('Alice');
  });

  it('first translator output feeds into second', () => {
    const addOne = new FunctionTranslator<number, number>((n) => n + 1);
    const double = new FunctionTranslator<number, number>((n) => n * 2);
    const composite = new CompositeTranslator(addOne, double);
    // (3 + 1) * 2 = 8
    expect(composite.translate(3)).toBe(8);
  });

  it('supports triple chaining via nesting', () => {
    const addOne = new FunctionTranslator<number, number>((n) => n + 1);
    const double = new FunctionTranslator<number, number>((n) => n * 2);
    const toString = new FunctionTranslator<number, string>((n) => `${n}`);
    const composite = new CompositeTranslator(new CompositeTranslator(addOne, double), toString);
    // (2 + 1) * 2 = 6 → "6"
    expect(composite.translate(2)).toBe('6');
  });
});

// ─── createTranslationResult ──────────────────────────────────────────────────

describe('createTranslationResult', () => {
  it('stores the value', () => {
    const r = createTranslationResult(42);
    expect(r.value).toBe(42);
  });

  it('has an empty warnings array by default', () => {
    const r = createTranslationResult('x');
    expect(r.warnings).toHaveLength(0);
  });

  it('stores provided warnings', () => {
    const r = createTranslationResult('x', ['warn1', 'warn2']);
    expect(r.warnings).toEqual(['warn1', 'warn2']);
  });

  it('translatedAt is a Date', () => {
    const r = createTranslationResult(true);
    expect(r.translatedAt).toBeInstanceOf(Date);
  });

  it('translatedAt is close to now', () => {
    const before = Date.now();
    const r = createTranslationResult(0);
    const after = Date.now();
    expect(r.translatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(r.translatedAt.getTime()).toBeLessThanOrEqual(after);
  });
});

// ─── TranslatorRegistry ───────────────────────────────────────────────────────

describe('TranslatorRegistry', () => {
  it('register() and translate() work together', () => {
    const reg = new TranslatorRegistry();
    reg.register('legacy-user', legacyToModel);
    const result = reg.translate<LegacyUserDto, UserModel>('legacy-user', sampleLegacy);
    expect(result.id).toBe('u-1');
  });

  it('has() returns true after registration', () => {
    const reg = new TranslatorRegistry();
    reg.register('t', legacyToModel);
    expect(reg.has('t')).toBe(true);
  });

  it('has() returns false for unknown key', () => {
    const reg = new TranslatorRegistry();
    expect(reg.has('missing')).toBe(false);
  });

  it('size() reflects registered count', () => {
    const reg = new TranslatorRegistry();
    reg.register('a', legacyToModel);
    reg.register('b', modelToDto);
    expect(reg.size()).toBe(2);
  });

  it('translate() throws for unknown key', () => {
    const reg = new TranslatorRegistry();
    expect(() => reg.translate('nope', {})).toThrow('No translator registered for key: "nope"');
  });

  it('register() is fluent — returns this', () => {
    const reg = new TranslatorRegistry();
    expect(reg.register('a', legacyToModel)).toBe(reg);
  });

  it('re-registering a key overwrites the previous translator', () => {
    const reg = new TranslatorRegistry();
    const upper = new FunctionTranslator<string, string>((s) => s.toUpperCase());
    const lower = new FunctionTranslator<string, string>((s) => s.toLowerCase());
    reg.register('fmt', upper);
    reg.register('fmt', lower);
    expect(reg.translate<string, string>('fmt', 'Hello')).toBe('hello');
  });
});

// ─── DataFormatRegistry ───────────────────────────────────────────────────────

describe('DataFormatRegistry', () => {
  const csvConverter: DataConverter<string, string[]> = {
    fromFormat: 'csv',
    toFormat: 'array',
    canConvert: (f, t) => f === 'csv' && t === 'array',
    convert: (data) => data.split(','),
  };

  const numberConverter: DataConverter<string, number> = {
    fromFormat: 'string',
    toFormat: 'number',
    canConvert: (f, t) => f === 'string' && t === 'number',
    convert: (data) => Number(data),
  };

  it('register() and convert() work together', () => {
    const reg = new DataFormatRegistry();
    reg.register(csvConverter);
    const result = reg.convert<string, string[]>('csv', 'array', 'a,b,c');
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('has() returns true after registration', () => {
    const reg = new DataFormatRegistry();
    reg.register(csvConverter);
    expect(reg.has('csv', 'array')).toBe(true);
  });

  it('has() returns false for unknown format pair', () => {
    const reg = new DataFormatRegistry();
    expect(reg.has('csv', 'array')).toBe(false);
  });

  it('size() reflects registered count', () => {
    const reg = new DataFormatRegistry();
    reg.register(csvConverter);
    reg.register(numberConverter);
    expect(reg.size()).toBe(2);
  });

  it('convert() throws for unknown format pair', () => {
    const reg = new DataFormatRegistry();
    expect(() => reg.convert('xml', 'json', '<x/>')).toThrow(
      'No converter registered for "xml" → "json"',
    );
  });

  it('register() is fluent — returns this', () => {
    const reg = new DataFormatRegistry();
    expect(reg.register(csvConverter)).toBe(reg);
  });

  it('supports multiple different converters independently', () => {
    const reg = new DataFormatRegistry();
    reg.register(csvConverter);
    reg.register(numberConverter);
    expect(reg.convert<string, number>('string', 'number', '42')).toBe(42);
    expect(reg.convert<string, string[]>('csv', 'array', 'x,y')).toEqual(['x', 'y']);
  });
});

// ─── ProtocolAdapterRegistry ──────────────────────────────────────────────────

describe('ProtocolAdapterRegistry', () => {
  interface HttpRequest {
    path: string;
    body: unknown;
  }
  interface DomainCommand {
    entityId: string;
    payload: unknown;
  }
  interface DomainResult {
    success: boolean;
    data: unknown;
  }
  interface HttpResponse {
    statusCode: number;
    body: unknown;
  }

  const restAdapter: ProtocolAdapter<HttpRequest, DomainCommand, DomainResult, HttpResponse> = {
    adaptRequest: (ext) => ({ entityId: ext.path.slice(1), payload: ext.body }),
    adaptResponse: (int) => ({ statusCode: int.success ? 200 : 400, body: int.data }),
  };

  it('register() and adaptRequest() work together', () => {
    const reg = new ProtocolAdapterRegistry();
    reg.register('rest-v1', restAdapter);
    const cmd = reg.adaptRequest<HttpRequest, DomainCommand>('rest-v1', {
      path: '/user-1',
      body: { name: 'Alice' },
    });
    expect(cmd.entityId).toBe('user-1');
  });

  it('adaptResponse() translates internal result to external format', () => {
    const reg = new ProtocolAdapterRegistry();
    reg.register('rest-v1', restAdapter);
    const res = reg.adaptResponse<DomainResult, HttpResponse>('rest-v1', {
      success: true,
      data: { id: 1 },
    });
    expect(res.statusCode).toBe(200);
  });

  it('has() returns true after registration', () => {
    const reg = new ProtocolAdapterRegistry();
    reg.register('rest-v1', restAdapter);
    expect(reg.has('rest-v1')).toBe(true);
  });

  it('has() returns false for unknown key', () => {
    const reg = new ProtocolAdapterRegistry();
    expect(reg.has('grpc-v1')).toBe(false);
  });

  it('size() reflects registered count', () => {
    const reg = new ProtocolAdapterRegistry();
    reg.register('rest-v1', restAdapter);
    expect(reg.size()).toBe(1);
  });

  it('adaptRequest() throws for unknown key', () => {
    const reg = new ProtocolAdapterRegistry();
    expect(() => reg.adaptRequest('missing', {})).toThrow(
      'No protocol adapter registered for: "missing"',
    );
  });

  it('adaptResponse() throws for unknown key', () => {
    const reg = new ProtocolAdapterRegistry();
    expect(() => reg.adaptResponse('missing', {})).toThrow(
      'No protocol adapter registered for: "missing"',
    );
  });

  it('register() is fluent — returns this', () => {
    const reg = new ProtocolAdapterRegistry();
    expect(reg.register('rest-v1', restAdapter)).toBe(reg);
  });
});

// ─── LegacyFacade ─────────────────────────────────────────────────────────────

describe('LegacyFacade', () => {
  interface MockLegacyClient {
    fetchData(id: string): Promise<string>;
  }

  class TestFacade extends LegacyFacade<MockLegacyClient> {
    async getData(id: string): Promise<string> {
      return this.execute(() => this.client.fetchData(id));
    }

    protected mapError(error: unknown): AclException {
      const msg = error instanceof Error ? error.message : String(error);
      return new AclException('LEGACY_ERROR', msg, error);
    }
  }

  it('execute() returns the resolved value on success', async () => {
    const client: MockLegacyClient = { fetchData: async () => 'payload-1' };
    const facade = new TestFacade(client);
    expect(await facade.getData('id-1')).toBe('payload-1');
  });

  it('execute() calls the legacy client with the correct argument', async () => {
    const fetch = vi.fn().mockResolvedValue('ok');
    const facade = new TestFacade({ fetchData: fetch });
    await facade.getData('my-id');
    expect(fetch).toHaveBeenCalledWith('my-id');
  });

  it('execute() maps thrown errors through mapError()', async () => {
    const client: MockLegacyClient = {
      fetchData: async () => {
        throw new Error('connection refused');
      },
    };
    const facade = new TestFacade(client);
    let caught: AclException | undefined;
    try {
      await facade.getData('x');
    } catch (e) {
      caught = e as AclException;
    }
    expect(caught?.code).toBe('LEGACY_ERROR');
    expect(caught?.message).toBe('connection refused');
  });

  it('originalError is preserved on mapped error', async () => {
    const original = new Error('boom');
    const client: MockLegacyClient = {
      fetchData: async () => {
        throw original;
      },
    };
    const facade = new TestFacade(client);
    let caught: AclException | undefined;
    try {
      await facade.getData('x');
    } catch (e) {
      caught = e as AclException;
    }
    expect(caught?.originalError).toBe(original);
  });

  it('succeeds with the value returned by the client', async () => {
    const client: MockLegacyClient = { fetchData: async (id) => `result-${id}` };
    const facade = new TestFacade(client);
    expect(await facade.getData('42')).toBe('result-42');
  });
});

// ─── AntiCorruptionLayer ──────────────────────────────────────────────────────

describe('AntiCorruptionLayer', () => {
  function makeAcl() {
    return new AntiCorruptionLayer().registerTranslator('legacy-user', legacyToModel);
  }

  it('registerTranslator() + translate() works end-to-end', () => {
    const acl = makeAcl();
    const result = acl.translate<LegacyUserDto, UserModel>('legacy-user', sampleLegacy);
    expect(result.id).toBe('u-1');
    expect(result.name).toBe('Alice');
  });

  it('hasTranslator() returns true after registration', () => {
    const acl = makeAcl();
    expect(acl.hasTranslator('legacy-user')).toBe(true);
  });

  it('hasTranslator() returns false for unknown key', () => {
    const acl = new AntiCorruptionLayer();
    expect(acl.hasTranslator('nope')).toBe(false);
  });

  it('translate() throws when translator is not registered', () => {
    const acl = new AntiCorruptionLayer();
    expect(() => acl.translate('missing', {})).toThrow();
  });

  it('registerConverter() + convert() works end-to-end', () => {
    const converter: DataConverter<string, string[]> = {
      fromFormat: 'csv',
      toFormat: 'list',
      canConvert: () => true,
      convert: (d) => d.split(','),
    };
    const acl = new AntiCorruptionLayer().registerConverter(converter);
    expect(acl.convert<string, string[]>('csv', 'list', 'x,y,z')).toEqual(['x', 'y', 'z']);
  });

  it('hasConverter() returns true after registration', () => {
    const converter: DataConverter<string, string[]> = {
      fromFormat: 'csv',
      toFormat: 'list',
      canConvert: () => true,
      convert: (d) => d.split(','),
    };
    const acl = new AntiCorruptionLayer().registerConverter(converter);
    expect(acl.hasConverter('csv', 'list')).toBe(true);
  });

  it('hasConverter() returns false for unknown format pair', () => {
    const acl = new AntiCorruptionLayer();
    expect(acl.hasConverter('xml', 'json')).toBe(false);
  });

  it('convert() throws when converter is not registered', () => {
    const acl = new AntiCorruptionLayer();
    expect(() => acl.convert('xml', 'json', '<x/>')).toThrow();
  });

  it('registerProtocolAdapter() + adaptRequest() works end-to-end', () => {
    const adapter: ProtocolAdapter<{ id: string }, { entityId: string }, unknown, unknown> = {
      adaptRequest: (ext) => ({ entityId: ext.id }),
      adaptResponse: (int) => int,
    };
    const acl = new AntiCorruptionLayer().registerProtocolAdapter('rest', adapter);
    const cmd = acl.adaptRequest<{ id: string }, { entityId: string }>('rest', { id: 'u-2' });
    expect(cmd.entityId).toBe('u-2');
  });

  it('registerProtocolAdapter() + adaptResponse() works end-to-end', () => {
    const adapter: ProtocolAdapter<unknown, unknown, { ok: boolean }, { status: number }> = {
      adaptRequest: (ext) => ext,
      adaptResponse: (int) => ({ status: int.ok ? 200 : 500 }),
    };
    const acl = new AntiCorruptionLayer().registerProtocolAdapter('rest', adapter);
    const res = acl.adaptResponse<{ ok: boolean }, { status: number }>('rest', { ok: false });
    expect(res.status).toBe(500);
  });

  it('hasProtocolAdapter() returns true after registration', () => {
    const adapter: ProtocolAdapter<unknown, unknown, unknown, unknown> = {
      adaptRequest: (e) => e,
      adaptResponse: (i) => i,
    };
    const acl = new AntiCorruptionLayer().registerProtocolAdapter('grpc', adapter);
    expect(acl.hasProtocolAdapter('grpc')).toBe(true);
  });

  it('hasProtocolAdapter() returns false for unknown key', () => {
    const acl = new AntiCorruptionLayer();
    expect(acl.hasProtocolAdapter('missing')).toBe(false);
  });

  it('adaptRequest() throws when adapter is not registered', () => {
    const acl = new AntiCorruptionLayer();
    expect(() => acl.adaptRequest('missing', {})).toThrow();
  });

  it('adaptResponse() throws when adapter is not registered', () => {
    const acl = new AntiCorruptionLayer();
    expect(() => acl.adaptResponse('missing', {})).toThrow();
  });

  it('fluent chaining returns the same instance', () => {
    const acl = new AntiCorruptionLayer();
    const returned = acl.registerTranslator('t', legacyToModel);
    expect(returned).toBe(acl);
  });

  it('all registrations coexist on the same instance', () => {
    const converter: DataConverter<string, number> = {
      fromFormat: 'str',
      toFormat: 'num',
      canConvert: () => true,
      convert: Number,
    };
    const adapter: ProtocolAdapter<unknown, unknown, unknown, unknown> = {
      adaptRequest: (e) => e,
      adaptResponse: (i) => i,
    };
    const acl = new AntiCorruptionLayer()
      .registerTranslator('legacy-user', legacyToModel)
      .registerConverter(converter)
      .registerProtocolAdapter('p', adapter);

    expect(acl.hasTranslator('legacy-user')).toBe(true);
    expect(acl.hasConverter('str', 'num')).toBe(true);
    expect(acl.hasProtocolAdapter('p')).toBe(true);
  });
});
