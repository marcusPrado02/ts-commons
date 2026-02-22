import type { ArtifactKind, ScaffoldRequest, GenerationResult } from '../cli/CliTypes';

const PASCAL_RE = /^[A-Z][A-Za-z0-9]*$/;

function toPascal(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function entityTemplate(name: string): string {
  return [
    `import { Entity } from '@acme/kernel';`,
    ``,
    `export interface ${name}Props {`,
    `  readonly id: string;`,
    `}`,
    ``,
    `export class ${name} extends Entity<${name}Props> {`,
    `  get id(): string { return this.props.id; }`,
    `}`,
  ].join('\n');
}

function aggregateTemplate(name: string): string {
  return [
    `import { AggregateRoot } from '@acme/kernel';`,
    ``,
    `export interface ${name}Props {`,
    `  readonly id: string;`,
    `}`,
    ``,
    `export class ${name} extends AggregateRoot<${name}Props> {`,
    `  get id(): string { return this.props.id; }`,
    `}`,
  ].join('\n');
}

function useCaseTemplate(name: string): string {
  return [
    `import type { UseCase } from '@acme/application';`,
    ``,
    `export interface ${name}Input { }`,
    `export interface ${name}Output { }`,
    ``,
    `export class ${name} implements UseCase<${name}Input, ${name}Output> {`,
    `  async execute(_input: ${name}Input): Promise<${name}Output> {`,
    `    throw new Error('Not implemented');`,
    `  }`,
    `}`,
  ].join('\n');
}

function repositoryTemplate(name: string): string {
  return [
    `export interface ${name}<T> {`,
    `  findById(id: string): Promise<T | undefined>;`,
    `  save(entity: T): Promise<void>;`,
    `  delete(id: string): Promise<void>;`,
    `}`,
  ].join('\n');
}

function eventTemplate(name: string): string {
  return [
    `import { DomainEvent } from '@acme/kernel';`,
    ``,
    `export class ${name} extends DomainEvent {`,
    `  static readonly EVENT_NAME = '${name}';`,
    `  readonly eventName = ${name}.EVENT_NAME;`,
    `}`,
  ].join('\n');
}

function valueObjectTemplate(name: string): string {
  return [
    `import { ValueObject } from '@acme/kernel';`,
    ``,
    `export interface ${name}Props { readonly value: string; }`,
    ``,
    `export class ${name} extends ValueObject<${name}Props> {`,
    `  get value(): string { return this.props.value; }`,
    `}`,
  ].join('\n');
}

function serviceTemplate(name: string): string {
  return [`export class ${name} {`, `  // TODO: inject dependencies`, `}`].join('\n');
}

const TEMPLATES: Record<ArtifactKind, (name: string) => string> = {
  entity: entityTemplate,
  aggregate: aggregateTemplate,
  'use-case': useCaseTemplate,
  repository: repositoryTemplate,
  event: eventTemplate,
  'value-object': valueObjectTemplate,
  service: serviceTemplate,
};

/**
 * Generates DDD scaffold files from a {@link ScaffoldRequest}.
 *
 * @example
 * ```typescript
 * const cmd = new ScaffoldCommand();
 * const result = cmd.generate({ kind: 'entity', name: 'User' });
 * console.log(result.content);
 * ```
 */
export class ScaffoldCommand {
  private readonly supportedKinds: ArtifactKind[] = [
    'entity',
    'aggregate',
    'use-case',
    'repository',
    'event',
    'value-object',
    'service',
  ];

  getSupportedKinds(): ArtifactKind[] {
    return [...this.supportedKinds];
  }

  isSupported(kind: string): kind is ArtifactKind {
    return this.supportedKinds.includes(kind as ArtifactKind);
  }

  generate(request: ScaffoldRequest): GenerationResult {
    if (!this.isSupported(request.kind)) {
      return {
        success: false,
        filePath: '',
        content: '',
        error: `Unsupported artifact kind: ${String(request.kind)}`,
      };
    }
    if (request.name.trim().length === 0) {
      return { success: false, filePath: '', content: '', error: 'Name cannot be empty' };
    }
    const name = toPascal(request.name);
    const template = TEMPLATES[request.kind];
    const content = template(name);
    const dir = request.outputDir ?? `src/${request.kind}s`;
    const filePath = `${dir}/${name}.ts`;
    return { success: true, filePath, content };
  }

  validateName(name: string): boolean {
    return PASCAL_RE.test(toPascal(name));
  }

  /** Return the suggested file path for a given kind and name without generating code. */
  suggestPath(kind: ArtifactKind, name: string, baseDir?: string): string {
    const pascal = toPascal(name);
    const dir = baseDir ?? `src/${kind}s`;
    return `${dir}/${pascal}.ts`;
  }
}
