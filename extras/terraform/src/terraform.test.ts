/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import {
  generateModuleBlock,
  generateOutputBlock,
  generateModuleCallSnippet,
  indentBlock,
} from './ModuleGenerator';
import { VariableBuilder } from './VariableBuilder';
import { validateModuleRef, validateVariable, validateWorkspace } from './TerraformValidator';
import { buildTerraformCommand, buildWorkflowCommands } from './CommandBuilder';
import type { TfModuleRef, TfWorkspace, TfOutput } from './types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeModuleRef(overrides: Partial<TfModuleRef> = {}): TfModuleRef {
  return {
    name: 'ecs',
    source: '../../modules/aws/ecs-fargate',
    inputs: { service_name: 'my-app', environment: 'dev' },
    ...overrides,
  };
}

function makeWorkspace(overrides: Partial<TfWorkspace> = {}): TfWorkspace {
  return {
    name: 'ts-commons',
    environment: 'dev',
    cloud: 'aws',
    region: 'us-east-1',
    backend: {
      type: 's3',
      bucket: 'my-tfstate',
      key: 'ts-commons/dev/terraform.tfstate',
      region: 'us-east-1',
    },
    ...overrides,
  };
}

// ─── ModuleGenerator ─────────────────────────────────────────────────────────

describe('generateModuleBlock', () => {
  it('generates a module block with source and inputs', () => {
    const hcl = generateModuleBlock(makeModuleRef());
    expect(hcl).toContain('module "ecs"');
    expect(hcl).toContain('source = "../../modules/aws/ecs-fargate"');
    expect(hcl).toContain('service_name = "my-app"');
    expect(hcl).toContain('environment = "dev"');
  });

  it('wraps string values in quotes', () => {
    const hcl = generateModuleBlock(makeModuleRef({ inputs: { name: 'hello' } }));
    expect(hcl).toContain('name = "hello"');
  });

  it('leaves numeric values unquoted', () => {
    const hcl = generateModuleBlock(makeModuleRef({ inputs: { count: 3 } }));
    expect(hcl).toContain('count = 3');
  });

  it('leaves boolean values unquoted', () => {
    const hcl = generateModuleBlock(makeModuleRef({ inputs: { enabled: true } }));
    expect(hcl).toContain('enabled = true');
  });

  it('generates opening and closing braces', () => {
    const hcl = generateModuleBlock(makeModuleRef({ inputs: {} }));
    expect(hcl).toMatch(/^module "ecs" \{/);
    expect(hcl).toMatch(/\}$/);
  });

  it('handles module with no inputs', () => {
    const hcl = generateModuleBlock(makeModuleRef({ inputs: {} }));
    expect(hcl).toContain('source =');
  });
});

describe('generateOutputBlock', () => {
  const output: TfOutput = {
    name: 'cluster_arn',
    value: 'module.ecs.cluster_arn',
    description: 'ECS cluster ARN',
    sensitive: false,
  };

  it('generates an output block', () => {
    const hcl = generateOutputBlock(output);
    expect(hcl).toContain('output "cluster_arn"');
    expect(hcl).toContain('value       = module.ecs.cluster_arn');
    expect(hcl).toContain('description = "ECS cluster ARN"');
  });

  it('adds sensitive = true when sensitive', () => {
    const hcl = generateOutputBlock({ ...output, sensitive: true });
    expect(hcl).toContain('sensitive   = true');
  });

  it('omits sensitive when false', () => {
    const hcl = generateOutputBlock(output);
    expect(hcl).not.toContain('sensitive');
  });

  it('omits description when empty', () => {
    const hcl = generateOutputBlock({ ...output, description: '' });
    expect(hcl).not.toContain('description');
  });
});

describe('generateModuleCallSnippet', () => {
  it('joins multiple modules with blank lines', () => {
    const refs = [
      makeModuleRef({ name: 'ecs' }),
      makeModuleRef({ name: 'rds', source: '../../modules/aws/rds' }),
    ];
    const hcl = generateModuleCallSnippet(refs);
    expect(hcl).toContain('module "ecs"');
    expect(hcl).toContain('module "rds"');
  });

  it('returns empty string for empty array', () => {
    expect(generateModuleCallSnippet([])).toBe('');
  });
});

