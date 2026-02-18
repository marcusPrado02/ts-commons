import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * DDD component information
 */
export interface DDDComponent {
  readonly name: string;
  readonly type: DDDType;
  readonly filePath: string;
  readonly violations: DDDViolation[];
}

/**
 * DDD component types
 */
export enum DDDType {
  Entity = 'entity',
  ValueObject = 'value-object',
  AggregateRoot = 'aggregate-root',
  DomainEvent = 'domain-event',
  DomainService = 'domain-service',
  Repository = 'repository',
  Factory = 'factory',
  Specification = 'specification'
}

/**
 * DDD architecture violations
 */
export interface DDDViolation {
  readonly component: string;
  readonly violationType: DDDViolationType;
  readonly description: string;
  readonly suggestion: string;
  readonly severity: ViolationSeverity;
}

/**
 * Types of DDD violations
 */
export enum DDDViolationType {
  EntityWithoutIdentity = 'entity-without-identity',
  ValueObjectMutable = 'value-object-mutable',
  AggregateRootViolation = 'aggregate-root-violation',
  DomainLogicInInfrastructure = 'domain-logic-in-infrastructure',
  AnthropicModelPattern = 'anemic-domain-model',
  RepositoryInDomain = 'repository-in-domain',
  InfrastructureDependency = 'infrastructure-dependency'
}

/**
 * Violation severity levels
 */
export enum ViolationSeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical'
}

/**
 * Analyzes Domain-Driven Design implementation compliance
 */
export class DDDAnalyzer {
  private readonly workspaceRoot: string;
  private readonly components: Map<string, DDDComponent> = new Map();

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Analyze DDD implementation across all packages
   */
  analyzeImplementation(): DDDViolation[] {
    this.loadDDDComponents();
    return this.validateDDDRules();
  }

  /**
   * Get all DDD components
   */
  getComponents(): DDDComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Load DDD components from source files
   */
  private loadDDDComponents(): void {
    // Look for packages directory in workspace root (parent of parent directory)
    const packagesDir = path.resolve(this.workspaceRoot, '../../packages');

    if (!fs.existsSync(packagesDir)) {
      console.warn(`Packages directory not found at: ${packagesDir}. Trying relative path...`);

      // Fallback to relative path from current working directory
      const fallbackPackagesDir = path.join(process.cwd(), 'packages');
      if (!fs.existsSync(fallbackPackagesDir)) {
        console.warn(`No packages directory found. Skipping DDD analysis.`);
        return;
      }

      this.loadPackagesFromDirectory(fallbackPackagesDir);
      return;
    }

    this.loadPackagesFromDirectory(packagesDir);
  }

