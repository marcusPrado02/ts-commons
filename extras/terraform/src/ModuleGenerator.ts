import type { TfModuleRef, TfOutput } from './types';

function formatInputValue(v: string | number | boolean): string {
  if (typeof v === 'string') {
    return `"${v}"`;
  }
  return String(v);
}

function indentLines(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? `${pad}${line}` : line))
    .join('\n');
}

export function generateModuleBlock(ref: TfModuleRef): string {
  const lines: string[] = [`module "${ref.name}" {`, `  source = "${ref.source}"`];
  if (Object.keys(ref.inputs).length > 0) {
    lines.push('');
  }
  for (const [key, value] of Object.entries(ref.inputs)) {
    lines.push(`  ${key} = ${formatInputValue(value)}`);
  }
  lines.push('}');
  return lines.join('\n');
}

export function generateOutputBlock(output: TfOutput): string {
  const lines: string[] = [`output "${output.name}" {`];
  lines.push(`  value       = ${output.value}`);
  if (output.description.length > 0) {
    lines.push(`  description = "${output.description}"`);
  }
  if (output.sensitive) {
    lines.push('  sensitive   = true');
  }
  lines.push('}');
  return lines.join('\n');
}

export function generateModuleCallSnippet(modules: TfModuleRef[]): string {
  return modules.map((m) => generateModuleBlock(m)).join('\n\n');
}

export function indentBlock(block: string, spaces: number): string {
  return indentLines(block, spaces);
}
