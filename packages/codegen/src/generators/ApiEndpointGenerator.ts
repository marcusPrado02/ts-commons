import type {
  Generator,
  ApiContext,
  GenerationResult,
  GeneratedFile,
  HttpMethod,
} from '../GeneratorTypes';
import { render, capitalize, toKebab, toCamel, pluralise } from '../TemplateEngine';

const HANDLER_TEMPLATE = `import type { Request, Response } from '{{framework}}';

export class {{Name}}Controller {
  // {{method}} {{basePath}}
  async {{handlerName}}(req: Request, res: Response): Promise<void> {
    // TODO: implement {{method}} {{basePath}}
    res.status(200).json({ message: '{{method}} {{basePath}}' });
  }
}
`;

const ROUTE_TEMPLATE = `import { {{Name}}Controller } from './{{name}}.controller';

const controller = new {{Name}}Controller();

export const {{name}}Routes = [
{{routes}}
];
`;

const DTO_TEMPLATE = `export interface {{Name}}RequestDto {
  // TODO: define request fields
}

export interface {{Name}}ResponseDto {
  id: string;
  // TODO: define response fields
}
`;

function handlerName(method: HttpMethod): string {
  const map: Record<HttpMethod, string> = {
    GET: 'getOne',
    POST: 'create',
    PUT: 'replace',
    PATCH: 'update',
    DELETE: 'remove',
  };
  return map[method];
}

function routeLine(method: HttpMethod, basePath: string, controllerVar: string): string {
  const handler = handlerName(method);
  return `  { method: '${method}', path: '${basePath}', handler: ${controllerVar}.${handler}.bind(${controllerVar}) },`;
}

function frameworkImport(framework: ApiContext['framework']): string {
  return framework === 'fastify' ? 'fastify' : 'express';
}

function buildApiFiles(ctx: ApiContext): GeneratedFile[] {
  const name = ctx.resourceName;
  const kebab = toKebab(name);
  const plural = pluralise(kebab);
  const base = `${ctx.outputDir}/${plural}`;
  const camelName = toCamel(name);

  const controllerContent = ctx.methods
    .map((m) =>
      render(HANDLER_TEMPLATE, {
        Name: capitalize(name),
        name: camelName,
        method: m,
        basePath: `${ctx.basePath}/${m === 'POST' ? '' : ':id'}`.replace(/\/$/, ''),
        handlerName: handlerName(m),
        framework: frameworkImport(ctx.framework),
      }),
    )
    .join('\n');

  const routeLines = ctx.methods
    .map((m) =>
      routeLine(m, `${ctx.basePath}/${m === 'POST' ? '' : ':id'}`.replace(/\/$/, ''), camelName),
    )
    .join('\n');

  const routeContent = render(ROUTE_TEMPLATE, {
    Name: capitalize(name),
    name: camelName,
    routes: routeLines,
  });

  const dtoContent = render(DTO_TEMPLATE, { Name: capitalize(name) });

  return [
    { path: `${base}/${kebab}.controller.ts`, content: controllerContent },
    { path: `${base}/${kebab}.routes.ts`, content: routeContent },
    { path: `${base}/${kebab}.dto.ts`, content: dtoContent },
  ];
}

export class ApiEndpointGenerator implements Generator<ApiContext> {
  readonly id = 'api-endpoint';
  readonly name = 'API Endpoint Generator';
  readonly description = 'Generates controller, route definitions and DTOs for REST API resources.';
  readonly category = 'api' as const;

  generate(context: ApiContext): GenerationResult {
    if (context.resourceName.trim().length === 0) {
      return {
        generatorId: this.id,
        files: [],
        success: false,
        errors: ['resourceName is required'],
      };
    }
    if (context.methods.length === 0) {
      return {
        generatorId: this.id,
        files: [],
        success: false,
        errors: ['at least one method is required'],
      };
    }
    const files = buildApiFiles(context);
    return { generatorId: this.id, files, success: true, errors: [] };
  }
}
