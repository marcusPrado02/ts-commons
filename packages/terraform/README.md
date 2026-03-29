# @acme/terraform

Terraform module generator and validator. Produces Terraform HCL blocks (module calls, variables, outputs) from TypeScript and validates workspace configurations before apply.

## Installation

```bash
pnpm add -D @acme/terraform
```

## Quick Start

```typescript
import { generateModuleBlock, VariableBuilder } from '@acme/terraform';

// Generate a module block
const hcl = generateModuleBlock({
  name: 'order-service-db',
  source: './modules/rds',
  version: '1.2.0',
  inputs: {
    instance_class: 'db.t3.medium',
    database_name: 'orders',
    storage_gb: 100,
  },
});
// hcl — HCL string ready to write to main.tf

// Build a variable definition
const variable = new VariableBuilder('db_password')
  .type('string')
  .sensitive(true)
  .description('Database master password')
  .build();
```

## Validation

```typescript
import { validateModuleRef, validateWorkspace } from '@acme/terraform';

const result = validateModuleRef({ source: './modules/rds', version: '1.2.0' });
// result.valid, result.errors

const wsResult = validateWorkspace({ name: 'prod', environment: 'production' });
```

## See Also

- [`@acme/k8s`](../k8s) — Kubernetes manifest builders
- [`@acme/helm`](../helm) — Helm chart templates
