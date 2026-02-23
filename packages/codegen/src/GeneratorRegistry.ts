import type {
  Generator,
  GeneratorContext,
  GeneratorCategory,
  GeneratorSummary,
  GenerationResult,
} from './GeneratorTypes';
import { CrudGenerator } from './generators/CrudGenerator';
import { ApiEndpointGenerator } from './generators/ApiEndpointGenerator';
import { TestSuiteGenerator } from './generators/TestSuiteGenerator';
import { MigrationGenerator } from './generators/MigrationGenerator';

const BUILT_IN: readonly Generator[] = [
  new CrudGenerator(),
  new ApiEndpointGenerator(),
  new TestSuiteGenerator(),
  new MigrationGenerator(),
];

export class GeneratorRegistry {
  private readonly extra: Generator[] = [];

  getAll(): readonly Generator[] {
    return [...BUILT_IN, ...this.extra];
  }

  get(id: string): Generator | undefined {
    return this.getAll().find((g) => g.id === id);
  }

  getByCategory(category: GeneratorCategory): readonly Generator[] {
    return this.getAll().filter((g) => g.category === category);
  }

  count(): number {
    return this.getAll().length;
  }

  summaries(): readonly GeneratorSummary[] {
    return this.getAll().map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      description: g.description,
    }));
  }

  register(generator: Generator): void {
    const idx = this.extra.findIndex((g) => g.id === generator.id);
    if (idx >= 0) this.extra.splice(idx, 1);
    this.extra.push(generator);
  }

  remove(id: string): boolean {
    const idx = this.extra.findIndex((g) => g.id === id);
    if (idx < 0) return false;
    this.extra.splice(idx, 1);
    return true;
  }

  run(id: string, context: GeneratorContext): GenerationResult {
    const generator = this.get(id);
    if (generator === undefined) {
      return {
        generatorId: id,
        files: [],
        success: false,
        errors: [`Generator '${id}' not found`],
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    return generator.generate(context as any);
  }
}
