/**
 * Architecture Testing Framework
 *
 * Provides comprehensive validation of Clean Architecture, CQRS, and DDD patterns
 * in TypeScript codebases using automated static analysis.
 */

import type { Layer, LayerViolation } from './analyzers/DependencyAnalyzer';
import type { CQRSComponent, CQRSViolation } from './analyzers/CQRSAnalyzer';
import type { DDDComponent, DDDViolation } from './analyzers/DDDAnalyzer';

export { DependencyAnalyzer } from './analyzers/DependencyAnalyzer';
export type {
  Layer,
  LayerComponent,
  LayerViolation,
  ViolationSeverity,
} from './analyzers/DependencyAnalyzer';

export { CQRSAnalyzer } from './analyzers/CQRSAnalyzer';
export type {
  CQRSComponent,
  CQRSViolation,
  CQRSType,
  CQRSViolationType,
} from './analyzers/CQRSAnalyzer';

export { DDDAnalyzer, DDDType } from './analyzers/DDDAnalyzer';
export type {
  DDDComponent,
  DDDViolation,
  DDDViolationType,
  ViolationSeverity as DDDViolationSeverity,
} from './analyzers/DDDAnalyzer';

/** Result of a full architecture analysis */
export interface ArchitectureAnalysisResult {
  cleanArchitecture: {
    violations: LayerViolation[];
    layers: Layer[];
    circularDependencies: string[][];
  };
  cqrs: {
    violations: CQRSViolation[];
    commands: CQRSComponent[];
    queries: CQRSComponent[];
    commandHandlers: CQRSComponent[];
    queryHandlers: CQRSComponent[];
    events: CQRSComponent[];
  };
  ddd: {
    violations: DDDViolation[];
    components: DDDComponent[];
  };
}

/**
 * Convenience function to run all architecture analyses
 */
export async function analyzeArchitecture(
  workspaceRoot: string = process.cwd(),
): Promise<ArchitectureAnalysisResult> {
  const { DependencyAnalyzer } = await import('./analyzers/DependencyAnalyzer');
  const { CQRSAnalyzer } = await import('./analyzers/CQRSAnalyzer');
  const { DDDAnalyzer } = await import('./analyzers/DDDAnalyzer');

  const dependencyAnalyzer = new DependencyAnalyzer(workspaceRoot);
  const cqrsAnalyzer = new CQRSAnalyzer(workspaceRoot);
  const dddAnalyzer = new DDDAnalyzer(workspaceRoot);

  const layerViolations = dependencyAnalyzer.analyzeDependencies();
  const cqrsViolations = await cqrsAnalyzer.analyzeImplementation();
  const dddViolations = dddAnalyzer.analyzeImplementation();

  return {
    cleanArchitecture: {
      violations: layerViolations,
      layers: dependencyAnalyzer.getLayers(),
      circularDependencies: dependencyAnalyzer.detectCircularDependencies(),
    },
    cqrs: {
      violations: cqrsViolations,
      commands: cqrsAnalyzer.getCommands(),
      queries: cqrsAnalyzer.getQueries(),
      commandHandlers: cqrsAnalyzer.getCommandHandlers(),
      queryHandlers: cqrsAnalyzer.getQueryHandlers(),
      events: cqrsAnalyzer.getEvents(),
    },
    ddd: {
      violations: dddViolations,
      components: dddAnalyzer.getComponents(),
    },
  };
}
