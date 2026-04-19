export type {
  K8sMetadata,
  ResourceLimits,
  ResourceRequirements,
  HttpProbe,
  ContainerPort,
  EnvVarSource,
  EnvVar,
  ContainerSpec,
  DeploymentOptions,
  ServiceType,
  ServicePort,
  ServiceOptions,
  ConfigMapOptions,
  HPAOptions,
  PDBOptions,
  NetworkPolicyOptions,
  IngressPath,
  IngressOptions,
  ValidationResult,
  K8sManifestBase,
} from './types';

export { buildDeployment } from './builders/DeploymentBuilder';
export { buildService } from './builders/ServiceBuilder';
export { buildConfigMap } from './builders/ConfigMapBuilder';
export { buildHPA } from './builders/HPABuilder';
export { buildPDB } from './builders/PDBBuilder';
export { buildNetworkPolicy } from './builders/NetworkPolicyBuilder';
export { buildIngress } from './builders/IngressBuilder';

export {
  validateDeployment,
  validateService,
  validateConfigMap,
  validateHPA,
  validatePDB,
  validateNetworkPolicy,
  validateIngress,
} from './ManifestValidator';
export { BlueGreenDeployment } from './bluegreen/BlueGreenDeployment';
export type {
  BlueGreenConfig,
  BlueGreenStrategy,
  DeploymentColor,
  DeploymentSlot,
  TrafficSwitchResult,
  RollbackResult,
  SmokeTestResult,
  SmokeTestCheck,
} from './bluegreen/types';
export { CanaryRelease } from './canary/CanaryRelease';
export type {
  CanaryConfig,
  CanaryMetrics,
  CanaryStatus,
  CanaryPhase,
  CanaryAnalysisResult,
  MetricsProvider,
} from './canary/types';
