/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
import { describe, it, expect, beforeEach } from 'vitest';

import { SnippetLibrary } from './snippets/SnippetLibrary';
import { PatternDetector } from './detection/PatternDetector';
import { ArchitectureValidator } from './validation/ArchitectureValidator';
import { RefactoringTool } from './refactoring/RefactoringTool';
import { QuickFixProvider } from './quickfix/QuickFixProvider';

// ---------------------------------------------------------------------------
// SnippetLibrary
// ---------------------------------------------------------------------------

describe('SnippetLibrary', () => {
  let lib: SnippetLibrary;

  beforeEach(() => {
    lib = new SnippetLibrary();
  });

  it('starts with 7 built-in snippets', () => {
    expect(lib.count()).toBe(7);
  });

  it('getAll() returns all snippets', () => {
    expect(lib.getAll()).toHaveLength(7);
  });

  it('get() returns entity snippet by id', () => {
    const s = lib.get('acme.entity');
    expect(s?.kind).toBe('entity');
  });

  it('get() returns undefined for unknown id', () => {
    expect(lib.get('nope')).toBeUndefined();
  });

  it('getByKind() filters to entity', () => {
    expect(lib.getByKind('entity')).toHaveLength(1);
  });

  it('getByKind() filters to value-object', () => {
    expect(lib.getByKind('value-object')).toHaveLength(1);
  });

  it('getByKind() filters to use-case', () => {
    expect(lib.getByKind('use-case')).toHaveLength(1);
  });

  it('getByKind() filters to repository', () => {
    expect(lib.getByKind('repository')).toHaveLength(1);
  });

  it('getByKind() filters to event', () => {
    expect(lib.getByKind('event')).toHaveLength(1);
  });

  it('getByTag() returns ddd-tagged snippets', () => {
    expect(lib.getByTag('ddd').length).toBeGreaterThanOrEqual(7);
  });

  it('render() replaces $ClassName placeholder', () => {
    const result = lib.render('acme.entity', { className: 'Order' });
    expect(result?.code).toContain('Order');
    expect(result?.code).not.toContain('$ClassName');
  });

  it('render() returns correct kind', () => {
    const result = lib.render('acme.entity', { className: 'Order' });
    expect(result?.kind).toBe('entity');
  });

  it('render() returns undefined for missing id', () => {
    expect(lib.render('ghost', { className: 'X' })).toBeUndefined();
  });

  it('toSnippetFile() produces an entry per snippet', () => {
    const file = lib.toSnippetFile();
    const keys = Object.keys(file);
    expect(keys.length).toBe(7);
  });

  it('toSnippetFile() entries have prefix and body', () => {
    const file = lib.toSnippetFile();
    const first = Object.values(file)[0];
    expect(first?.prefix).toBeTruthy();
    expect(first?.body.length).toBeGreaterThan(0);
  });

  it('register() adds a custom snippet', () => {
    lib.register({
      id: 'custom.test',
      name: 'Test',
      prefix: 'test',
      kind: 'entity',
      body: ['class $ClassName {}'],
      description: 'test',
      tags: ['test'],
    });
    expect(lib.count()).toBe(8);
    expect(lib.get('custom.test')).toBeDefined();
  });

  it('remove() deletes a snippet', () => {
    expect(lib.remove('acme.entity')).toBe(true);
    expect(lib.count()).toBe(6);
  });

  it('remove() returns false for missing id', () => {
    expect(lib.remove('ghost')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PatternDetector
// ---------------------------------------------------------------------------

describe('PatternDetector', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector();
  });

  const entitySource = `
  export class Order extends BaseEntity {
    private constructor(readonly id: string) {}
  }`;

  const voSource = `
  export class Email extends ValueObject {
    constructor(readonly value: string) {}
  }`;

  const repoSource = `
  export interface OrderRepository {
    findById(id: string): Promise<Order | undefined>;
  }`;

  const useCaseSource = `
  export class PlaceOrderUseCase {
    async execute(): Promise<void> {}
  }`;

  const eventSource = `
  export class OrderCreatedEvent {
    constructor(readonly occurredAt: Date) {}
  }`;

  it('detects entity pattern', () => {
    const report = detector.detect(entitySource);
    expect(report.entityCount).toBe(1);
  });

  it('detects value object pattern', () => {
    const report = detector.detect(voSource);
    expect(report.valueObjectCount).toBe(1);
  });

  it('detects repository pattern', () => {
    const report = detector.detect(repoSource);
    expect(report.repositoryCount).toBe(1);
  });

  it('detects use-case pattern', () => {
    const report = detector.detect(useCaseSource);
    expect(report.useCaseCount).toBe(1);
  });

  it('detects domain event pattern', () => {
    const report = detector.detect(eventSource);
    expect(report.eventCount).toBe(1);
  });

  it('hasDomainLayer is true when entity is present', () => {
    expect(detector.detect(entitySource).hasDomainLayer).toBe(true);
  });

  it('hasApplicationLayer is true when use case is present', () => {
    expect(detector.detect(useCaseSource).hasApplicationLayer).toBe(true);
  });

  it('hasDddPatterns returns true for entity source', () => {
    expect(detector.hasDddPatterns(entitySource)).toBe(true);
  });

  it('hasDddPatterns returns false for empty source', () => {
    expect(detector.hasDddPatterns('')).toBe(false);
  });

  it('findByPattern returns matches for repository', () => {
    const matches = detector.findByPattern(repoSource, 'repository');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.pattern).toBe('repository');
  });

  it('listNames extracts class names', () => {
    const names = detector.listNames(entitySource);
    expect(names).toContain('Order');
  });

  it('detect returns match with line number >= 1', () => {
    const report = detector.detect(entitySource);
    expect(report.matches[0]?.line).toBeGreaterThanOrEqual(1);
  });

  it('no matches for plain source', () => {
    const report = detector.detect('const x = 1;');
    expect(report.matches).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ArchitectureValidator
// ---------------------------------------------------------------------------

describe('ArchitectureValidator', () => {
  let validator: ArchitectureValidator;

  beforeEach(() => {
    validator = new ArchitectureValidator();
  });

  it('detectLayer returns domain for /domain/ path', () => {
    expect(validator.detectLayer('/src/domain/Order.ts')).toBe('domain');
  });

  it('detectLayer returns application for /use-cases/ path', () => {
    expect(validator.detectLayer('/src/use-cases/PlaceOrder.ts')).toBe('application');
  });

  it('detectLayer returns infrastructure for /infra/ path', () => {
    expect(validator.detectLayer('/src/infra/db/Repo.ts')).toBe('infrastructure');
  });

  it('detectLayer returns presentation for /controllers/ path', () => {
    expect(validator.detectLayer('/src/controllers/OrderCtrl.ts')).toBe('presentation');
  });

  it('detectLayer returns unknown for ambiguous path', () => {
    expect(validator.detectLayer('/src/utils/helper.ts')).toBe('unknown');
  });

  it('validate passes for clean domain file', () => {
    const source = `
      export class Order extends BaseEntity {
        private constructor(readonly id: string) {}
        static create(id: string) { return new Order(id); }
      }`;
    const result = validator.validate('/src/domain/Order.ts', source);
    expect(result.passed).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it('validate fails when domain imports infrastructure', () => {
    const source = `import { repo } from '../infra/db/repo';`;
    const result = validator.validate('/src/domain/Order.ts', source);
    expect(result.passed).toBe(false);
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it('validate warns when entity lacks private constructor', () => {
    const source = `
      export class Order extends BaseEntity {
        constructor(readonly id: string) {}
      }`;
    const result = validator.validate('/src/domain/Order.ts', source);
    expect(result.warningCount).toBeGreaterThan(0);
  });

  it('validate fails when application imports presentation', () => {
    const source = `import { ctrl } from '../presentation/ctrl';`;
    const result = validator.validate('/src/use-cases/PlaceOrder.ts', source);
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it('isValid returns true for clean file', () => {
    expect(validator.isValid('/src/utils/helper.ts', 'const x = 1;')).toBe(true);
  });

  it('validateProject aggregates results', () => {
    const files = [
      { path: '/src/domain/Order.ts', source: 'import {} from "../infra/db";' },
      { path: '/src/utils/x.ts', source: 'const x = 1;' },
    ];
    const result = validator.validateProject(files);
    expect(result.fileCount).toBe(2);
    expect(result.totalErrors).toBeGreaterThan(0);
    expect(result.passed).toBe(false);
  });

  it('validateProject passes when all files clean', () => {
    const files = [
      { path: '/src/utils/a.ts', source: 'export const x = 1;' },
      { path: '/src/utils/b.ts', source: 'export const y = 2;' },
    ];
    const result = validator.validateProject(files);
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RefactoringTool
// ---------------------------------------------------------------------------

describe('RefactoringTool', () => {
  let tool: RefactoringTool;

  beforeEach(() => {
    tool = new RefactoringTool();
  });

  const primitiveSource = `
  export class Order {
    orderId: string;
    customerEmail: string;
    phoneNumber: string;
  }`;

  const mutableArraySource = `
  export class Cart {
    items: Product[];
  }`;

  const factorySource = `
  export class Builder {
    build() {
      const a = new A();
      const b = new B();
      const c = new C();
      return { a, b, c };
    }
  }`;

  it('detects primitive obsession for Email field', () => {
    const report = tool.analyse(primitiveSource);
    const kinds = report.suggestions.map((s) => s.kind);
    expect(kinds).toContain('replace-primitive-obsession');
  });

  it('detects mutable array for items field', () => {
    const report = tool.analyse(mutableArraySource);
    const kinds = report.suggestions.map((s) => s.kind);
    expect(kinds).toContain('encapsulate-collection');
  });

  it('suggests factory when multiple new calls present', () => {
    const report = tool.analyse(factorySource);
    const kinds = report.suggestions.map((s) => s.kind);
    expect(kinds).toContain('introduce-factory');
  });

  it('has high priority when primitive obsession found', () => {
    const report = tool.analyse(primitiveSource);
    expect(report.hasHighPriority).toBe(true);
  });

  it('count matches number of suggestions', () => {
    const report = tool.analyse(primitiveSource);
    expect(report.count).toBe(report.suggestions.length);
  });

  it('filterByKind returns only matching kind', () => {
    const sug = tool.filterByKind(primitiveSource, 'replace-primitive-obsession');
    expect(sug.every((s) => s.kind === 'replace-primitive-obsession')).toBe(true);
  });

  it('hasOpportunities true for primitive source', () => {
    expect(tool.hasOpportunities(primitiveSource)).toBe(true);
  });

  it('hasOpportunities false for clean source', () => {
    expect(tool.hasOpportunities('export const x = 1;')).toBe(false);
  });

  it('suggestion carries a title', () => {
    const report = tool.analyse(primitiveSource);
    expect(report.suggestions[0]?.title.length).toBeGreaterThan(0);
  });

  it('suggestion carries a line number', () => {
    const report = tool.analyse(primitiveSource);
    expect(report.suggestions[0]?.line).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// QuickFixProvider
// ---------------------------------------------------------------------------

describe('QuickFixProvider', () => {
  let provider: QuickFixProvider;

  beforeEach(() => {
    provider = new QuickFixProvider();
  });

  const lowerClassSource = `
  class order {
    id: string = '';
  }`;

  const voWithoutEquals = `
  export class Email extends ValueObject {
    constructor(readonly value: string) {}
  }`;

  const publicCtorSource = `
  export class Product {
    public constructor(readonly id: string) {}
  }`;

  const readonlySource = `
  export class Order {
    public name: string = '';
  }`;

  it('provides naming-convention fix for lowercase class name', () => {
    const fixes = provider.provide(lowerClassSource);
    const categories = fixes.map((f) => f.category);
    expect(categories).toContain('fix-naming-convention');
  });

  it('provides add-missing-method fix for VO without equals', () => {
    const fixes = provider.provide(voWithoutEquals);
    const categories = fixes.map((f) => f.category);
    expect(categories).toContain('add-missing-method');
  });

  it('provides add-factory-method fix for public constructor', () => {
    const fixes = provider.provide(publicCtorSource);
    const categories = fixes.map((f) => f.category);
    expect(categories).toContain('add-factory-method');
  });

  it('provides add-readonly fix for public non-readonly field', () => {
    const fixes = provider.provide(readonlySource);
    const categories = fixes.map((f) => f.category);
    expect(categories).toContain('add-readonly');
  });

  it('hasFixes returns true when issues found', () => {
    expect(provider.hasFixes(lowerClassSource)).toBe(true);
  });

  it('hasFixes returns false for clean source', () => {
    expect(provider.hasFixes('export const x = 1;')).toBe(false);
  });

  it('provideByCategory filters correctly', () => {
    const fixes = provider.provideByCategory(lowerClassSource, 'fix-naming-convention');
    expect(fixes.every((f) => f.category === 'fix-naming-convention')).toBe(true);
  });

  it('countByCategory groups counts correctly', () => {
    const counts = provider.countByCategory(lowerClassSource);
    const nc = counts['fix-naming-convention'] ?? 0;
    expect(nc).toBeGreaterThanOrEqual(1);
  });

  it('fix title is non-empty', () => {
    const fixes = provider.provide(lowerClassSource);
    expect(fixes[0]?.title.length).toBeGreaterThan(0);
  });

  it('VO without toString also gets add-missing-method fix', () => {
    const fixes = provider.provide(voWithoutEquals);
    const missingMethods = fixes.filter((f) => f.category === 'add-missing-method');
    expect(missingMethods.length).toBeGreaterThanOrEqual(2);
  });

  it('VO with equals and toString has no add-missing-method fixes', () => {
    const clean = `
    export class Email extends ValueObject {
      equals(other: Email) { return true; }
      toString() { return this.value; }
    }`;
    const fixes = provider.provideByCategory(clean, 'add-missing-method');
    expect(fixes).toHaveLength(0);
  });
});
