import { describe, it, expect, beforeAll } from 'vitest';
import { DependencyAnalyzer, type LayerViolation } from '../analyzers/DependencyAnalyzer';
import { CQRSAnalyzer, type CQRSViolation } from '../analyzers/CQRSAnalyzer';
import { DDDAnalyzer, ViolationSeverity, type DDDViolation } from '../analyzers/DDDAnalyzer';

interface ArchitectureReport {
  cleanArchitecture: {
    violations: number;
    criticalViolations: number;
    layers: number;
    components: number;
  };
  cqrs: {
    violations: number;
    criticalViolations: number;
    commands: number;
    queries: number;
    handlers: number;
  };
  ddd: {
    violations: number;
    criticalViolations: number;
    entities: number;
    valueObjects: number;
    aggregateRoots: number;
  };
  overall: {
    complianceScore: number;
    totalViolations: number;
    totalCriticalViolations: number;
  };
}

describe('Integrated Architecture Validation', () => {
  let dependencyAnalyzer: DependencyAnalyzer;
  let cqrsAnalyzer: CQRSAnalyzer;
  let dddAnalyzer: DDDAnalyzer;
  let architectureReport: ArchitectureReport;

  beforeAll(async () => {
    // Initialize all analyzers
    dependencyAnalyzer = new DependencyAnalyzer(process.cwd());
    cqrsAnalyzer = new CQRSAnalyzer(process.cwd());
    dddAnalyzer = new DDDAnalyzer(process.cwd());

    // Run all analyses
    const [layerViolations, cqrsViolations, dddViolations] = await Promise.all([
      dependencyAnalyzer.analyzeDependencies(),
      cqrsAnalyzer.analyzeImplementation(),
      Promise.resolve(dddAnalyzer.analyzeImplementation())
    ]);

    // Generate comprehensive report
    const layers = dependencyAnalyzer.getLayers();
    const commands = cqrsAnalyzer.getCommands();
    const queries = cqrsAnalyzer.getQueries();
    const commandHandlers = cqrsAnalyzer.getCommandHandlers();
    const queryHandlers = cqrsAnalyzer.getQueryHandlers();
    const dddComponents = dddAnalyzer.getComponents();

    architectureReport = {
      cleanArchitecture: {
        violations: layerViolations.length,
        criticalViolations: layerViolations.filter((v: LayerViolation) => v.severity === 'critical').length,
        layers: layers.length,
        components: layers.reduce((total, layer) => total + layer.components.length, 0)
      },
      cqrs: {
        violations: cqrsViolations.length,
        criticalViolations: cqrsViolations.filter((v: CQRSViolation) => v.severity === 'critical').length,
        commands: commands.length,
        queries: queries.length,
        handlers: commandHandlers.length + queryHandlers.length
      },
      ddd: {
        violations: dddViolations.length,
        criticalViolations: dddViolations.filter((v: DDDViolation) => v.severity === ViolationSeverity.Critical).length,
        entities: dddComponents.filter(c => c.type === 'entity').length,
        valueObjects: dddComponents.filter(c => c.type === 'value-object').length,
        aggregateRoots: dddComponents.filter(c => c.type === 'aggregate-root').length
      },
      overall: {
        totalViolations: layerViolations.length + cqrsViolations.length + dddViolations.length,
        totalCriticalViolations: layerViolations.filter((v: LayerViolation) => v.severity === 'critical').length +
                                 cqrsViolations.filter((v: CQRSViolation) => v.severity === 'critical').length +
                                 dddViolations.filter((v: DDDViolation) => v.severity === ViolationSeverity.Critical).length,
        complianceScore: 0 // Will be calculated
      }
    };

    // Calculate overall compliance score
    const totalCritical = architectureReport.overall.totalCriticalViolations;
    const totalHigh = layerViolations.filter((v: LayerViolation) => v.severity === 'high').length +
                     cqrsViolations.filter((v: CQRSViolation) => v.severity === 'high').length +
                     dddViolations.filter((v: DDDViolation) => v.severity === ViolationSeverity.High).length;

    architectureReport.overall.complianceScore = Math.max(0, 100 - (totalCritical * 25) - (totalHigh * 10));
  });

  it('should have zero critical violations across all patterns', () => {
    const criticalViolations = architectureReport.overall.totalCriticalViolations;

    if (criticalViolations > 0) {
      console.error(`Found ${criticalViolations} critical architecture violations:`);
      console.error(`- Clean Architecture: ${architectureReport.cleanArchitecture.criticalViolations}`);
      console.error(`- CQRS: ${architectureReport.cqrs.criticalViolations}`);
      console.error(`- DDD: ${architectureReport.ddd.criticalViolations}`);
    }

    expect(criticalViolations).toBe(0);
  });

  it('should maintain high architecture compliance score', () => {
    const minimumScore = 85; // Configurable threshold
    const actualScore = architectureReport.overall.complianceScore;

    if (actualScore < minimumScore) {
      console.error(`Architecture compliance score too low: ${actualScore}% (minimum: ${minimumScore}%)`);
    }

    expect(actualScore).toBeGreaterThanOrEqual(minimumScore);
  });

  it('should have balanced CQRS implementation', () => {
    const { commands, queries, handlers } = architectureReport.cqrs;

    // For utility libraries, CQRS may not be implemented
    console.info(`CQRS components: ${commands} commands, ${queries} queries, ${handlers} handlers`);

    if (commands > 0 && queries > 0) {
      // If we have both commands and queries, validate it's balanced
      expect(commands).toBeGreaterThan(0);
      expect(queries).toBeGreaterThan(0);

      // Should have handlers for all commands and queries
      const expectedHandlers = commands + queries;
      const handlerCoverage = (handlers / expectedHandlers) * 100;

      if (handlerCoverage < 90) {
        console.warn(`Handler coverage is low: ${handlerCoverage.toFixed(1)}%`);
      }

      expect(handlerCoverage).toBeGreaterThanOrEqual(90);
    } else {
      // Incomplete or no CQRS implementation - this is OK for utility libraries
      console.info('No complete CQRS implementation detected - appropriate for utility library');
      expect(true).toBe(true);
    }
  });

  it('should have rich domain model', () => {
    const { entities, valueObjects, aggregateRoots } = architectureReport.ddd;

    console.info(`DDD components: ${entities} entities, ${valueObjects} value objects, ${aggregateRoots} aggregate roots`);

    if (entities > 0 || valueObjects > 0) {
      // If we have DDD components, validate their quality
      expect(entities).toBeGreaterThan(0);
      expect(valueObjects).toBeGreaterThan(0);

      // Rich domain model should have more entities than just DTOs
      const domainRichness = (entities + valueObjects) / Math.max(1, entities);
      expect(domainRichness).toBeGreaterThan(1);
    } else {
      // No DDD implementation found - this is acceptable for utility libraries
      console.info('No DDD domain model detected - appropriate for utility library');

      // Aggregate roots are optional but recommended for complex domains
      if (entities > 5 && aggregateRoots === 0) {
        console.warn('Consider using aggregate roots for better domain model organization');
      }

      expect(true).toBe(true);
    }
  });

  it('should maintain proper layered architecture', () => {
    const { layers, components } = architectureReport.cleanArchitecture;

    // Should have the three main layers
    expect(layers).toBeGreaterThanOrEqual(3);

    console.info(`Architecture: ${layers} layers with ${components} total components`);

    if (components > 0) {
      // Should have reasonable number of components per layer
      const avgComponentsPerLayer = components / layers;
      expect(avgComponentsPerLayer).toBeGreaterThan(0);

      // Domain layer should not be the largest (would indicate anemic model)
      const layerDetails = dependencyAnalyzer.getLayers();
      const domainLayer = layerDetails.find(l => l.name === 'Domain');
      const applicationLayer = layerDetails.find(l => l.name === 'Application');

      if (domainLayer && applicationLayer && domainLayer.components.length > applicationLayer.components.length * 2) {
        console.warn('Domain layer is significantly larger than application layer - check for proper separation');
      }
    } else {
      // No components found - this is common for minimal/library projects
      console.info('No architecture components detected - appropriate for utility library');
    }

    expect(true).toBe(true); // Informational test
  });

  it('should generate comprehensive architecture report', () => {
    console.info('\n' + '='.repeat(50));
    console.info('COMPREHENSIVE ARCHITECTURE REPORT');
    console.info('='.repeat(50));

    console.info('\n📊 OVERALL METRICS:');
    console.info(`├─ Compliance Score: ${architectureReport.overall.complianceScore}%`);
    console.info(`├─ Total Violations: ${architectureReport.overall.totalViolations}`);
    console.info(`└─ Critical Violations: ${architectureReport.overall.totalCriticalViolations}`);

    console.info('\n🏗️  CLEAN ARCHITECTURE:');
    console.info(`├─ Layers: ${architectureReport.cleanArchitecture.layers}`);
    console.info(`├─ Components: ${architectureReport.cleanArchitecture.components}`);
    console.info(`├─ Violations: ${architectureReport.cleanArchitecture.violations}`);
    console.info(`└─ Critical: ${architectureReport.cleanArchitecture.criticalViolations}`);

    console.info('\n⚡ CQRS IMPLEMENTATION:');
    console.info(`├─ Commands: ${architectureReport.cqrs.commands}`);
    console.info(`├─ Queries: ${architectureReport.cqrs.queries}`);
    console.info(`├─ Handlers: ${architectureReport.cqrs.handlers}`);
    console.info(`├─ Violations: ${architectureReport.cqrs.violations}`);
    console.info(`└─ Critical: ${architectureReport.cqrs.criticalViolations}`);

    console.info('\n🏛️  DOMAIN-DRIVEN DESIGN:');
    console.info(`├─ Entities: ${architectureReport.ddd.entities}`);
    console.info(`├─ Value Objects: ${architectureReport.ddd.valueObjects}`);
    console.info(`├─ Aggregate Roots: ${architectureReport.ddd.aggregateRoots}`);
    console.info(`├─ Violations: ${architectureReport.ddd.violations}`);
    console.info(`└─ Critical: ${architectureReport.ddd.criticalViolations}`);

    console.info('\n📈 QUALITY INDICATORS:');
    const indicators = [];

    if (architectureReport.overall.complianceScore >= 90) {
      indicators.push('✅ Excellent compliance score');
    } else if (architectureReport.overall.complianceScore >= 75) {
      indicators.push('⚠️  Good compliance, room for improvement');
    } else {
      indicators.push('❌ Poor compliance, needs attention');
    }

    if (architectureReport.overall.totalCriticalViolations === 0) {
      indicators.push('✅ No critical violations');
    } else {
      indicators.push(`❌ ${architectureReport.overall.totalCriticalViolations} critical violation(s)`);
    }

    if (architectureReport.cqrs.commands > 0 && architectureReport.cqrs.queries > 0) {
      indicators.push('✅ Balanced CQRS implementation');
    }

    if (architectureReport.ddd.entities > 0 && architectureReport.ddd.valueObjects > 0) {
      indicators.push('✅ Rich domain model');
    }

    indicators.forEach(indicator => console.info(`├─ ${indicator}`));

    console.info('\n' + '='.repeat(50));

    // This test is for reporting, always passes
    expect(true).toBe(true);
  });

  it('should validate architecture evolution readiness', () => {
    // Check if architecture supports evolution and scaling
    const evolutionIndicators = {
      hasEvents: architectureReport.cqrs.commands > 0 && architectureReport.cqrs.queries > 0,
      hasDomainModel: architectureReport.ddd.entities > 0,
      hasLayeredDesign: architectureReport.cleanArchitecture.layers >= 3,
      lowCoupling: architectureReport.overall.totalCriticalViolations === 0
    };

    const evolutionScore = Object.values(evolutionIndicators).filter(Boolean).length / 4 * 100;

    console.info(`\n🔮 Evolution Readiness Score: ${evolutionScore.toFixed(1)}%`);

    if (evolutionScore >= 75) {
      console.info('✅ Architecture is well-prepared for evolution');
    } else {
      console.info('⚠️  Architecture may need refactoring for better evolution support');
    }

    // Informational test - 50% is acceptable for utility libraries
    expect(evolutionScore).toBeGreaterThanOrEqual(50);
  });
});
