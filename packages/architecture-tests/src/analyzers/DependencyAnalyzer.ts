import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Package JSON structure
 */
interface PackageJsonType {
  readonly name: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
}

/**
 * Package information
 */
export interface PackageInfo {
  readonly name: string;
  readonly path: string;
  readonly dependencies: string[];
  readonly devDependencies: string[];
  readonly peerDependencies: string[];
  readonly layer: ArchitectureLayer;
}

/**
 * Layer information for architecture reporting
 */
export interface Layer {
  readonly name: string;
  readonly components: LayerComponent[];
}

/**
 * Layer component information
 */
export interface LayerComponent {
  readonly name: string;
  readonly path: string;
  readonly dependencies: string[];
}

/**
 * Dependency violation with severity
 */
export interface LayerViolation {
  readonly sourceLayer: string;
  readonly targetLayer: string;
  readonly description: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
}

  /**
 * Violation severity levels
 */
export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Architecture layers according to Clean Architecture
 */
export enum ArchitectureLayer {
  Domain = 'domain',      // kernel package
  Application = 'application',  // application package
  Infrastructure = 'infrastructure'  // all other packages
}

/**
 * Dependency violation
 */
export interface DependencyViolation {
  readonly fromPackage: string;
  readonly toPackage: string;
  readonly fromLayer: ArchitectureLayer;
  readonly toLayer: ArchitectureLayer;
  readonly violationType: ViolationType;
  readonly description: string;
}

/**
 * Types of architecture violations
 */
export enum ViolationType {
  LayerViolation = 'layer-violation',
  CircularDependency = 'circular-dependency',
  UnauthorizedDependency = 'unauthorized-dependency'
}

/**
 * Analyzes package dependencies and architecture compliance
 */