describe('indentBlock', () => {
  it('indents each line by given spaces', () => {
    const result = indentBlock('a\nb\nc', 2);
    expect(result).toBe('  a\n  b\n  c');
  });

  it('preserves empty lines', () => {
    const result = indentBlock('a\n\nb', 2);
    expect(result).toBe('  a\n\n  b');
  });
});

// ─── VariableBuilder ─────────────────────────────────────────────────────────

describe('VariableBuilder', () => {
  it('builds a variable with defaults', () => {
    const v = new VariableBuilder('my_var').build();
    expect(v.name).toBe('my_var');
    expect(v.type).toBe('string');
    expect(v.description).toBe('');
    expect(v.sensitive).toBe(false);
    expect(v.nullable).toBe(true);
  });

  it('setType sets variable type', () => {
    const v = new VariableBuilder('port').setType('number').build();
    expect(v.type).toBe('number');
  });

  it('setDescription sets description', () => {
    const v = new VariableBuilder('x').setDescription('my description').build();
    expect(v.description).toBe('my description');
  });

  it('setDefault sets a string default', () => {
    const v = new VariableBuilder('region').setDefault('us-east-1').build();
    expect(v.default).toBe('us-east-1');
  });

  it('setDefault sets a numeric default', () => {
    const v = new VariableBuilder('count').setType('number').setDefault(3).build();
    expect(v.default).toBe(3);
  });

  it('setSensitive marks variable sensitive', () => {
    const v = new VariableBuilder('password').setSensitive(true).build();
    expect(v.sensitive).toBe(true);
  });

  it('setNullable sets nullable false', () => {
    const v = new VariableBuilder('env').setNullable(false).build();
    expect(v.nullable).toBe(false);
  });

  it('toHcl includes type and description', () => {
    const hcl = new VariableBuilder('region')
      .setDescription('AWS region')
      .setDefault('us-east-1')
      .toHcl();
    expect(hcl).toContain('variable "region"');
    expect(hcl).toContain('type        = string');
    expect(hcl).toContain('description = "AWS region"');
    expect(hcl).toContain('default     = "us-east-1"');
  });

  it('toHcl includes sensitive = true', () => {
    const hcl = new VariableBuilder('secret').setSensitive(true).toHcl();
    expect(hcl).toContain('sensitive   = true');
  });

  it('toHcl includes nullable = false', () => {
    const hcl = new VariableBuilder('env').setNullable(false).toHcl();
    expect(hcl).toContain('nullable    = false');
  });

  it('toHcl omits default when not set', () => {
    const hcl = new VariableBuilder('required_var').setDescription('required').toHcl();
    expect(hcl).not.toContain('default');
  });

  it('chaining returns same builder', () => {
    const builder = new VariableBuilder('x');
    const result = builder.setType('bool').setDescription('a flag');
    expect(result).toBe(builder);
  });
});

// ─── TerraformValidator ──────────────────────────────────────────────────────

