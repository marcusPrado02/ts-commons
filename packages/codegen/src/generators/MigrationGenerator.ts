import type {
  Generator,
  MigrationContext,
  GenerationResult,
  GeneratedFile,
  EntityField,
} from '../GeneratorTypes';
import { render, toSnake } from '../TemplateEngine';

const MIGRATION_TEMPLATE = `import type { Migration } from '@acme/persistence';

export const {{migrationName}}: Migration = {
  name: '{{migrationName}}',
  async up(db): Promise<void> {
    await db.schema.createTable('{{tableName}}', (table) => {
      table.string('id').primary();
{{columns}}
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  },
{{downSection}}
};
`;

const DOWN_TEMPLATE = `  async down(db): Promise<void> {
    await db.schema.dropTableIfExists('{{tableName}}');
  },
`;

function columnLine(field: EntityField): string {
  const method = columnMethod(field.type);
  const nullable = field.nullable ? '.nullable()' : '.notNullable()';
  return `      table.${method}('${toSnake(field.name)}')${nullable};`;
}

function columnMethod(type: EntityField['type']): string {
  switch (type) {
    case 'number':
      return 'decimal';
    case 'boolean':
      return 'boolean';
    case 'Date':
      return 'timestamp';
    case 'string[]':
      return 'json';
    case 'string':
      return 'string';
  }
}

function buildMigrationFile(ctx: MigrationContext): GeneratedFile {
  const snakeName = toSnake(ctx.migrationName);
  const columns = ctx.fields.map(columnLine).join('\n');
  const downSection = ctx.reversible
    ? render(DOWN_TEMPLATE, { tableName: ctx.tableName })
    : '  // Migration is not reversible\n';

  const content = render(MIGRATION_TEMPLATE, {
    migrationName: snakeName,
    tableName: ctx.tableName,
    columns,
    downSection,
  });

  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, '')
    .slice(0, 14);
  const path = `${ctx.outputDir}/${timestamp}_${snakeName}.ts`;
  return { path, content };
}

export class MigrationGenerator implements Generator<MigrationContext> {
  readonly id = 'migration';
  readonly name = 'Migration Generator';
  readonly description =
    'Generates an up/down database migration file with typed column definitions.';
  readonly category = 'migration' as const;

  generate(context: MigrationContext): GenerationResult {
    if (context.migrationName.trim().length === 0) {
      return {
        generatorId: this.id,
        files: [],
        success: false,
        errors: ['migrationName is required'],
      };
    }
    if (context.tableName.trim().length === 0) {
      return { generatorId: this.id, files: [], success: false, errors: ['tableName is required'] };
    }
    const file = buildMigrationFile(context);
    return { generatorId: this.id, files: [file], success: true, errors: [] };
  }
}
