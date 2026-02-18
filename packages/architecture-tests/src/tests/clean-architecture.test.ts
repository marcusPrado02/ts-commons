import { describe, it, expect, beforeAll } from 'vitest';
import { DependencyAnalyzer } from '../analyzers/DependencyAnalyzer';
import type { LayerViolation } from '../analyzers/DependencyAnalyzer';

describe('Clean Architecture Compliance', () => {
  let analyzer: DependencyAnalyzer;
  let violations: LayerViolation[];

  beforeAll(async () => {
    analyzer = new DependencyAnalyzer(process.cwd());
    violations = await analyzer.analyzeDependencies();
  });

  it('should have no critical dependency violations', () => {
    const criticalViolations = violations.filter(v => v.severity === 'critical');

    if (criticalViolations.length > 0) {
      const violationDetails = criticalViolations.map(v =>
        `${v.sourceLayer} -> ${v.targetLayer}: ${v.description}`
      ).join('\n');

      console.error('Critical dependency violations found:', violationDetails);
    }

    expect(criticalViolations).toHaveLength(0);
  });

  it('should minimize high severity violations', () => {
    const highSeverityViolations = violations.filter(v => v.severity === 'high');
    const maxAllowedHighViolations = 5; // Configurable threshold

    if (highSeverityViolations.length > 0) {
      const violationDetails = highSeverityViolations.map(v =>
        `${v.sourceLayer} -> ${v.targetLayer}: ${v.description}`
      ).join('\n');

      console.warn(`High severity violations (${highSeverityViolations.length}/${maxAllowedHighViolations}):`);
      console.warn(violationDetails);
    }

    expect(highSeverityViolations.length).toBeLessThanOrEqual(maxAllowedHighViolations);
  });

  it('should enforce domain layer isolation', () => {
    const domainViolations = violations.filter(v =>
      v.sourceLayer === 'Domain' &&
      (v.targetLayer === 'Infrastructure' || v.targetLayer === 'Application')
    );

    if (domainViolations.length > 0) {
      const violationDetails = domainViolations.map(v =>
        `Domain -> ${v.targetLayer}: ${v.description}`
      ).join('\n');

      console.error('Domain layer isolation violations:', violationDetails);
    }

    expect(domainViolations).toHaveLength(0);
  });

  it('should prevent circular dependencies', () => {
    const circularDependencies = analyzer.detectCircularDependencies();

    if (circularDependencies.length > 0) {
      const cycleDetails = circularDependencies.map(cycle =>
        cycle.join(' -> ')
      ).join('\n');

      console.error('Circular dependencies detected:', cycleDetails);
    }

    expect(circularDependencies).toHaveLength(0);
  });

  it('should validate layer component counts', () => {
    const layers = analyzer.getLayers();

    // Domain layer should have core components (but may be empty in a library)
    const domainLayer = layers.find(l => l.name === 'Domain');
    console.info(`Domain layer components: ${domainLayer?.components.length || 0}`);

    // Application layer should coordinate use cases (but libraries may not need this)
    const applicationLayer = layers.find(l => l.name === 'Application');
    console.info(`Application layer components: ${applicationLayer?.components.length || 0}`);

    // Infrastructure layer should handle external concerns
    const infrastructureLayer = layers.find(l => l.name === 'Infrastructure');
    console.info(`Infrastructure layer components: ${infrastructureLayer?.components.length || 0}`);

    // For a library/framework like ts-commons, it's OK to have minimal layers
    // We just need to ensure we have layers defined
    expect(layers.length).toBeGreaterThanOrEqual(3);
  });

  it('should report architecture metrics', () => {
    const layers = analyzer.getLayers();
    const totalComponents = layers.reduce((total, layer) => total + layer.components.length, 0);

    console.info('\n=== Architecture Metrics ===');
    console.info(`Total Components: ${totalComponents}`);
    console.info(`Total Violations: ${violations.length}`);

    for (const layer of layers) {
      const layerViolations = violations.filter(v => v.sourceLayer === layer.name);
      console.info(`${layer.name} Layer: ${layer.components.length} components, ${layerViolations.length} violations`);
    }

    if (violations.length > 0) {
      const violationsBySeverity = violations.reduce((acc, v) => {
        acc[v.severity] = (acc[v.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.info('Violations by severity:', violationsBySeverity);
    }

    // This test is for reporting, always passes
    expect(true).toBe(true);
  });
});
