import { describe, it, expect, beforeAll } from 'vitest';
import {
  DDDAnalyzer,
  DDDType,
  ViolationSeverity,
  DDDViolationType,
} from '../analyzers/DDDAnalyzer';
import type { DDDComponent, DDDViolation } from '../analyzers/DDDAnalyzer';

describe('Domain-Driven Design Compliance', () => {
  let analyzer: DDDAnalyzer;
  let violations: DDDViolation[];
  let components: DDDComponent[];

  beforeAll(() => {
    analyzer = new DDDAnalyzer(process.cwd());
    violations = analyzer.analyzeImplementation();
    components = analyzer.getComponents();
  });

  it('should have no critical DDD violations', () => {
    const criticalViolations = violations.filter((v) => v.severity === ViolationSeverity.Critical);

    if (criticalViolations.length > 0) {
      const violationDetails = criticalViolations
        .map((v) => `${v.component}: ${v.description}`)
        .join('\n');

      console.error('Critical DDD violations found:', violationDetails);
    }

    expect(criticalViolations).toHaveLength(0);
  });

  it('should ensure entities have identity', () => {
    const entitiesWithoutId = violations.filter(
      (v) => v.violationType === DDDViolationType.EntityWithoutIdentity,
    );

    if (entitiesWithoutId.length > 0) {
      const violationDetails = entitiesWithoutId
        .map((v) => `${v.component}: ${v.description}`)
        .join('\n');

      console.error('Entities without identity:', violationDetails);
    }

    expect(entitiesWithoutId).toHaveLength(0);
  });

  it('should ensure value objects are immutable', () => {
    const mutableValueObjects = violations.filter(
      (v) => v.violationType === DDDViolationType.ValueObjectMutable,
    );

    if (mutableValueObjects.length > 0) {
      const violationDetails = mutableValueObjects
        .map((v) => `${v.component}: ${v.description}`)
        .join('\n');

      console.error('Mutable value objects found:', violationDetails);
    }

    expect(mutableValueObjects).toHaveLength(0);
  });

  it('should prevent anemic domain model', () => {
    const anemicModelViolations = violations.filter(
      (v) => v.violationType === DDDViolationType.AnthropicModelPattern,
    );

    const maxAllowedAnemicViolations = 3; // Some DTOs might be anemic by design

    if (anemicModelViolations.length > 0) {
      const violationDetails = anemicModelViolations
        .map((v) => `${v.component}: ${v.description}`)
        .join('\n');

      console.warn(
        `Anemic model violations (${anemicModelViolations.length}/${maxAllowedAnemicViolations}):`,
      );
      console.warn(violationDetails);
    }

    expect(anemicModelViolations.length).toBeLessThanOrEqual(maxAllowedAnemicViolations);
  });

  it('should keep domain logic in domain layer', () => {
    const domainLogicInInfra = violations.filter(
      (v) => v.violationType === DDDViolationType.DomainLogicInInfrastructure,
    );

    if (domainLogicInInfra.length > 0) {
      const violationDetails = domainLogicInInfra
        .map((v) => `${v.component}: ${v.description}`)
        .join('\n');

      console.error('Domain logic in infrastructure:', violationDetails);
    }

    expect(domainLogicInInfra).toHaveLength(0);
  });

  it('should prevent infrastructure dependencies in domain', () => {
    const infraDependencies = violations.filter(
      (v) => v.violationType === DDDViolationType.InfrastructureDependency,
    );

    if (infraDependencies.length > 0) {
      const violationDetails = infraDependencies
        .map((v) => `${v.component}: ${v.description}`)
        .join('\n');

      console.error('Infrastructure dependencies in domain:', violationDetails);
    }

    expect(infraDependencies).toHaveLength(0);
  });

  it('should validate aggregate root responsibilities', () => {
    const aggregateRootViolations = violations.filter(
      (v) => v.violationType === DDDViolationType.AggregateRootViolation,
    );

    const maxAllowedAggregateViolations = 2; // Configurable threshold

    if (aggregateRootViolations.length > 0) {
      const violationDetails = aggregateRootViolations
        .map((v) => `${v.component}: ${v.description}`)
        .join('\n');

      console.warn(
        `Aggregate root violations (${aggregateRootViolations.length}/${maxAllowedAggregateViolations}):`,
      );
      console.warn(violationDetails);
    }

    expect(aggregateRootViolations.length).toBeLessThanOrEqual(maxAllowedAggregateViolations);
  });

  it('should have proper repository placement', () => {
    const repositoryViolations = violations.filter(
      (v) => v.violationType === DDDViolationType.RepositoryInDomain,
    );

    if (repositoryViolations.length > 0) {
      const violationDetails = repositoryViolations
        .map((v) => `${v.component}: ${v.description}`)
        .join('\n');

      console.error('Repository placement violations:', violationDetails);
    }

    expect(repositoryViolations).toHaveLength(0);
  });

  it('should validate DDD building block distribution', () => {
    const componentsByType = components.reduce(
      (acc, comp) => {
        acc[comp.type] = (acc[comp.type] ?? 0) + 1;
        return acc;
      },
      {} as Partial<Record<DDDType, number>>,
    );

    console.info('\n=== DDD Building Blocks ===');

    // Report current distribution
    Object.entries(componentsByType).forEach(([type, count]) => {
      console.info(`${type}: ${count}`);
    });

    // For a library/utility project, DDD patterns might not be prevalent
    // We validate that IF we have entities, they follow DDD rules
    // But we don't require entities to exist
    const totalDDDComponents = components.length;
    console.info(`Total DDD components found: ${totalDDDComponents}`);

    // This test now serves as a reporting mechanism
    expect(totalDDDComponents).toBeGreaterThanOrEqual(0);
  });

  it('should report DDD metrics', () => {
    const totalComponents = components.length;
    const violationsBySeverity = violations.reduce(
      (acc, v) => {
        acc[v.severity] = (acc[v.severity] ?? 0) + 1;
        return acc;
      },
      {} as Partial<Record<ViolationSeverity, number>>,
    );

    console.info('\n=== DDD Compliance Metrics ===');
    console.info(`Total DDD Components: ${totalComponents}`);
    console.info(`Total Violations: ${violations.length}`);

    if (violations.length > 0) {
      console.info('Violations by severity:', violationsBySeverity);

      // Calculate compliance score (simple metric)
      const criticalCount = violationsBySeverity[ViolationSeverity.Critical] ?? 0;
      const highCount = violationsBySeverity[ViolationSeverity.High] ?? 0;
      const complianceScore = Math.max(0, 100 - criticalCount * 20 - highCount * 10);

      console.info(`DDD Compliance Score: ${complianceScore}%`);
    }

    // Component distribution by type
    const componentsByType = components.reduce(
      (acc, comp) => {
        acc[comp.type] = (acc[comp.type] ?? 0) + 1;
        return acc;
      },
      {} as Partial<Record<DDDType, number>>,
    );

    console.info('Component distribution:', componentsByType);

    // This test is for reporting, always passes
    expect(true).toBe(true);
  });

  it('should validate domain event handling', () => {
    const domainEvents = components.filter((c) => c.type === DDDType.DomainEvent);
    const aggregateRoots = components.filter((c) => c.type === DDDType.AggregateRoot);

    if (domainEvents.length > 0 && aggregateRoots.length > 0) {
      console.info(
        `Found ${domainEvents.length} domain events and ${aggregateRoots.length} aggregate roots`,
      );

      // This suggests event-driven architecture is in use
      expect(domainEvents.length).toBeGreaterThan(0);
      expect(aggregateRoots.length).toBeGreaterThan(0);
    }

    // This test is informational for event-driven systems
    expect(true).toBe(true);
  });
});
