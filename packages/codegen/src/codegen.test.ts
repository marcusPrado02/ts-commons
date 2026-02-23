/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, capitalize, toKebab, toSnake, toCamel, pluralise } from './TemplateEngine';
import { GeneratorRegistry } from './GeneratorRegistry';
import { CrudGenerator } from './generators/CrudGenerator';
import { ApiEndpointGenerator } from './generators/ApiEndpointGenerator';
import { TestSuiteGenerator } from './generators/TestSuiteGenerator';
import { MigrationGenerator } from './generators/MigrationGenerator';
import type {
  CrudContext,
  ApiContext,
  TestSuiteContext,
  MigrationContext,
  EntityField,
} from './GeneratorTypes';

// ── TemplateEngine ────────────────────────────────────────────────────────────

describe('TemplateEngine', () => {
  describe('render', () => {
    it('replaces a single token', () => {
      expect(render('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
    });

    it('replaces multiple tokens', () => {
      expect(render('{{a}} + {{b}}', { a: '1', b: '2' })).toBe('1 + 2');
    });

    it('leaves unknown tokens unchanged', () => {
      expect(render('{{missing}}', {})).toBe('{{missing}}');
    });

    it('replaces the same token more than once', () => {
      expect(render('{{x}}-{{x}}', { x: 'hi' })).toBe('hi-hi');
    });
  });

  describe('capitalize', () => {
    it('capitalises first letter', () => {
      expect(capitalize('order')).toBe('Order');
    });

    it('leaves empty string unchanged', () => {
      expect(capitalize('')).toBe('');
    });

    it('does not change an already-capitalised string', () => {
      expect(capitalize('User')).toBe('User');
    });
  });

  describe('toKebab', () => {
    it('converts PascalCase to kebab-case', () => {
      expect(toKebab('OrderItem')).toBe('order-item');
    });

    it('converts camelCase to kebab-case', () => {
      expect(toKebab('orderItem')).toBe('order-item');
    });

    it('leaves lowercase unchanged', () => {
      expect(toKebab('order')).toBe('order');
    });
  });

  describe('toSnake', () => {
    it('converts PascalCase to snake_case', () => {
      expect(toSnake('OrderItem')).toBe('order_item');
    });

    it('converts camelCase to snake_case', () => {
      expect(toSnake('orderItem')).toBe('order_item');
    });
  });

  describe('toCamel', () => {
    it('converts PascalCase to camelCase', () => {
      expect(toCamel('Order')).toBe('order');
    });

    it('leaves camelCase unchanged', () => {
      expect(toCamel('orderItem')).toBe('orderItem');
    });
  });

  describe('pluralise', () => {
    it('appends s for normal words', () => {
      expect(pluralise('order')).toBe('orders');
    });

    it('converts y ending to ies', () => {
      expect(pluralise('category')).toBe('categories');
    });

    it('appends es for words ending in s', () => {
      expect(pluralise('status')).toBe('statuses');
    });
  });
});

// ── GeneratorRegistry ─────────────────────────────────────────────────────────

describe('GeneratorRegistry', () => {
  let registry: GeneratorRegistry;

  beforeEach(() => {
    registry = new GeneratorRegistry();
  });

  it('has 4 built-in generators', () => {
    expect(registry.count()).toBe(4);
  });

  it('getAll returns 4 generators', () => {
    expect(registry.getAll().length).toBe(4);
  });

  it('get returns crud generator', () => {
    expect(registry.get('crud')?.id).toBe('crud');
  });

  it('get returns undefined for unknown id', () => {
    expect(registry.get('nope')).toBeUndefined();
  });

  it('getByCategory crud returns 1 generator', () => {
    expect(registry.getByCategory('crud').length).toBe(1);
  });

  it('getByCategory api returns 1 generator', () => {
    expect(registry.getByCategory('api').length).toBe(1);
  });

  it('getByCategory test returns 1 generator', () => {
    expect(registry.getByCategory('test').length).toBe(1);
  });

  it('getByCategory migration returns 1 generator', () => {
    expect(registry.getByCategory('migration').length).toBe(1);
  });

  it('summaries returns array with correct shape', () => {
    const sums = registry.summaries();
    expect(sums.length).toBe(4);
    for (const s of sums) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.name).toBe('string');
    }
  });

  it('register adds a custom generator', () => {
    registry.register({
      id: 'custom',
      name: 'Custom',
      description: '',
      category: 'custom',
      generate: () => ({ generatorId: 'custom', files: [], success: true, errors: [] }),
    });
    expect(registry.count()).toBe(5);
  });

  it('register replaces generator with same id', () => {
    const g = {
      id: 'dup',
      name: 'v1',
      description: '',
      category: 'custom' as const,
      generate: () => ({ generatorId: 'dup', files: [], success: true, errors: [] }),
    };
    registry.register(g);
    registry.register({ ...g, name: 'v2' });
    expect(registry.get('dup')?.name).toBe('v2');
    expect(registry.count()).toBe(5);
  });

  it('remove deletes a registered generator', () => {
    registry.register({
      id: 'rm',
      name: 'Removable',
      description: '',
      category: 'custom',
      generate: () => ({ generatorId: 'rm', files: [], success: true, errors: [] }),
    });
    expect(registry.remove('rm')).toBe(true);
    expect(registry.get('rm')).toBeUndefined();
  });

  it('remove returns false for unknown id', () => {
    expect(registry.remove('ghost')).toBe(false);
  });

  it('run returns error for unknown generator', () => {
    const result = registry.run('nope', { outputDir: '/out' });
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('nope');
  });

  it('run executes a registered generator', () => {
    const ctx: CrudContext = {
      outputDir: '/out',
      entityName: 'Order',
      fields: [],
      withTests: false,
    };
    const result = registry.run('crud', ctx);
    expect(result.success).toBe(true);
  });
});

