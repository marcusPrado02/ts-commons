// CLI types (Item 53)
export type {
  ArtifactKind,
  ScaffoldRequest,
  GenerationResult,
  MigrationAction,
  MigrationRequest,
  MigrationEntry,
  DependencyInfo,
  DependencyCheckResult,
  VersionRecord,
  ProjectInitOptions,
} from './cli/CliTypes';

// Scaffold command
export { ScaffoldCommand } from './commands/ScaffoldCommand';

// Migration command
export { MigrationCommand } from './commands/MigrationCommand';

// Code generation templates
export { CodeTemplate } from './codegen/CodeTemplate';

// Project utilities
export { ProjectInitializer } from './project/ProjectInitializer';
export type { ProjectFile, ProjectInitResult } from './project/ProjectInitializer';
export { DependencyChecker } from './project/DependencyChecker';
export { VersionManager } from './project/VersionManager';