export class DependencyAnalyzer {
  private readonly workspaceRoot: string;
  private readonly packages: Map<string, PackageInfo> = new Map();

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Load all packages from the workspace
   */
  loadPackages(): void {
    const packagesDir = path.join(this.workspaceRoot, 'packages');

    if (!fs.existsSync(packagesDir)) {
      throw new Error(`Packages directory not found: ${packagesDir}`);
    }

    const packageDirs = fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const packageDir of packageDirs) {
      const packagePath = path.join(packagesDir, packageDir);
      const packageJsonPath = path.join(packagePath, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        const packageJson: PackageJsonType = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJsonType;
        const packageInfo = this.createPackageInfo(packageJson, packagePath);
        this.packages.set(packageInfo.name, packageInfo);
      }
    }
  }

  /**
   * Get all loaded packages
   */
  getPackages(): PackageInfo[] {
    return Array.from(this.packages.values());
  }

  /**
   * Get package by name
   */
  getPackage(name: string): PackageInfo | undefined {
    return this.packages.get(name);
  }

  /**
   * Analyze architecture compliance
   */
  analyzeDependencies(): LayerViolation[] {
    const violations: LayerViolation[] = [];

    for (const packageInfo of this.packages.values()) {
      // Check layer violations
      violations.push(...this.checkLayerViolationsAsLayerViolations(packageInfo));
    }

    return violations;
  }

  /**
   * Check Clean Architecture layer violations and return as LayerViolations
   */
  private checkLayerViolationsAsLayerViolations(packageInfo: PackageInfo): LayerViolation[] {
    const violations: LayerViolation[] = [];

    for (const dependency of packageInfo.dependencies) {
      const depPackage = this.packages.get(dependency);
      if (!depPackage) continue;

      const isViolation = this.isLayerViolation(packageInfo.layer, depPackage.layer);

      if (isViolation) {
        const severity: ViolationSeverity = packageInfo.layer === ArchitectureLayer.Domain ? 'critical' : 'high';

        violations.push({
          sourceLayer: this.getLayerDisplayName(packageInfo.layer),
          targetLayer: this.getLayerDisplayName(depPackage.layer),
          description: `${this.getLayerDisplayName(packageInfo.layer)} layer cannot depend on ${this.getLayerDisplayName(depPackage.layer)} layer`,
          severity
        });
      }
    }

    return violations;
  }

  /**
   * Get display name for layer
   */
  private getLayerDisplayName(layer: ArchitectureLayer): string {
    switch (layer) {
      case ArchitectureLayer.Domain:
        return 'Domain';
      case ArchitectureLayer.Application:
        return 'Application';
      case ArchitectureLayer.Infrastructure:
        return 'Infrastructure';
      default:
        return 'Unknown';
    }
  }

  /**
   * Create package info from package.json
   */
  private createPackageInfo(packageJson: PackageJsonType, packagePath: string): PackageInfo {
    const name = packageJson.name;
    const dependencies = Object.keys(packageJson.dependencies ?? {});
    const devDependencies = Object.keys(packageJson.devDependencies ?? {});
    const peerDependencies = Object.keys(packageJson.peerDependencies ?? {});

    const layer = this.determineLayer(name);

    return {
      name,
      path: packagePath,
      dependencies,
      devDependencies,
      peerDependencies,
      layer
    };
  }

  /**
   * Determine architecture layer based on package name
   */
  private determineLayer(packageName: string): ArchitectureLayer {
    if (packageName.includes('kernel')) {
      return ArchitectureLayer.Domain;
    }

    if (packageName.includes('application')) {
      return ArchitectureLayer.Application;
    }

    return ArchitectureLayer.Infrastructure;
  }

  /**
   * Check if dependency violates layer rules
   */
  private isLayerViolation(fromLayer: ArchitectureLayer, toLayer: ArchitectureLayer): boolean {
    // Domain layer cannot depend on anything except itself
    if (fromLayer === ArchitectureLayer.Domain && toLayer !== ArchitectureLayer.Domain) {
      return true;
    }

    // Application layer cannot depend on infrastructure layer
    if (fromLayer === ArchitectureLayer.Application && toLayer === ArchitectureLayer.Infrastructure) {
      return true;
    }

    return false;
  }

  /**
   * Find actual cycle path for circular dependency reporting
   */
  private findCyclePath(startPackage: string): string[] {
    const cyclePath: string[] = [];
    const visited = new Set<string>();

    const dfs = (packageName: string): boolean => {
      if (cyclePath.includes(packageName)) {
        // Found cycle, return path from cycle start
        return true;
      }

      if (visited.has(packageName)) {
        return false;
      }

      cyclePath.push(packageName);
      visited.add(packageName);

      const pkg = this.packages.get(packageName);
      if (pkg) {
        for (const dep of pkg.dependencies) {
          if (this.packages.has(dep) && dfs(dep)) {
            return true;
          }
        }
      }

      cyclePath.pop();
      return false;
    };

    dfs(startPackage);
    return cyclePath;
  }

  /**
   * Get layers with their components for architecture reporting
   */
  getLayers(): Layer[] {
    const layers: Layer[] = [
      { name: 'Domain', components: [] },
      { name: 'Application', components: [] },
      { name: 'Infrastructure', components: [] }
    ];

    for (const pkg of this.packages.values()) {
      const component: LayerComponent = {
        name: pkg.name,
        path: pkg.path,
        dependencies: pkg.dependencies
      };

      switch (pkg.layer) {
        case ArchitectureLayer.Domain:
          layers[0]?.components.push(component);
          break;
        case ArchitectureLayer.Application:
          layers[1]?.components.push(component);
          break;
        case ArchitectureLayer.Infrastructure:
          layers[2]?.components.push(component);
          break;
      }
    }

    return layers;
  }

  /**
   * Detect circular dependencies between packages
   */
  detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();

    for (const packageName of this.packages.keys()) {
      if (!visited.has(packageName)) {
        const cycle = this.findCyclePath(packageName);
        if (cycle.length > 1) {
          const firstElement = cycle[0];
          if (firstElement !== undefined) {
            cycles.push([...cycle, firstElement]); // Close the cycle
          }
        }
        visited.add(packageName);
      }
    }

    return cycles;
  }
}
