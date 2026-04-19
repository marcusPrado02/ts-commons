import type {
  RenderOptions,
  RenderedSnippet,
  Snippet,
  SnippetFile,
  SnippetFileEntry,
  SnippetKind,
} from './SnippetTypes';

const ENTITY_BODY: readonly string[] = [
  'export class $ClassName {',
  '  private constructor(',
  '    private readonly _id: string,',
  '    ${1:// fields}',
  '  ) {}',
  '',
  '  static create(id: string, ${2:args}: ${3:Props}): $ClassName {',
  '    return new $ClassName(id, ${2:args});',
  '  }',
  '',
  '  get id(): string { return this._id; }',
  '}',
];

const VALUE_OBJECT_BODY: readonly string[] = [
  'export class $ClassName {',
  '  private constructor(readonly value: ${1:string}) {}',
  '',
  '  static create(value: ${1:string}): $ClassName {',
  '    return new $ClassName(value);',
  '  }',
  '',
  '  equals(other: $ClassName): boolean {',
  '    return this.value === other.value;',
  '  }',
  '}',
];

const USE_CASE_BODY: readonly string[] = [
  'export interface ${1:$ClassName}Input {',
  '  ${2:field}: ${3:string};',
  '}',
  '',
  'export interface ${1:$ClassName}Output {',
  '  ${4:result}: ${5:unknown};',
  '}',
  '',
  'export class $ClassName {',
  '  async execute(input: ${1:$ClassName}Input): Promise<${1:$ClassName}Output> {',
  '    ${6:// TODO: implement}',
  '    throw new Error("Not implemented");',
  '  }',
  '}',
];

const REPOSITORY_BODY: readonly string[] = [
  'export interface $ClassNameRepository {',
  '  findById(id: string): Promise<${1:Entity} | undefined>;',
  '  save(entity: ${1:Entity}): Promise<void>;',
  '  delete(id: string): Promise<void>;',
  '}',
];

const EVENT_BODY: readonly string[] = [
  'export interface $ClassNamePayload {',
  '  ${1:field}: ${2:string};',
  '}',
  '',
  'export class $ClassName {',
  '  readonly name = "$ClassName" as const;',
  '  constructor(',
  '    readonly occurredAt: Date,',
  '    readonly payload: $ClassNamePayload,',
  '  ) {}',
  '}',
];

const AGGREGATE_BODY: readonly string[] = [
  'export class $ClassName {',
  '  private readonly _events: unknown[] = [];',
  '',
  '  private constructor(private readonly _id: string) {}',
  '',
  '  static create(id: string): $ClassName {',
  '    return new $ClassName(id);',
  '  }',
  '',
  '  get id(): string { return this._id; }',
  '  get domainEvents(): readonly unknown[] { return this._events; }',
  '',
  '  clearEvents(): void { this._events.length = 0; }',
  '}',
];

const DOMAIN_SERVICE_BODY: readonly string[] = [
  'export class $ClassName {',
  '  ${1:execute}(${2:// args}): ${3:void} {',
  '    ${4:// TODO: implement}',
  '  }',
  '}',
];

const BUILT_IN_SNIPPETS: ReadonlyArray<Snippet> = [
  {
    id: 'acme.entity',
    name: 'DDD Entity',
    prefix: 'acme-entity',
    kind: 'entity',
    body: ENTITY_BODY,
    description: 'Generates a DDD Entity class with private constructor and factory method.',
    tags: ['ddd', 'entity', 'domain'],
  },
  {
    id: 'acme.value-object',
    name: 'DDD Value Object',
    prefix: 'acme-vo',
    kind: 'value-object',
    body: VALUE_OBJECT_BODY,
    description: 'Generates a DDD Value Object with equality and factory method.',
    tags: ['ddd', 'value-object', 'domain'],
  },
  {
    id: 'acme.use-case',
    name: 'DDD Use Case',
    prefix: 'acme-usecase',
    kind: 'use-case',
    body: USE_CASE_BODY,
    description: 'Generates a DDD Use Case with typed input/output.',
    tags: ['ddd', 'use-case', 'application'],
  },
  {
    id: 'acme.repository',
    name: 'DDD Repository interface',
    prefix: 'acme-repo',
    kind: 'repository',
    body: REPOSITORY_BODY,
    description: 'Generates a DDD Repository interface.',
    tags: ['ddd', 'repository', 'infrastructure'],
  },
  {
    id: 'acme.event',
    name: 'DDD Domain Event',
    prefix: 'acme-event',
    kind: 'event',
    body: EVENT_BODY,
    description: 'Generates a typed DDD Domain Event class.',
    tags: ['ddd', 'event', 'domain'],
  },
  {
    id: 'acme.aggregate',
    name: 'DDD Aggregate Root',
    prefix: 'acme-aggregate',
    kind: 'aggregate',
    body: AGGREGATE_BODY,
    description: 'Generates a DDD Aggregate Root with domain events support.',
    tags: ['ddd', 'aggregate', 'domain'],
  },
  {
    id: 'acme.service',
    name: 'DDD Domain Service',
    prefix: 'acme-service',
    kind: 'domain-service',
    body: DOMAIN_SERVICE_BODY,
    description: 'Generates a DDD Domain Service class.',
    tags: ['ddd', 'service', 'domain'],
  },
];

function applyClass(line: string, className: string): string {
  return line.replaceAll('$ClassName', className);
}

function renderBody(body: readonly string[], className: string): string {
  return body.map((l) => applyClass(l, className)).join('\n');
}

function toFileEntry(snippet: Snippet): SnippetFileEntry {
  return {
    prefix: snippet.prefix,
    body: [...snippet.body],
    description: snippet.description,
  };
}

/**
 * Registry of all built-in DDD code snippets.
 * Supports lookup, filtering, rendering and VS Code snippet file export.
 */
export class SnippetLibrary {
  private readonly snippets = new Map<string, Snippet>(BUILT_IN_SNIPPETS.map((s) => [s.id, s]));

  /** All registered snippets. */
  getAll(): ReadonlyArray<Snippet> {
    return Array.from(this.snippets.values());
  }

  /** Retrieve a snippet by its id. */
  get(id: string): Snippet | undefined {
    return this.snippets.get(id);
  }

  /** Filter snippets by kind. */
  getByKind(kind: SnippetKind): ReadonlyArray<Snippet> {
    return this.getAll().filter((s) => s.kind === kind);
  }

  /** Filter snippets by tag. */
  getByTag(tag: string): ReadonlyArray<Snippet> {
    return this.getAll().filter((s) => s.tags.includes(tag));
  }

  /** Total number of snippets. */
  count(): number {
    return this.snippets.size;
  }

  /** Render a snippet body with a concrete class name. */
  render(id: string, opts: RenderOptions): RenderedSnippet | undefined {
    const snippet = this.snippets.get(id);
    if (snippet === undefined) {
      return undefined;
    }
    return {
      id: snippet.id,
      kind: snippet.kind,
      className: opts.className,
      code: renderBody(snippet.body, opts.className),
    };
  }

  /** Export all snippets as a VS Code snippets JSON object. */
  toSnippetFile(): SnippetFile {
    const file: Record<string, SnippetFileEntry> = {};
    for (const snippet of this.getAll()) {
      file[snippet.name] = toFileEntry(snippet);
    }
    return file;
  }

  /** Register an additional custom snippet. */
  register(snippet: Snippet): void {
    this.snippets.set(snippet.id, snippet);
  }

  /** Remove a snippet by id. Returns true if it existed. */
  remove(id: string): boolean {
    return this.snippets.delete(id);
  }
}
