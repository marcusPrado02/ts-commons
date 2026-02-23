import type {
  Generator,
  CrudContext,
  GenerationResult,
  GeneratedFile,
  EntityField,
} from '../GeneratorTypes';
import { render, capitalize, toKebab, toCamel, pluralise } from '../TemplateEngine';

const ENTITY_TEMPLATE = `import { Entity } from '@acme/kernel';

export class {{Name}} extends Entity<string> {
{{fields}}
  private constructor(
    id: string,
{{ctorParams}}
  ) {
    super(id);
{{ctorAssign}}
  }

  static create(
    id: string,
{{ctorParams}}
  ): {{Name}} {
    return new {{Name}}(id{{ctorArgs}});
  }
}
`;

const REPO_TEMPLATE = `import type { {{Name}} } from './{{name}}';

export interface {{Name}}Repository {
  findById(id: string): Promise<{{Name}} | undefined>;
  save(entity: {{Name}}): Promise<void>;
  delete(id: string): Promise<void>;
  findAll(): Promise<readonly {{Name}}[]>;
}
`;

const USE_CASE_TEMPLATE = `import type { {{Name}}Repository } from '../{{name}}.repository';

export class {{UseCase}}{{Name}} {
  constructor(private readonly repo: {{Name}}Repository) {}

  async execute({{param}}): Promise<void> {
    // TODO: implement
  }
}
`;

function fieldDeclaration(f: EntityField): string {
  const nullable = f.nullable ? ' | undefined' : '';
  return `  readonly ${f.name}: ${f.type}${nullable};`;
}

function ctorParam(f: EntityField): string {
  const nullable = f.nullable ? '?' : '';
  return `    readonly ${f.name}${nullable}: ${f.type},`;
}

function ctorAssign(f: EntityField): string {
  return `    this.${f.name} = ${f.name};`;
}

function ctorArg(f: EntityField): string {
  return `, ${f.name}`;
}

function renderEntity(name: string, fields: readonly EntityField[]): string {
  const ctx: Record<string, string> = {
    Name: capitalize(name),
    name: toCamel(name),
    fields: fields.map(fieldDeclaration).join('\n'),
    ctorParams: fields.map(ctorParam).join('\n'),
    ctorAssign: fields.map(ctorAssign).join('\n'),
    ctorArgs: fields.map(ctorArg).join(''),
  };
  return render(ENTITY_TEMPLATE, ctx);
}

function renderRepo(name: string): string {
  return render(REPO_TEMPLATE, { Name: capitalize(name), name: toCamel(name) });
}

function renderUseCase(name: string, useCase: string, param: string): string {
  return render(USE_CASE_TEMPLATE, {
    Name: capitalize(name),
    name: toCamel(name),
    UseCase: useCase,
    param,
  });
}

function buildFiles(ctx: CrudContext): GeneratedFile[] {
  const name = ctx.entityName;
  const kebab = toKebab(name);
  const plural = pluralise(kebab);
  const base = `${ctx.outputDir}/${plural}`;

  const files: GeneratedFile[] = [
    { path: `${base}/domain/${kebab}.ts`, content: renderEntity(name, ctx.fields) },
    { path: `${base}/domain/${kebab}.repository.ts`, content: renderRepo(name) },
    {
      path: `${base}/application/create-${kebab}.use-case.ts`,
      content: renderUseCase(name, 'Create', `data: Partial<${capitalize(name)}>`),
    },
    {
      path: `${base}/application/find-${kebab}.use-case.ts`,
      content: renderUseCase(name, 'Find', 'id: string'),
    },
    {
      path: `${base}/application/update-${kebab}.use-case.ts`,
      content: renderUseCase(name, 'Update', 'id: string'),
    },
    {
      path: `${base}/application/delete-${kebab}.use-case.ts`,
      content: renderUseCase(name, 'Delete', 'id: string'),
    },
  ];

  return files;
}

export class CrudGenerator implements Generator<CrudContext> {
  readonly id = 'crud';
  readonly name = 'CRUD Generator';
  readonly description =
    'Generates Entity, Repository interface and Create/Find/Update/Delete use-cases.';
  readonly category = 'crud' as const;

  generate(context: CrudContext): GenerationResult {
    if (context.entityName.trim().length === 0) {
      return {
        generatorId: this.id,
        files: [],
        success: false,
        errors: ['entityName is required'],
      };
    }
    const files = buildFiles(context);
    return { generatorId: this.id, files, success: true, errors: [] };
  }
}
