/**
 * Architecture Testing Framework
 *
 * Provides comprehensive validation of Clean Architecture, CQRS, and DDD patterns
 * in TypeScript codebases using automated static analysis.
 */

export { DependencyAnalyzer } from './analyzers/DependencyAnalyzer';
export type {
  Layer,
  LayerComponent,
  LayerViolation,
  ViolationSeverity
} from './analyzers/DependencyAnalyzer';

export { CQRSAnalyzer } from './analyzers/CQRSAnalyzer';
export type {
  CQRSComponent,
  CQRSViolation,
  CQRSType
} from './analyzers/CQRSAnalyzer';

export { DDDAnalyzer, DDDType, ViolationSeverity } from './analyzers/DDDAnalyzer';
export type {
  DDDComponent,
  DDDViolation,
  DDDViolationType
} from './analyzers/DDDAnalyzer';

/**
 * Convenience function to run all architecture analyses
 */
export async function analyzeArchitecture(workspaceRoot: string = process.cwd()) {
  const dependencyAnalyzer = new DependencyAnalyzer(workspaceRoot);
  const cqrsAnalyzer = new CQRSAnalyzer(workspaceRoot);
  const dddAnalyzer = new DDDAnalyzer(workspaceRoot);

  const [layerViolations, cqrsViolations, dddViolations] = await Promise.all([
    dependencyAnalyzer.analyzeDependencies(),
    cqrsAnalyzer.analyzeImplementation(),
    Promise.resolve(dddAnalyzer.analyzeImplementation())
  ]);

  return {
    cleanArchitecture: {
      violations: layerViolations,
      layers: dependencyAnalyzer.getLayers(),
      circularDependencies: dependencyAnalyzer.detectCircularDependencies()
    },
    cqrs: {
      violations: cqrsViolations,
      commands: cqrsAnalyzer.getCommands(),
      queries: cqrsAnalyzer.getQueries(),
      commandHandlers: cqrsAnalyzer.getCommandHandlers(),
      queryHandlers: cqrsAnalyzer.getQueryHandlers(),
      events: cqrsAnalyzer.getEvents()
    },
    ddd: {
      violations: dddViolations,
      components: dddAnalyzer.getComponents()
    }
  };
}
