/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
import { describe, it, expect, beforeEach } from 'vitest';
import { ScaffoldCommand } from './commands/ScaffoldCommand';
import { MigrationCommand } from './commands/MigrationCommand';
import { CodeTemplate } from './codegen/CodeTemplate';
import { ProjectInitializer } from './project/ProjectInitializer';
import { DependencyChecker } from './project/DependencyChecker';
import { VersionManager } from './project/VersionManager';

// ─── ScaffoldCommand ─────────────────────────────────────────────────────────

describe('ScaffoldCommand', () => {
  let cmd: ScaffoldCommand;

  beforeEach(() => {
    cmd = new ScaffoldCommand();
  });

  it('reports supported artifact kinds', () => {
    const kinds = cmd.getSupportedKinds();
    expect(kinds).toContain('entity');
    expect(kinds).toContain('aggregate');
    expect(kinds).toContain('use-case');
    expect(kinds).toContain('repository');
    expect(kinds).toContain('event');
    expect(kinds).toContain('value-object');
    expect(kinds).toContain('service');
  });

  it('isSupported() returns true for known kinds', () => {
    expect(cmd.isSupported('entity')).toBe(true);
    expect(cmd.isSupported('aggregate')).toBe(true);
  });

  it('isSupported() returns false for unknown kinds', () => {
    expect(cmd.isSupported('unknown-thing')).toBe(false);
  });

  it('generate() succeeds for entity', () => {
    const result = cmd.generate({ kind: 'entity', name: 'User' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('User');
    expect(result.filePath).toContain('User.ts');
  });

  it('generate() succeeds for aggregate', () => {
    const result = cmd.generate({ kind: 'aggregate', name: 'Order' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('Order');
  });

  it('generate() succeeds for use-case', () => {
    const result = cmd.generate({ kind: 'use-case', name: 'createUser' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('CreateUser');
  });

  it('generate() succeeds for repository', () => {
    const result = cmd.generate({ kind: 'repository', name: 'UserRepository' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('UserRepository');
  });

  it('generate() succeeds for event', () => {
    const result = cmd.generate({ kind: 'event', name: 'UserCreated' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('UserCreated');
  });

  it('generate() succeeds for value-object', () => {
    const result = cmd.generate({ kind: 'value-object', name: 'Email' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('Email');
  });

  it('generate() succeeds for service', () => {
    const result = cmd.generate({ kind: 'service', name: 'NotificationService' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('NotificationService');
  });

  it('generate() uses custom outputDir when provided', () => {
    const result = cmd.generate({ kind: 'entity', name: 'Order', outputDir: 'domain/orders' });
    expect(result.filePath).toContain('domain/orders');
  });

  it('generate() returns error when kind is unsupported', () => {
    const result = cmd.generate({ kind: 'unknown' as 'entity', name: 'Foo' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('generate() returns error when name is empty', () => {
    const result = cmd.generate({ kind: 'entity', name: '' });
    expect(result.success).toBe(false);
  });

  it('validateName() returns true for PascalCase names', () => {
    expect(cmd.validateName('UserAccount')).toBe(true);
  });

  it('suggestPath() returns a .ts path', () => {
    const path = cmd.suggestPath('entity', 'Product');
    expect(path).toMatch(/\.ts$/);
    expect(path).toContain('Product');
  });

  it('suggestPath() uses custom baseDir', () => {
    const path = cmd.suggestPath('event', 'OrderPlaced', 'domain/events');
    expect(path).toContain('domain/events');
  });
});

// ─── MigrationCommand ────────────────────────────────────────────────────────

describe('MigrationCommand', () => {
  let cmd: MigrationCommand;

  beforeEach(() => {
    cmd = new MigrationCommand();
  });

  it('starts with no entries', () => {
    expect(cmd.count()).toBe(0);
  });

  it('register() adds a migration entry', () => {
    cmd.register({ name: 'AddUsers', status: 'pending' });
    expect(cmd.count()).toBe(1);
  });

  it('getAll() returns copies of all entries', () => {
    cmd.register({ name: 'Init', status: 'pending' });
    expect(cmd.getAll()).toHaveLength(1);
  });

  it('getByStatus() filters correctly', () => {
    cmd.register({ name: 'A', status: 'pending' });
    cmd.register({ name: 'B', status: 'applied', appliedAt: new Date() });
    expect(cmd.getByStatus('pending')).toHaveLength(1);
    expect(cmd.getByStatus('applied')).toHaveLength(1);
  });

  it('execute(create) creates a new pending migration', () => {
    const msg = cmd.execute({ action: 'create', name: 'AddOrdersTable' });
    expect(msg).toContain('AddOrdersTable');
    expect(cmd.count()).toBe(1);
  });

  it('execute(create) returns error when name is missing', () => {
    const msg = cmd.execute({ action: 'create' });
    expect(msg).toContain('ERROR');
  });

  it('execute(up) applies all pending migrations', () => {
    cmd.register({ name: 'A', status: 'pending' });
    cmd.register({ name: 'B', status: 'pending' });
    const msg = cmd.execute({ action: 'up' });
    expect(msg).toContain('2');
    expect(cmd.getByStatus('applied')).toHaveLength(2);
  });

  it('execute(up) respects steps limit', () => {
    cmd.register({ name: 'A', status: 'pending' });
    cmd.register({ name: 'B', status: 'pending' });
    cmd.execute({ action: 'up', steps: 1 });
    expect(cmd.getByStatus('applied')).toHaveLength(1);
  });

  it('execute(up) returns message when no pending migrations', () => {
    const msg = cmd.execute({ action: 'up' });
    expect(msg).toContain('No pending');
  });

  it('execute(down) reverts the last applied migration', () => {
    cmd.register({ name: 'A', status: 'applied', appliedAt: new Date() });
    cmd.execute({ action: 'down' });
    expect(cmd.getByStatus('reverted')).toHaveLength(1);
  });

  it('execute(down) returns message when none applied', () => {
    const msg = cmd.execute({ action: 'down' });
    expect(msg).toContain('No applied');
  });

  it('execute(status) lists all entries', () => {
    cmd.register({ name: 'Init', status: 'pending' });
    const msg = cmd.execute({ action: 'status' });
    expect(msg).toContain('Init');
  });

  it('execute(status) reports empty when no migrations', () => {
    const msg = cmd.execute({ action: 'status' });
    expect(msg).toContain('No migrations');
  });

  it('isSupported() validates known actions', () => {
    expect(cmd.isSupported('up')).toBe(true);
    expect(cmd.isSupported('launch')).toBe(false);
  });

  it('clear() removes all entries', () => {
    cmd.register({ name: 'X', status: 'pending' });
    cmd.clear();
    expect(cmd.count()).toBe(0);
  });
});

// ─── CodeTemplate ────────────────────────────────────────────────────────────

describe('CodeTemplate', () => {
  let tpl: CodeTemplate;

  beforeEach(() => {
    tpl = new CodeTemplate();
  });

  it('starts empty', () => {
    expect(tpl.templateCount()).toBe(0);
  });

  it('register() stores a template', () => {
    tpl.register('entity', 'class {{name}} {}');
    expect(tpl.has('entity')).toBe(true);
    expect(tpl.templateCount()).toBe(1);
  });

  it('get() returns the raw template', () => {
    tpl.register('t', 'hello {{name}}');
    expect(tpl.get('t')).toBe('hello {{name}}');
  });

  it('get() returns undefined for unknown template', () => {
    expect(tpl.get('missing')).toBeUndefined();
  });

  it('render() substitutes placeholders', () => {
    tpl.register('msg', 'Hello, {{name}}!');
    expect(tpl.render('msg', { name: 'World' })).toBe('Hello, World!');
  });

  it('render() leaves unknown placeholders unchanged', () => {
    tpl.register('t', '{{a}} and {{b}}');
    expect(tpl.render('t', { a: 'X' })).toBe('X and {{b}}');
  });

  it('render() returns undefined for missing template', () => {
    expect(tpl.render('absent', {})).toBeUndefined();
  });

  it('render() supports multiple placeholders', () => {
    tpl.register('cls', 'export class {{name}} extends {{base}} {}');
    expect(tpl.render('cls', { name: 'Dog', base: 'Animal' })).toBe(
      'export class Dog extends Animal {}',
    );
  });

  it('names() returns all registered template names', () => {
    tpl.register('a', '');
    tpl.register('b', '');
    expect(tpl.names()).toHaveLength(2);
  });

  it('remove() deletes a template and returns true', () => {
    tpl.register('t', 'x');
    expect(tpl.remove('t')).toBe(true);
    expect(tpl.has('t')).toBe(false);
  });

  it('remove() returns false for non-existent template', () => {
    expect(tpl.remove('nope')).toBe(false);
  });

  it('clone() creates an independent copy', () => {
    tpl.register('x', 'original');
    const copy = tpl.clone();
    tpl.register('x', 'modified');
    expect(copy.get('x')).toBe('original');
  });

  it('clear() removes all templates', () => {
    tpl.register('a', '');
    tpl.clear();
    expect(tpl.templateCount()).toBe(0);
  });
});

// ─── ProjectInitializer ──────────────────────────────────────────────────────

describe('ProjectInitializer', () => {
  let init: ProjectInitializer;

  beforeEach(() => {
    init = new ProjectInitializer();
  });

  it('initialize() returns result with project name', () => {
    const result = init.initialize({ name: 'my-lib' });
    expect(result.name).toBe('my-lib');
  });

  it('initialize() generates 4 files', () => {
    const result = init.initialize({ name: 'pkg' });
    expect(result.files).toHaveLength(4);
  });

  it('fileCount() returns 4', () => {
    expect(init.fileCount()).toBe(4);
  });

  it('initialize() includes package.json', () => {
    const result = init.initialize({ name: 'foo' });
    const pkg = result.files.find((f) => f.path === 'package.json');
    expect(pkg).toBeDefined();
    expect(pkg?.content).toContain('"foo"');
  });

  it('initialize() includes tsconfig.json', () => {
    const result = init.initialize({ name: 'foo' });
    expect(result.files.some((f) => f.path === 'tsconfig.json')).toBe(true);
  });

  it('initialize() includes README.md with project name', () => {
    const result = init.initialize({ name: 'awesome-lib' });
    const readme = result.files.find((f) => f.path === 'README.md');
    expect(readme?.content).toContain('awesome-lib');
  });

  it('initialize() includes src/index.ts', () => {
    const result = init.initialize({ name: 'bar' });
    expect(result.files.some((f) => f.path === 'src/index.ts')).toBe(true);
  });

  it('installCommand uses npm by default', () => {
    expect(init.initialize({ name: 'x' }).installCommand).toBe('npm install');
  });

  it('installCommand uses pnpm when specified', () => {
    expect(init.initialize({ name: 'x', packageManager: 'pnpm' }).installCommand).toBe(
      'pnpm install',
    );
  });

  it('installCommand uses yarn when specified', () => {
    expect(init.initialize({ name: 'x', packageManager: 'yarn' }).installCommand).toBe(
      'yarn install',
    );
  });

  it('previewPaths() returns same paths as initialize().files', () => {
    const paths = init.previewPaths({ name: 'p' });
    const filePaths = init.initialize({ name: 'p' }).files.map((f) => f.path);
    expect(paths).toEqual(filePaths);
  });

  it('initialize() embeds description in package.json', () => {
    const result = init.initialize({ name: 'lib', description: 'A cool lib' });
    const pkg = result.files.find((f) => f.path === 'package.json');
    expect(pkg?.content).toContain('A cool lib');
  });
});

// ─── DependencyChecker ───────────────────────────────────────────────────────

describe('DependencyChecker', () => {
  let checker: DependencyChecker;

  beforeEach(() => {
    checker = new DependencyChecker();
  });

  it('starts with zero declarations', () => {
    expect(checker.declaredCount()).toBe(0);
  });

  it('declare() registers a dependency', () => {
    checker.declare('typescript', '^5.0.0');
    expect(checker.declaredCount()).toBe(1);
  });

  it('check() marks compatible when major matches and minor >=', () => {
    checker.declare('ts', '^5.0.0');
    checker.setInstalled('ts', '5.3.0');
    const result = checker.check();
    expect(result.compatible).toBe(true);
    expect(result.incompatible).toHaveLength(0);
  });

  it('check() marks incompatible when major differs', () => {
    checker.declare('ts', '^5.0.0');
    checker.setInstalled('ts', '4.9.0');
    const result = checker.check();
    expect(result.compatible).toBe(false);
    expect(result.incompatible).toHaveLength(1);
  });

  it('check() marks compatible for ~-range when major and minor match', () => {
    checker.declare('lib', '~1.2.0');
    checker.setInstalled('lib', '1.2.5');
    expect(checker.check().compatible).toBe(true);
  });

  it('check() marks incompatible for ~-range when minor differs', () => {
    checker.declare('lib', '~1.2.0');
    checker.setInstalled('lib', '1.3.0');
    expect(checker.check().compatible).toBe(false);
  });

  it('check() marks compatible for exact version match', () => {
    checker.declare('lib', '2.0.0');
    checker.setInstalled('lib', '2.0.0');
    expect(checker.check().compatible).toBe(true);
  });

  it('check() defaults installed to 0.0.0 when missing', () => {
    checker.declare('missing', '^1.0.0');
    expect(checker.check().compatible).toBe(false);
  });

  it('check() reports checked count', () => {
    checker.declare('a', '^1.0.0');
    checker.declare('b', '^2.0.0');
    expect(checker.check().checked).toBe(2);
  });

  it('getAll() includes all dependency info', () => {
    checker.declare('x', '^1.0.0');
    checker.setInstalled('x', '1.5.0');
    const all = checker.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe('x');
  });

  it('removeDeclaration() removes a dependency', () => {
    checker.declare('x', '^1.0.0');
    checker.removeDeclaration('x');
    expect(checker.declaredCount()).toBe(0);
  });

  it('clear() resets all declarations and installed versions', () => {
    checker.declare('x', '^1.0.0');
    checker.setInstalled('x', '1.0.0');
    checker.clear();
    expect(checker.declaredCount()).toBe(0);
  });
});

// ─── VersionManager ──────────────────────────────────────────────────────────

describe('VersionManager', () => {
  let manager: VersionManager;

  beforeEach(() => {
    manager = new VersionManager();
  });

  it('starts empty', () => {
    expect(manager.packageCount()).toBe(0);
  });

  it('register() stores a version record', () => {
    manager.register('typescript', '5.2.0');
    expect(manager.has('typescript')).toBe(true);
  });

  it('get() returns the stored record', () => {
    manager.register('ts', '5.0.0');
    expect(manager.get('ts')?.version).toBe('5.0.0');
  });

  it('get() returns undefined for unknown package', () => {
    expect(manager.get('unknown')).toBeUndefined();
  });

  it('register() marks package as outdated when latest is newer', () => {
    manager.register('pkg', '1.0.0', '1.1.0');
    expect(manager.get('pkg')?.outdated).toBe(true);
  });

  it('register() marks package as up-to-date when versions equal', () => {
    manager.register('pkg', '1.1.0', '1.1.0');
    expect(manager.get('pkg')?.outdated).toBe(false);
  });

  it('register() without latest marks as not outdated', () => {
    manager.register('pkg', '1.0.0');
    expect(manager.get('pkg')?.outdated).toBe(false);
  });

  it('getOutdated() returns only outdated packages', () => {
    manager.register('a', '1.0.0', '2.0.0');
    manager.register('b', '1.0.0', '1.0.0');
    expect(manager.getOutdated()).toHaveLength(1);
  });

  it('getUpToDate() returns non-outdated packages', () => {
    manager.register('a', '1.0.0', '2.0.0');
    manager.register('b', '1.0.0');
    expect(manager.getUpToDate()).toHaveLength(1);
  });

  it('outdatedCount() equals getOutdated().length', () => {
    manager.register('x', '1.0.0', '2.0.0');
    expect(manager.outdatedCount()).toBe(manager.getOutdated().length);
  });

  it('summary() reports tracking count and outdated info', () => {
    manager.register('typescript', '5.2.0', '5.3.0');
    const s = manager.summary();
    expect(s).toContain('typescript');
    expect(s).toContain('5.2.0');
  });

  it('summary() reports "No packages tracked" when empty', () => {
    expect(manager.summary()).toContain('No packages tracked');
  });

  it('remove() deletes a package and returns true', () => {
    manager.register('x', '1.0.0');
    expect(manager.remove('x')).toBe(true);
    expect(manager.has('x')).toBe(false);
  });

  it('remove() returns false for unknown package', () => {
    expect(manager.remove('nope')).toBe(false);
  });

  it('clear() removes all records', () => {
    manager.register('a', '1.0.0');
    manager.clear();
    expect(manager.packageCount()).toBe(0);
  });

  it('handles major version differences correctly', () => {
    manager.register('lib', '3.0.0', '4.0.0');
    expect(manager.get('lib')?.outdated).toBe(true);
  });

  it('handles patch version differences correctly', () => {
    manager.register('lib', '1.0.0', '1.0.9');
    expect(manager.get('lib')?.outdated).toBe(true);
  });
});
