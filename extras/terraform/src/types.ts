export type TfCloud = 'aws' | 'azure' | 'gcp';

export type TfEnvironment = 'dev' | 'staging' | 'production';

export type TfVariableType = 'string' | 'number' | 'bool' | 'list(string)' | 'map(string)' | 'any';

export interface TfVariable {
  name: string;
  type: TfVariableType;
  description: string;
  default: string | number | boolean | null | undefined;
  sensitive: boolean;
  nullable: boolean;
}

export interface TfOutput {
  name: string;
  value: string;
  description: string;
  sensitive: boolean;
}

export interface TfModuleRef {
  name: string;
  source: string;
  inputs: Record<string, string | number | boolean>;
}

export interface TfBackend {
  type: 's3' | 'azurerm' | 'gcs' | 'local';
  bucket: string | undefined;
  key: string | undefined;
  region: string | undefined;
}

export interface TfWorkspace {
  name: string;
  environment: TfEnvironment;
  cloud: TfCloud;
  region: string;
  backend: TfBackend;
}

export type TfCommand = 'init' | 'plan' | 'apply' | 'destroy' | 'validate' | 'fmt' | 'output';

export interface TfCommandOptions {
  varFile: string | undefined;
  planFile: string | undefined;
  autoApprove: boolean;
  target: string | undefined;
  workspace: string | undefined;
}

export interface TfValidationResult {
  valid: boolean;
  errors: string[];
}
