/** A single file produced by a generator. */
export interface GeneratedFile {
  /** Relative path where the file should be written. */
  readonly path: string;
  /** File content. */
  readonly content: string;
}

/** Result of running a generator. */
export interface GenerationResult {
  readonly generatorId: string;
  readonly files: readonly GeneratedFile[];
  readonly success: boolean;
  readonly errors: readonly string[];
}

/** Category grouping for generators. */
export type GeneratorCategory = 'crud' | 'api' | 'test' | 'migration' | 'custom';

/** Metadata + execution interface for a generator. */
export interface Generator<TContext extends GeneratorContext = GeneratorContext> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: GeneratorCategory;
  generate(context: TContext): GenerationResult;
}

/** Base fields every generator context must provide. */
export interface GeneratorContext {
  readonly outputDir: string;
}

/** Context for CRUD generators. */
export interface CrudContext extends GeneratorContext {
  readonly entityName: string;
  readonly fields: readonly EntityField[];
  readonly withTests: boolean;
}

/** Context for API endpoint generators. */
export interface ApiContext extends GeneratorContext {
  readonly resourceName: string;
  readonly basePath: string;
  readonly methods: readonly HttpMethod[];
  readonly framework: 'express' | 'fastify';
}

/** Context for test suite generators. */
export interface TestSuiteContext extends GeneratorContext {
  readonly sourceFile: string;
  readonly className: string;
  readonly methods: readonly string[];
}

/** Context for migration generators. */
export interface MigrationContext extends GeneratorContext {
  readonly migrationName: string;
  readonly tableName: string;
  readonly fields: readonly EntityField[];
  readonly reversible: boolean;
}

/** A field definition used by CRUD and migration generators. */
export interface EntityField {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'Date' | 'string[]';
  readonly nullable: boolean;
}

/** Supported HTTP methods. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Summary of a registered generator. */
export interface GeneratorSummary {
  readonly id: string;
  readonly name: string;
  readonly category: GeneratorCategory;
  readonly description: string;
}
