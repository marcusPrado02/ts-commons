import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * CQRS component information
 */
export interface CQRSComponent {
  readonly name: string;
  readonly type: CQRSType;
  readonly filePath: string;
  readonly dependencies: string[];
  readonly violations: CQRSViolation[];
}

/**
 * CQRS component types
 */
export enum CQRSType {
  Command = 'command',
  CommandHandler = 'command-handler',
  Query = 'query',
  QueryHandler = 'query-handler',
  CommandBus = 'command-bus',
  QueryBus = 'query-bus'
}

/**
 * CQRS architecture violations
 */
export interface CQRSViolation {
  readonly component: string;
  readonly violationType: CQRSViolationType;
  readonly description: string;
  readonly suggestion: string;
}

/**
 * Types of CQRS violations
 */
export enum CQRSViolationType {
  CommandReturnsData = 'command-returns-data',
  QueryModifiesState = 'query-modifies-state',
  CommandQueryMixing = 'command-query-mixing',
  HandlerViolation = 'handler-violation',
  BusViolation = 'bus-violation'
}

/**
 * Analyzes CQRS implementation compliance
 */
export class CQRSAnalyzer {
  private readonly workspaceRoot: string;
  private readonly components: Map<string, CQRSComponent> = new Map();

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Analyze CQRS implementation across all packages
   */
  async analyzeImplementation(): Promise<CQRSViolation[]> {
    await this.loadCQRSComponents();
    return this.validateCQRSRules();
  }

  /**
   * Get all CQRS components
   */
  getComponents(): CQRSComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Load CQRS components from source files
   */
  private async loadCQRSComponents(): Promise<void> {
    // Look for packages directory in workspace root (parent of parent directory)
    const packagesDir = path.resolve(this.workspaceRoot, '../../packages');

    if (!fs.existsSync(packagesDir)) {
      // Packages directory not found, trying relative path

      // Fallback to relative path from current working directory
      const fallbackPackagesDir = path.join(process.cwd(), 'packages');
      if (!fs.existsSync(fallbackPackagesDir)) {
        // No packages directory found, skipping CQRS analysis
        return;
      }

      await this.loadPackagesFromDirectory(fallbackPackagesDir);
      return;
    }

    await this.loadPackagesFromDirectory(packagesDir);
  }