describe('validateModuleRef', () => {
  it('returns valid for a correct module ref', () => {
    const result = validateModuleRef(makeModuleRef());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors on invalid module name (uppercase)', () => {
    const result = validateModuleRef(makeModuleRef({ name: 'ECS' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Module name/);
  });

  it('errors on empty source', () => {
    const result = validateModuleRef(makeModuleRef({ source: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Module source must not be empty');
  });

  it('accepts names with underscores and hyphens', () => {
    const result = validateModuleRef(makeModuleRef({ name: 'my_module-1' }));
    expect(result.valid).toBe(true);
  });
});

describe('validateVariable', () => {
  it('returns valid for a correct variable', () => {
    const v = new VariableBuilder('region').setDescription('AWS region').build();
    const result = validateVariable(v);
    expect(result.valid).toBe(true);
  });

  it('errors on invalid variable name', () => {
    const v = new VariableBuilder('My-Var').setDescription('x').build();
    const result = validateVariable(v);
    expect(result.valid).toBe(false);
  });

  it('errors on missing description', () => {
    const v = new VariableBuilder('region').build();
    const result = validateVariable(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Variable "region" must have a description');
  });

  it('accepts all valid types', () => {
    const types = ['string', 'number', 'bool', 'list(string)', 'map(string)', 'any'] as const;
    for (const t of types) {
      const v = new VariableBuilder('myvar').setDescription('desc').setType(t).build();
      const result = validateVariable(v);
      expect(result.valid).toBe(true);
    }
  });
});

describe('validateWorkspace', () => {
  it('returns valid for a correct workspace', () => {
    const result = validateWorkspace(makeWorkspace());
    expect(result.valid).toBe(true);
  });

  it('errors on invalid workspace name', () => {
    const result = validateWorkspace(makeWorkspace({ name: 'My Workspace' }));
    expect(result.valid).toBe(false);
  });

  it('errors on empty region', () => {
    const result = validateWorkspace(makeWorkspace({ region: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Workspace region must not be empty');
  });

  it('errors on missing bucket for s3 backend', () => {
    const result = validateWorkspace(
      makeWorkspace({
        backend: {
          type: 's3',
          bucket: '',
          key: 'ts-commons/dev/terraform.tfstate',
          region: 'us-east-1',
        },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Backend bucket must not be empty for non-local backends');
  });

  it('allows local backend with no bucket', () => {
    const result = validateWorkspace(
      makeWorkspace({
        backend: { type: 'local', bucket: undefined, key: undefined, region: undefined },
      }),
    );
    expect(result.valid).toBe(true);
  });
});

// ─── CommandBuilder ──────────────────────────────────────────────────────────

describe('buildTerraformCommand', () => {
  it('init produces correct command', () => {
    expect(buildTerraformCommand('init')).toBe('terraform init -upgrade');
  });

  it('validate produces correct command', () => {
    expect(buildTerraformCommand('validate')).toBe('terraform validate');
  });

  it('fmt produces correct command', () => {
    expect(buildTerraformCommand('fmt')).toBe('terraform fmt -recursive');
  });

  it('plan with varFile includes -var-file flag', () => {
    const cmd = buildTerraformCommand('plan', { varFile: 'terraform.tfvars' });
    expect(cmd).toContain('-var-file="terraform.tfvars"');
  });

  it('plan with planFile includes -out flag', () => {
    const cmd = buildTerraformCommand('plan', { planFile: 'tfplan' });
    expect(cmd).toContain('-out="tfplan"');
  });

  it('plan with target includes -target flag', () => {
    const cmd = buildTerraformCommand('plan', { target: 'module.ecs' });
    expect(cmd).toContain('-target="module.ecs"');
  });

  it('apply with planFile applies the plan file', () => {
    const cmd = buildTerraformCommand('apply', { planFile: 'tfplan' });
    expect(cmd).toBe('terraform apply "tfplan"');
  });

  it('apply without planFile includes varFile', () => {
    const cmd = buildTerraformCommand('apply', { varFile: 'terraform.tfvars' });
    expect(cmd).toContain('-var-file="terraform.tfvars"');
  });

  it('apply with autoApprove includes -auto-approve', () => {
    const cmd = buildTerraformCommand('apply', { autoApprove: true });
    expect(cmd).toContain('-auto-approve');
  });

  it('destroy includes -var-file', () => {
    const cmd = buildTerraformCommand('destroy', { varFile: 'terraform.tfvars' });
    expect(cmd).toContain('-var-file="terraform.tfvars"');
  });

  it('destroy with autoApprove includes -auto-approve', () => {
    const cmd = buildTerraformCommand('destroy', { autoApprove: true });
    expect(cmd).toContain('-auto-approve');
  });

  it('output returns terraform output -json', () => {
    const cmd = buildTerraformCommand('output');
    expect(cmd).toContain('terraform output');
    expect(cmd).toContain('-json');
  });
});

describe('buildWorkflowCommands', () => {
  it('returns all 5 workflow commands', () => {
    const cmds = buildWorkflowCommands('terraform.tfvars');
    expect(typeof cmds.init).toBe('string');
    expect(typeof cmds.validate).toBe('string');
    expect(typeof cmds.plan).toBe('string');
    expect(typeof cmds.apply).toBe('string');
    expect(typeof cmds.fmt).toBe('string');
  });

  it('plan uses the provided varFile', () => {
    const cmds = buildWorkflowCommands('prod.tfvars');
    expect(cmds.plan).toContain('-var-file="prod.tfvars"');
  });

  it('apply references the plan file', () => {
    const cmds = buildWorkflowCommands('terraform.tfvars');
    expect(cmds.apply).toContain('"tfplan"');
  });

  it('plan outputs tfplan file', () => {
    const cmds = buildWorkflowCommands('terraform.tfvars');
    expect(cmds.plan).toContain('-out="tfplan"');
  });
});
