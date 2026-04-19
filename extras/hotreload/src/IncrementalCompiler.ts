import type { CompileResult, DependencyNode } from './WatchTypes';

function now(): number {
  return Date.now();
}

function buildDependents(graph: Map<string, DependencyNode>): void {
  for (const [file, node] of graph) {
    for (const imp of node.imports) {
      const dep = graph.get(imp);
      if (dep !== undefined && !dep.dependents.includes(file)) {
        (dep.dependents as string[]).push(file);
      }
    }
  }
}

function collectAffected(
  dirty: readonly string[],
  graph: Map<string, DependencyNode>,
): Set<string> {
  const affected = new Set<string>(dirty);
  const queue = [...dirty];
  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined) break;
    const node = graph.get(file);
    if (node === undefined) continue;
    for (const dep of node.dependents) {
      if (!affected.has(dep)) {
        affected.add(dep);
        queue.push(dep);
      }
    }
  }
  return affected;
}

export class IncrementalCompiler {
  private readonly graph = new Map<string, DependencyNode>();
  private readonly outputCache = new Map<string, string>();
  private readonly dirtyFiles = new Set<string>();

  /** Register or update a file with its import list. */
  register(file: string, imports: readonly string[]): void {
    this.graph.set(file, { file, imports, dependents: [] });
    buildDependents(this.graph);
  }

  /** Mark a file as changed, propagating to all dependents. */
  markDirty(file: string): void {
    const affected = collectAffected([file], this.graph);
    for (const f of affected) {
      this.dirtyFiles.add(f);
    }
  }

  /** Simulate compilation of all dirty files; returns a CompileResult. */
  compile(simulatedErrors: readonly string[] = []): CompileResult {
    const start = now();
    const changedFiles = [...this.dirtyFiles];
    const recompiledFiles: string[] = [];

    for (const file of changedFiles) {
      if (simulatedErrors.includes(file)) continue;
      this.outputCache.set(file, `compiled:${file}`);
      recompiledFiles.push(file);
    }
    this.dirtyFiles.clear();

    return {
      changedFiles,
      recompiledFiles,
      durationMs: now() - start,
      errors: simulatedErrors.filter((e) => changedFiles.includes(e)),
      success: simulatedErrors.length === 0,
    };
  }

  /** Whether the given file has been compiled at least once. */
  isCompiled(file: string): boolean {
    return this.outputCache.has(file);
  }

  /** How many registered files exist. */
  fileCount(): number {
    return this.graph.size;
  }

  /** How many files are currently dirty. */
  dirtyCount(): number {
    return this.dirtyFiles.size;
  }

  /** Retrieve the cached output for a file. */
  cachedOutput(file: string): string | undefined {
    return this.outputCache.get(file);
  }

  /** Return the dependency node for a file. */
  nodeFor(file: string): DependencyNode | undefined {
    return this.graph.get(file);
  }

  /** Clear everything — full recompile on next run. */
  invalidateAll(): void {
    this.dirtyFiles.clear();
    this.outputCache.clear();
    for (const file of this.graph.keys()) {
      this.dirtyFiles.add(file);
    }
  }
}