  /**
   * Load packages from specified directory
   */
  private loadPackagesFromDirectory(packagesDir: string): void {
    const packageDirs = fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const packageDir of packageDirs) {
      const packagePath = path.join(packagesDir, packageDir);
      this.loadPackageComponents(packagePath);
    }
  }

  /**
   * Load DDD components from a specific package
   */
  private loadPackageComponents(packagePath: string): void {
    const srcPath = path.join(packagePath, 'src');

    if (!fs.existsSync(srcPath)) {
      return;
    }

    this.scanDirectory(srcPath);
  }

  /**
   * Recursively scan directory for DDD components
   */
  private scanDirectory(dirPath: string): void {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        this.scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        this.analyzeSourceFile(fullPath);
      }
    }
  }

  /**
   * Analyze TypeScript source file for DDD patterns
   */
  private analyzeSourceFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const components = this.extractDDDComponents(filePath, content);

      for (const component of components) {
        this.components.set(component.name, component);
      }
    } catch (error) {
      // Skip files that can't be read or parsed
      console.warn(`Could not analyze file ${filePath}: ${error}`);
    }
  }

  /**
   * Extract DDD components from source code content
   */
  private extractDDDComponents(filePath: string, content: string): DDDComponent[] {
    const components: DDDComponent[] = [];

    // Extract class declarations
    const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[\w\s,<>]+)?\s*{/g;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const extendsClass = match[2];
      const type = this.determineDDDType(className, extendsClass, content);

      if (type) {
        const violations = this.validateComponent(className, type, content, filePath);

        components.push({
          name: className,
          type,
          filePath,
          violations
        });
      }
    }

    return components;
  }

  /**
   * Determine DDD type based on naming conventions and inheritance
   */
  private determineDDDType(name: string, extendsClass: string | undefined, content: string): DDDType | null {
    const nameUpper = name.toUpperCase();

    // Check inheritance patterns first
    if (extendsClass) {
      switch (extendsClass) {
        case 'Entity':
          return DDDType.Entity;
        case 'ValueObject':
          return DDDType.ValueObject;
        case 'AggregateRoot':
          return DDDType.AggregateRoot;
        case 'DomainEvent':
          return DDDType.DomainEvent;
        case 'Repository':
          return DDDType.Repository;
      }
    }

    // Check naming conventions
    if (nameUpper.includes('REPOSITORY')) {
      return DDDType.Repository;
    }

    if (nameUpper.includes('FACTORY')) {
      return DDDType.Factory;
    }

    if (nameUpper.includes('SPECIFICATION')) {
      return DDDType.Specification;
    }

    if (nameUpper.includes('SERVICE') && this.isDomainLayer(content)) {
      return DDDType.DomainService;
    }

    // Check interface implementations
    if (content.includes('implements DomainEvent')) {
      return DDDType.DomainEvent;
    }

    return null;
  }

  /**
   * Check if code belongs to domain layer
   */
  private isDomainLayer(content: string): boolean {
    return content.includes('@acme/kernel') ||
           content.includes('from \'../kernel\'') ||
           content.includes('from \'./kernel\'');
  }

  /**
   * Validate DDD component against rules
   */
  private validateComponent(name: string, type: DDDType, content: string, filePath: string): DDDViolation[] {
    const violations: DDDViolation[] = [];

    switch (type) {
      case DDDType.Entity:
        violations.push(...this.validateEntity(name, content));
        break;
      case DDDType.ValueObject:
        violations.push(...this.validateValueObject(name, content));
        break;
      case DDDType.AggregateRoot:
        violations.push(...this.validateAggregateRoot(name, content));
        break;
      case DDDType.DomainEvent:
        violations.push(...this.validateDomainEvent(name, content));
        break;
      case DDDType.DomainService:
        violations.push(...this.validateDomainService(name, content));
        break;
      case DDDType.Repository:
        violations.push(...this.validateRepository(name, content, filePath));
        break;
      case DDDType.Factory:
        violations.push(...this.validateFactory(name, content));
        break;
      case DDDType.Specification:
        violations.push(...this.validateSpecification(name, content));
        break;
    }

    // General DDD validations
    violations.push(...this.validateInfrastructureDependencies(name, content, filePath));

    return violations;
  }

  /**
   * Validate Entity implementation
   */
  private validateEntity(name: string, content: string): DDDViolation[] {
    const violations: DDDViolation[] = [];

    // Entities must have identity (id property)
    const hasIdentity = /(?:readonly\s+)?id\s*[:=]/i.test(content) ||
                       /getId\s*\(\s*\)/i.test(content);

    if (!hasIdentity) {
      violations.push({
        component: name,
        violationType: DDDViolationType.EntityWithoutIdentity,
        description: 'Entity must have identity (id property)',
        suggestion: 'Add readonly id property with appropriate Identifier type',
        severity: ViolationSeverity.High
      });
    }

    // Check for anemic domain model (only getters/setters, no business logic)
    const methodCount = (content.match(/\s+(public|private|protected)?\s*\w+\s*\(/g) || []).length;
    const getterSetterCount = (content.match(/\s+(get|set)\s+\w+/g) || []).length;

    if (methodCount > 0 && getterSetterCount / methodCount > 0.8) {
      violations.push({
        component: name,
        violationType: DDDViolationType.AnthropicModelPattern,
        description: 'Entity appears to be anemic (mostly getters/setters)',
        suggestion: 'Add business logic methods to make entity rich',
        severity: ViolationSeverity.Medium
      });
    }

    return violations;
  }

  /**
   * Validate ValueObject implementation
   */
  private validateValueObject(name: string, content: string): DDDViolation[] {
    const violations: DDDViolation[] = [];

    // Value objects should be immutable (readonly properties, no setters)
    const hasSetters = /\s+set\s+\w+/i.test(content);
    const hasMutableProperties = /(?:public|private)\s+(?!readonly)\w+\s*[:=]/i.test(content);

    if (hasSetters || hasMutableProperties) {
      violations.push({
        component: name,
        violationType: DDDViolationType.ValueObjectMutable,
        description: 'ValueObject should be immutable',
        suggestion: 'Make all properties readonly and remove setters',
        severity: ViolationSeverity.High
      });
    }

    return violations;
  }

  /**
   * Validate AggregateRoot implementation
   */
  private validateAggregateRoot(name: string, content: string): DDDViolation[] {
    const violations: DDDViolation[] = [];

    // Aggregate roots should handle domain events
    const handlesDomainEvents = content.includes('DomainEvent') ||
                               content.includes('recordEvent') ||
                               content.includes('getUncommittedEvents');

    if (!handlesDomainEvents) {
      violations.push({
        component: name,
        violationType: DDDViolationType.AggregateRootViolation,
        description: 'AggregateRoot should handle domain events',
        suggestion: 'Add domain event recording and retrieval capabilities',
        severity: ViolationSeverity.Medium
      });
    }

    return violations;
  }

  /**
   * Validate DomainEvent implementation
   */
  private validateDomainEvent(name: string, content: string): DDDViolation[] {
    const violations: DDDViolation[] = [];

    // Domain events should be immutable and have timestamp
    const hasTimestamp = /(?:occurredAt|timestamp|when)\s*[:=]/i.test(content);

    if (!hasTimestamp) {
      violations.push({
        component: name,
        violationType: DDDViolationType.DomainLogicInInfrastructure,
        description: 'DomainEvent should have occurrence timestamp',
        suggestion: 'Add occurredAt or timestamp property',
        severity: ViolationSeverity.Low
      });
    }

    return violations;
  }

  /**
   * Validate DomainService implementation
   */
  private validateDomainService(name: string, content: string): DDDViolation[] {
    const violations: DDDViolation[] = [];

    // Domain services should contain domain logic, not infrastructure concerns
    const hasInfrastructureConcerns = /\.(http|database|file|email)/i.test(content) ||
                                     content.includes('fetch(') ||
                                     content.includes('axios');

    if (hasInfrastructureConcerns) {
      violations.push({
        component: name,
        violationType: DDDViolationType.DomainLogicInInfrastructure,
        description: 'DomainService should not contain infrastructure concerns',
        suggestion: 'Move infrastructure logic to application or infrastructure layer',
        severity: ViolationSeverity.High
      });
    }

    return violations;
  }

  /**
   * Validate Repository implementation
   */
  private validateRepository(name: string, content: string, filePath: string): DDDViolation[] {
    const violations: DDDViolation[] = [];

    // Repository interfaces should be in domain, implementations in infrastructure
    const isInterface = content.includes('interface ') || content.includes('abstract class');
    const isDomainLayer = filePath.includes('kernel') || filePath.includes('domain');
    const isInfrastructureLayer = !isDomainLayer;

    if (!isInterface && isDomainLayer) {
      violations.push({
        component: name,
        violationType: DDDViolationType.RepositoryInDomain,
        description: 'Repository implementation should not be in domain layer',
        suggestion: 'Move concrete repository to infrastructure layer',
        severity: ViolationSeverity.High
      });
    }

    if (isInterface && isInfrastructureLayer) {
      violations.push({
        component: name,
        violationType: DDDViolationType.RepositoryInDomain,
        description: 'Repository interface should be in domain layer',
        suggestion: 'Move repository interface to domain layer',
        severity: ViolationSeverity.Medium
      });
    }

    return violations;
  }

  /**
   * Validate Factory implementation
   */
  private validateFactory(name: string, content: string): DDDViolation[] {
    const violations: DDDViolation[] = [];

    // Factories should create domain objects
    const createsObjects = content.includes('new ') &&
                          (content.includes('return ') || content.includes('Result.ok'));

    if (!createsObjects) {
      violations.push({
        component: name,
        violationType: DDDViolationType.AnthropicModelPattern,
        description: 'Factory should create and return domain objects',
        suggestion: 'Add object creation logic with proper validation',
        severity: ViolationSeverity.Low
      });
    }

    return violations;
  }

  /**
   * Validate Specification implementation
   */
  private validateSpecification(name: string, content: string): DDDViolation[] {
    const violations: DDDViolation[] = [];

    // Specifications should implement business rules
    const hasBusinessLogic = content.includes('isSatisfiedBy') ||
                            content.includes('and(') ||
                            content.includes('or(') ||
                            content.includes('not(');

    if (!hasBusinessLogic) {
      violations.push({
        component: name,
        violationType: DDDViolationType.AnthropicModelPattern,
        description: 'Specification should implement business rule evaluation',
        suggestion: 'Add isSatisfiedBy method and composition operators',
        severity: ViolationSeverity.Medium
      });
    }

    return violations;
  }

  /**
   * Validate infrastructure dependencies
   */
  private validateInfrastructureDependencies(name: string, content: string, filePath: string): DDDViolation[] {
    const violations: DDDViolation[] = [];

    // Domain layer should not depend on infrastructure
    const isDomainLayer = filePath.includes('kernel') || filePath.includes('domain');

    if (isDomainLayer) {
      const hasInfraDependencies = content.includes('axios') ||
                                  content.includes('express') ||
                                  content.includes('mongoose') ||
                                  content.includes('typeorm') ||
                                  content.includes('prisma') ||
                                  /import.*from\s+['"](?!@acme\/kernel)/g.test(content);

      if (hasInfraDependencies) {
        violations.push({
          component: name,
          violationType: DDDViolationType.InfrastructureDependency,
          description: 'Domain layer component has infrastructure dependencies',
          suggestion: 'Remove infrastructure dependencies or move to appropriate layer',
          severity: ViolationSeverity.Critical
        });
      }
    }

    return violations;
  }

  /**
   * Validate all DDD rules across components
   */
  private validateDDDRules(): DDDViolation[] {
    const allViolations: DDDViolation[] = [];

    // Collect all violations from individual components
    for (const component of this.components.values()) {
      allViolations.push(...component.violations);
    }

    return allViolations;
  }
}
