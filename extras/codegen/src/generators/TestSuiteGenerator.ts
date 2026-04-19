import type {
  Generator,
  TestSuiteContext,
  GenerationResult,
  GeneratedFile,
} from '../GeneratorTypes';
import { render, toKebab, toCamel } from '../TemplateEngine';

const TEST_TEMPLATE = `import { describe, it, expect, beforeEach } from 'vitest';
import { {{ClassName}} } from '{{importPath}}';

describe('{{ClassName}}', () => {
  let instance: {{ClassName}};

  beforeEach(() => {
    instance = new {{ClassName}}();
  });

{{testCases}}
});
`;

const TEST_CASE_TEMPLATE = `  describe('{{method}}', () => {
    it('should work correctly', () => {
      // TODO: implement test for {{ClassName}}.{{method}}
      expect(instance).toBeDefined();
    });
  });
`;

function renderTestCase(className: string, method: string): string {
  return render(TEST_CASE_TEMPLATE, { ClassName: className, method });
}

function importPath(sourceFile: string, outputDir: string): string {
  const relative = sourceFile.startsWith(outputDir)
    ? sourceFile.slice(outputDir.length).replace(/^\//, '')
    : sourceFile;
  return relative.replace(/\.ts$/, '');
}

function buildTestFile(ctx: TestSuiteContext): GeneratedFile {
  const testCases = ctx.methods.map((m) => renderTestCase(ctx.className, m)).join('\n');
  const content = render(TEST_TEMPLATE, {
    ClassName: ctx.className,
    importPath: importPath(ctx.sourceFile, ctx.outputDir),
    testCases,
  });
  const kebab = toKebab(toCamel(ctx.className));
  const path = `${ctx.outputDir}/${kebab}.test.ts`;
  return { path, content };
}

export class TestSuiteGenerator implements Generator<TestSuiteContext> {
  readonly id = 'test-suite';
  readonly name = 'Test Suite Generator';
  readonly description =
    'Generates a Vitest test suite with describe/it scaffolding for a given class.';
  readonly category = 'test' as const;

  generate(context: TestSuiteContext): GenerationResult {
    if (context.className.trim().length === 0) {
      return { generatorId: this.id, files: [], success: false, errors: ['className is required'] };
    }
    const file = buildTestFile(context);
    return { generatorId: this.id, files: [file], success: true, errors: [] };
  }
}
