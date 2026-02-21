// Fakes
export { FakeClock } from './fakes/FakeClock';
export { InMemoryIdempotencyStore } from './fakes/InMemoryIdempotencyStore';
export { InMemoryOutboxStore } from './fakes/InMemoryOutboxStore';

// Builders
export { Builder } from './builders/Builder';

// Fixtures
export { EventEnvelopeFixture } from './fixtures/EventEnvelopeFixture';

// Matchers
export { registerAcmeMatchers } from './matchers/vitestMatchers';

// Performance
export { PerformanceTimer, measureAsync } from './performance/PerformanceTimer';

// Containers
export type { TestContainerPort } from './containers/TestContainerPort';
export type {
  PostgresConnectionInfo,
  MysqlConnectionInfo,
  MongoConnectionInfo,
  RedisConnectionInfo,
  RabbitMqConnectionInfo,
  KafkaConnectionInfo,
  LocalStackConnectionInfo,
} from './containers/TestContainerPort';
export { ContainerTestHarness } from './containers/ContainerTestHarness';
export type { Seeder } from './containers/Seeder';
export { CompositeSeeder } from './containers/Seeder';
export { FakeTestContainer } from './containers/FakeTestContainer';

// Bundle size optimization (Item 50)
export type {
  SizeBudget,
  BudgetViolation,
  ModuleStats,
  BundleReport,
  DependencyInfo,
  ExportEntry,
  ExportAuditResult,
} from './bundle/BundleTypes';
export { BundleSizeChecker } from './bundle/BundleSizeChecker';
export { ExportAuditor } from './bundle/ExportAuditor';
export { DependencyAuditor } from './bundle/DependencyAuditor';
export type { DependencyAuditSummary } from './bundle/DependencyAuditor';
export { TreeShakeChecker } from './bundle/TreeShakeChecker';
export type { TreeShakeAnalysis } from './bundle/TreeShakeChecker';
export { CodeSplitAnalyzer } from './bundle/CodeSplitAnalyzer';
export type { Chunk, SplitAnalysis } from './bundle/CodeSplitAnalyzer';

// Load testing framework (Item 51)
export type {
  LoadStage,
  ThresholdRule,
  LoadTestOptions,
  LoadTestResult,
  HttpCheck,
  LoadTestScenarioConfig,
  ArtilleryPhase,
  ArtilleryConfig,
} from './loadtest/LoadTestTypes';
export { LoadTestScenario } from './loadtest/LoadTestScenario';
export { K6Adapter } from './loadtest/K6Adapter';
export { ArtilleryAdapter } from './loadtest/ArtilleryAdapter';
export { StressTestRunner } from './loadtest/StressTestRunner';
export { SpikeTestRunner } from './loadtest/SpikeTestRunner';
export { SoakTestRunner } from './loadtest/SoakTestRunner';