// ── CrudGenerator ─────────────────────────────────────────────────────────────

const fields: readonly EntityField[] = [
  { name: 'name', type: 'string', nullable: false },
  { name: 'total', type: 'number', nullable: true },
];

const crudCtx: CrudContext = {
  outputDir: '/out',
  entityName: 'Order',
  fields,
  withTests: false,
};

describe('CrudGenerator', () => {
  const gen = new CrudGenerator();

  it('generates 6 files', () => {
    const result = gen.generate(crudCtx);
    expect(result.files.length).toBe(6);
  });

  it('result is successful', () => {
    expect(gen.generate(crudCtx).success).toBe(true);
  });

  it('generates entity file', () => {
    const result = gen.generate(crudCtx);
    expect(result.files.some((f) => f.path.includes('order.ts'))).toBe(true);
  });

  it('generates repository file', () => {
    const result = gen.generate(crudCtx);
    expect(result.files.some((f) => f.path.includes('repository'))).toBe(true);
  });

  it('entity content extends Entity', () => {
    const result = gen.generate(crudCtx);
    const entity = result.files.find((f) => f.path.endsWith('order.ts'));
    expect(entity?.content).toContain('extends Entity<string>');
  });

  it('entity content includes field declarations', () => {
    const result = gen.generate(crudCtx);
    const entity = result.files.find((f) => f.path.endsWith('order.ts'));
    expect(entity?.content).toContain('name');
    expect(entity?.content).toContain('total');
  });

  it('nullable field has | undefined type', () => {
    const result = gen.generate(crudCtx);
    const entity = result.files.find((f) => f.path.endsWith('order.ts'));
    expect(entity?.content).toContain('| undefined');
  });

  it('generates create use-case file', () => {
    const result = gen.generate(crudCtx);
    expect(result.files.some((f) => f.path.includes('create-order'))).toBe(true);
  });

  it('generates delete use-case file', () => {
    const result = gen.generate(crudCtx);
    expect(result.files.some((f) => f.path.includes('delete-order'))).toBe(true);
  });

  it('fails when entityName is empty', () => {
    const result = gen.generate({ ...crudCtx, entityName: '' });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('generatorId is crud', () => {
    expect(gen.generate(crudCtx).generatorId).toBe('crud');
  });
});

// ── ApiEndpointGenerator ──────────────────────────────────────────────────────

const apiCtx: ApiContext = {
  outputDir: '/out',
  resourceName: 'Product',
  basePath: '/api/products',
  methods: ['GET', 'POST', 'DELETE'],
  framework: 'express',
};

describe('ApiEndpointGenerator', () => {
  const gen = new ApiEndpointGenerator();

  it('generates 3 files', () => {
    expect(gen.generate(apiCtx).files.length).toBe(3);
  });

  it('result is successful', () => {
    expect(gen.generate(apiCtx).success).toBe(true);
  });

  it('generates controller file', () => {
    const result = gen.generate(apiCtx);
    expect(result.files.some((f) => f.path.includes('controller'))).toBe(true);
  });

  it('generates routes file', () => {
    const result = gen.generate(apiCtx);
    expect(result.files.some((f) => f.path.includes('routes'))).toBe(true);
  });

  it('generates dto file', () => {
    const result = gen.generate(apiCtx);
    expect(result.files.some((f) => f.path.includes('dto'))).toBe(true);
  });

  it('controller contains class definition', () => {
    const result = gen.generate(apiCtx);
    const ctrl = result.files.find((f) => f.path.includes('controller'));
    expect(ctrl?.content).toContain('class ProductController');
  });

  it('fails when resourceName is empty', () => {
    const result = gen.generate({ ...apiCtx, resourceName: '' });
    expect(result.success).toBe(false);
  });

  it('fails when methods array is empty', () => {
    const result = gen.generate({ ...apiCtx, methods: [] });
    expect(result.success).toBe(false);
  });

  it('works with fastify framework', () => {
    const result = gen.generate({ ...apiCtx, framework: 'fastify' });
    expect(result.success).toBe(true);
  });
});

// ── TestSuiteGenerator ────────────────────────────────────────────────────────

const testCtx: TestSuiteContext = {
  outputDir: '/out/tests',
  sourceFile: '/out/src/order.service.ts',
  className: 'OrderService',
  methods: ['create', 'findById', 'delete'],
};

describe('TestSuiteGenerator', () => {
  const gen = new TestSuiteGenerator();

  it('generates 1 file', () => {
    expect(gen.generate(testCtx).files.length).toBe(1);
  });

  it('result is successful', () => {
    expect(gen.generate(testCtx).success).toBe(true);
  });

  it('test file path ends with .test.ts', () => {
    const result = gen.generate(testCtx);
    expect(result.files[0]?.path).toMatch(/\.test\.ts$/);
  });

  it('content contains describe block', () => {
    const file = gen.generate(testCtx).files[0];
    expect(file?.content).toContain("describe('OrderService'");
  });

  it('content contains class name in import', () => {
    const file = gen.generate(testCtx).files[0];
    expect(file?.content).toContain('OrderService');
  });

  it('content includes all methods', () => {
    const file = gen.generate(testCtx).files[0];
    for (const method of testCtx.methods) {
      expect(file?.content).toContain(method);
    }
  });

  it('fails when className is empty', () => {
    const result = gen.generate({ ...testCtx, className: '' });
    expect(result.success).toBe(false);
  });

  it('generatorId is test-suite', () => {
    expect(gen.generate(testCtx).generatorId).toBe('test-suite');
  });
});

// ── MigrationGenerator ────────────────────────────────────────────────────────

const migCtx: MigrationContext = {
  outputDir: '/migrations',
  migrationName: 'CreateOrders',
  tableName: 'orders',
  fields: [
    { name: 'userId', type: 'string', nullable: false },
    { name: 'total', type: 'number', nullable: false },
    { name: 'paid', type: 'boolean', nullable: true },
  ],
  reversible: true,
};

describe('MigrationGenerator', () => {
  const gen = new MigrationGenerator();

  it('generates 1 file', () => {
    expect(gen.generate(migCtx).files.length).toBe(1);
  });

  it('result is successful', () => {
    expect(gen.generate(migCtx).success).toBe(true);
  });

  it('file path starts with outputDir', () => {
    const result = gen.generate(migCtx);
    expect(result.files[0]?.path).toContain('/migrations/');
  });

  it('file path ends with .ts', () => {
    const result = gen.generate(migCtx);
    expect(result.files[0]?.path).toMatch(/\.ts$/);
  });

  it('content includes createTable', () => {
    const file = gen.generate(migCtx).files[0];
    expect(file?.content).toContain('createTable');
  });

  it('content includes up migration', () => {
    const file = gen.generate(migCtx).files[0];
    expect(file?.content).toContain('async up');
  });

  it('reversible migration includes down', () => {
    const file = gen.generate(migCtx).files[0];
    expect(file?.content).toContain('async down');
  });

  it('non-reversible migration does not include async down', () => {
    const file = gen.generate({ ...migCtx, reversible: false }).files[0];
    expect(file?.content).not.toContain('async down');
  });

  it('includes column definitions', () => {
    const file = gen.generate(migCtx).files[0];
    expect(file?.content).toContain('user_id');
    expect(file?.content).toContain('total');
  });

  it('boolean field uses boolean column type', () => {
    const file = gen.generate(migCtx).files[0];
    expect(file?.content).toContain('boolean');
  });

  it('fails when migrationName is empty', () => {
    const result = gen.generate({ ...migCtx, migrationName: '' });
    expect(result.success).toBe(false);
  });

  it('fails when tableName is empty', () => {
    const result = gen.generate({ ...migCtx, tableName: '' });
    expect(result.success).toBe(false);
  });

  it('nullable field uses nullable()', () => {
    const file = gen.generate(migCtx).files[0];
    expect(file?.content).toContain('.nullable()');
  });

  it('generatorId is migration', () => {
    expect(gen.generate(migCtx).generatorId).toBe('migration');
  });
});
