/**
 * Shared types for @acme/cli (Item 53).
 */

/** Supported DDD artefact kinds for the scaffold command. */
export type ArtifactKind =
  | 'entity'
  | 'aggregate'
  | 'use-case'
  | 'repository'
  | 'event'
  | 'value-object'
  | 'service';

/** A parsed scaffold instruction. */
export interface ScaffoldRequest {
  kind: ArtifactKind;
  name: string;
  outputDir?: string;
}

/** Result of a scaffold or codegen operation. */
export interface GenerationResult {
  success: boolean;
  filePath: string;
  content: string;
  error?: string;
}

/** Supported migration operations. */
export type MigrationAction = 'create' | 'up' | 'down' | 'status';

/** A parsed migration instruction. */
export interface MigrationRequest {
  action: MigrationAction;
  name?: string;
  steps?: number;
}

/** A migration entry in the registry. */
export interface MigrationEntry {
  name: string;
  appliedAt?: Date;
  status: 'pending' | 'applied' | 'reverted';
}

/** Information about an installed dependency. */
export interface DependencyInfo {
  name: string;
  installedVersion: string;
  requiredVersion: string;
  compatible: boolean;
}

/** Result of a dependency compatibility check. */
export interface DependencyCheckResult {
  compatible: boolean;
  checked: number;
  incompatible: DependencyInfo[];
}

/** Installed version record for the version manager. */
export interface VersionRecord {
  package: string;
  version: string;
  latest?: string;
  outdated: boolean;
}

/** Options for project initialisation. */
export interface ProjectInitOptions {
  name: string;
  description?: string;
  author?: string;
  license?: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn';
}