  /**
   * Load packages from specified directory
   */
  private async loadPackagesFromDirectory(packagesDir: string): Promise<void> {
    const packageDirs = fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const packageDir of packageDirs) {
      const packagePath = path.join(packagesDir, packageDir);
      await this.loadPackageComponents(packagePath);
    }
  }

  /**
   * Load CQRS components from a specific package
   */
  private async loadPackageComponents(packagePath: string): Promise<void> {
    const srcPath = path.join(packagePath, 'src');

    if (!fs.existsSync(srcPath)) {
      return;
    }

    await this.scanDirectory(srcPath);
  }

  /**
   * Recursively scan directory for CQRS components
   */
  private async scanDirectory(dirPath: string): Promise<void> {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        this.analyzeSourceFile(fullPath);
      }
    }
  }

  /**
   * Analyze TypeScript source file for CQRS patterns
   */
  private analyzeSourceFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const components = this.extractCQRSComponents(filePath, content);

      for (const component of components) {
        this.components.set(component.name, component);
      }
    } catch (error) {
      // Skip files that can't be read or parsed - this is expected for some files
      // Error details: files may be binary, invalid syntax, or permission issues
    }
  }

  /**
   * Extract CQRS components from source code content
   */
  private extractCQRSComponents(filePath: string, content: string): CQRSComponent[] {
    const components: CQRSComponent[] = [];

    // Extract class and interface declarations
    const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w\s,<>]+)?\s*{/g;
    const interfaceRegex = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w\s,<>]+)?\s*{/g;

    let match;

    // Analyze classes
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      if (!className) continue;

      const type = this.determineCQRSType(className, content);

      if (type !== null) {
        const dependencies = this.extractDependencies(content);
        const violations = this.validateComponent(className, type, content);

        components.push({
          name: className,
          type,
          filePath,
          dependencies,
          violations
        });
      }
    }

    // Analyze interfaces
    while ((match = interfaceRegex.exec(content)) !== null) {
      const interfaceName = match[1];
      if (!interfaceName) continue;

      const type = this.determineCQRSType(interfaceName, content);

      if (type !== null) {
        const dependencies = this.extractDependencies(content);
        const violations = this.validateComponent(interfaceName, type, content);

        components.push({
          name: interfaceName,
          type,
          filePath,
          dependencies,
          violations
        });
      }
    }

    return components;
  }

  /**
   * Determine CQRS type based on naming conventions and content
   */
  private determineCQRSType(name: string, content: string): CQRSType | null {
    const nameUpper = name.toUpperCase();

    if (nameUpper.includes('COMMAND') && nameUpper.includes('HANDLER')) {
      return CQRSType.CommandHandler;
    }

    if (nameUpper.includes('QUERY') && nameUpper.includes('HANDLER')) {
      return CQRSType.QueryHandler;
    }

    if (nameUpper.includes('COMMANDBUS')) {
      return CQRSType.CommandBus;
    }

    if (nameUpper.includes('QUERYBUS')) {
      return CQRSType.QueryBus;
    }

    if (nameUpper.includes('COMMAND')) {
      // Check if it implements Command interface
      const implementsCommand = content.includes('implements Command') ||
                               content.includes('extends BaseCommand');
      return implementsCommand ? CQRSType.Command : null;
    }

    if (nameUpper.includes('QUERY')) {
      // Check if it implements Query interface
      const implementsQuery = content.includes('implements Query') ||
                             content.includes('extends BaseQuery');
      return implementsQuery ? CQRSType.Query : null;
    }

    return null;
  }

  /**
   * Extract dependencies from source code
   */
  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"];?/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath !== undefined && importPath.startsWith('@acme/')) {
        dependencies.push(importPath);
      }
    }

    return dependencies;
  }

  /**
   * Validate CQRS component against rules
   */
  private validateComponent(name: string, type: CQRSType, content: string): CQRSViolation[] {
    const violations: CQRSViolation[] = [];

    switch (type) {
      case CQRSType.Command:
        violations.push(...this.validateCommand(name, content));
        break;
      case CQRSType.CommandHandler:
        violations.push(...this.validateCommandHandler(name, content));
        break;
      case CQRSType.Query:
        violations.push(...this.validateQuery(name, content));
        break;
      case CQRSType.QueryHandler:
        violations.push(...this.validateQueryHandler(name, content));
        break;
      case CQRSType.CommandBus:
        violations.push(...this.validateCommandBus(name, content));
        break;
      case CQRSType.QueryBus:
        violations.push(...this.validateQueryBus(name, content));
        break;
    }

    return violations;
  }

  /**
   * Validate Command implementation
   */
  private validateCommand(name: string, content: string): CQRSViolation[] {
    const violations: CQRSViolation[] = [];

    // Commands should not return data (void or simple acknowledgment)
    const hasDataReturn = content.includes('Promise<') &&
                         !content.includes('Promise<void>') &&
                         !content.includes('Promise<Result<void');

    if (hasDataReturn) {
      violations.push({
        component: name,
        violationType: CQRSViolationType.CommandReturnsData,
        description: 'Command appears to return data instead of void/acknowledgment',
        suggestion: 'Commands should return void or simple acknowledgment, not data'
      });
    }

    return violations;
  }

  /**
   * Validate CommandHandler implementation
   */
  private validateCommandHandler(name: string, content: string): CQRSViolation[] {
    const violations: CQRSViolation[] = [];

    // Command handlers should implement CommandHandler interface
    const implementsInterface = content.includes('implements CommandHandler') ||
                               content.includes(': CommandHandler');

    if (!implementsInterface) {
      violations.push({
        component: name,
        violationType: CQRSViolationType.HandlerViolation,
        description: 'CommandHandler should implement CommandHandler interface',
        suggestion: 'Implement CommandHandler<TCommand, TResult, TError> interface'
      });
    }

    return violations;
  }

  /**
   * Validate Query implementation
   */
  private validateQuery(name: string, content: string): CQRSViolation[] {
    const violations: CQRSViolation[] = [];

    // Queries should not modify state (no save, update, delete operations)
    const hasStateModification = /\.(save|update|delete|create|insert)\s*\(/i.test(content);

    if (hasStateModification) {
      violations.push({
        component: name,
        violationType: CQRSViolationType.QueryModifiesState,
        description: 'Query appears to modify state',
        suggestion: 'Queries should only read data, not modify state'
      });
    }

    return violations;
  }

  /**
   * Validate QueryHandler implementation
   */
  private validateQueryHandler(name: string, content: string): CQRSViolation[] {
    const violations: CQRSViolation[] = [];

    // Query handlers should implement QueryHandler interface
    const implementsInterface = content.includes('implements QueryHandler') ||
                               content.includes(': QueryHandler');

    if (!implementsInterface) {
      violations.push({
        component: name,
        violationType: CQRSViolationType.HandlerViolation,
        description: 'QueryHandler should implement QueryHandler interface',
        suggestion: 'Implement QueryHandler<TQuery, TResult, TError> interface'
      });
    }

    return violations;
  }

  /**
   * Validate CommandBus implementation
   */
  private validateCommandBus(name: string, content: string): CQRSViolation[] {
    const violations: CQRSViolation[] = [];

    // Command bus should only handle commands
    const hasQueryHandling = content.includes('QueryHandler') ||
                            content.includes('query') ||
                            content.includes('Query');

    if (hasQueryHandling) {
      violations.push({
        component: name,
        violationType: CQRSViolationType.BusViolation,
        description: 'CommandBus should not handle queries',
        suggestion: 'Separate command and query handling into different buses'
      });
    }

    return violations;
  }

  /**
   * Validate QueryBus implementation
   */
  private validateQueryBus(name: string, content: string): CQRSViolation[] {
    const violations: CQRSViolation[] = [];

    // Query bus should only handle queries
    const hasCommandHandling = content.includes('CommandHandler') ||
                              content.includes('command') ||
                              content.includes('Command');

    if (hasCommandHandling) {
      violations.push({
        component: name,
        violationType: CQRSViolationType.BusViolation,
        description: 'QueryBus should not handle commands',
        suggestion: 'Separate command and query handling into different buses'
      });
    }

    return violations;
  }

  /**
   * Validate all CQRS rules across components
   */
  private validateCQRSRules(): CQRSViolation[] {
    const allViolations: CQRSViolation[] = [];

    // Collect all violations from individual components
    for (const component of this.components.values()) {
      allViolations.push(...component.violations);
    }

    // Add cross-component validations
    allViolations.push(...this.validateSeparationOfConcerns());

    return allViolations;
  }

  /**
   * Validate separation of concerns across components
   */
  private validateSeparationOfConcerns(): CQRSViolation[] {
    const violations: CQRSViolation[] = [];

    // Check for components that mix command and query responsibilities
    for (const component of this.components.values()) {
      const isCommand = component.type === CQRSType.Command ||
                       component.type === CQRSType.CommandHandler;
      const isQuery = component.type === CQRSType.Query ||
                     component.type === CQRSType.QueryHandler;

      if (isCommand && isQuery) {
        violations.push({
          component: component.name,
          violationType: CQRSViolationType.CommandQueryMixing,
          description: 'Component mixes command and query responsibilities',
          suggestion: 'Split into separate command and query components'
        });
      }
    }

    return violations;
  }

  /**
   * Get all commands identified in the codebase
   */
  getCommands(): CQRSComponent[] {
    return Array.from(this.components.values())
      .filter(component => component.type === CQRSType.Command);
  }

  /**
   * Get all queries identified in the codebase
   */
  getQueries(): CQRSComponent[] {
    return Array.from(this.components.values())
      .filter(component => component.type === CQRSType.Query);
  }

  /**
   * Get all command handlers identified in the codebase
   */
  getCommandHandlers(): CQRSComponent[] {
    return Array.from(this.components.values())
      .filter(component => component.type === CQRSType.CommandHandler);
  }

  /**
   * Get all query handlers identified in the codebase
   */
  getQueryHandlers(): CQRSComponent[] {
    return Array.from(this.components.values())
      .filter(component => component.type === CQRSType.QueryHandler);
  }

  /**
   * Get all events identified in the codebase
   */
  getEvents(): CQRSComponent[] {
    return Array.from(this.components.values())
      .filter(component => component.type === CQRSType.Event);
  }

}
