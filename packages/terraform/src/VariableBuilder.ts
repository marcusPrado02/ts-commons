import type { TfVariable, TfVariableType } from './types';

function formatDefaultValue(value: string | number | boolean | null): string {
  if (typeof value === 'string') return `"${value}"`;
  if (value === null) return 'null';
  return String(value);
}

export class VariableBuilder {
  private readonly variable: TfVariable;

  constructor(name: string) {
    this.variable = {
      name,
      type: 'string',
      description: '',
      default: undefined,
      sensitive: false,
      nullable: true,
    };
  }

  setType(type: TfVariableType): this {
    this.variable.type = type;
    return this;
  }

  setDescription(description: string): this {
    this.variable.description = description;
    return this;
  }

  setDefault(value: string | number | boolean | null): this {
    this.variable.default = value;
    return this;
  }

  setSensitive(sensitive: boolean): this {
    this.variable.sensitive = sensitive;
    return this;
  }

  setNullable(nullable: boolean): this {
    this.variable.nullable = nullable;
    return this;
  }

  build(): TfVariable {
    return { ...this.variable };
  }

  toHcl(): string {
    const lines: string[] = [`variable "${this.variable.name}" {`];
    lines.push(`  type        = ${this.variable.type}`);
    if (this.variable.description.length > 0) {
      lines.push(`  description = "${this.variable.description}"`);
    }
    if (this.variable.default !== undefined) {
      lines.push(`  default     = ${formatDefaultValue(this.variable.default)}`);
    }
    if (this.variable.sensitive) {
      lines.push('  sensitive   = true');
    }
    if (!this.variable.nullable) {
      lines.push('  nullable    = false');
    }
    lines.push('}');
    return lines.join('\n');
  }
}
