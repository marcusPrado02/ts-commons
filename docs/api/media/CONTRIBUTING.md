# Guia de Contribuição

## Estrutura do Projeto

Este é um monorepo pnpm com múltiplos pacotes independentes mas relacionados.

### Scripts Disponíveis

```bash
# Instalar dependências de todos os pacotes
pnpm install

# Build todos os pacotes
pnpm build

# Rodar testes em todos os pacotes
pnpm test

# Lint
pnpm lint

# Formatar código
pnpm format

# Limpar build artifacts
pnpm clean
```

## Adicionando um Novo Pacote

1. Criar pasta em `packages/{nome-pacote}`
2. Adicionar `package.json` com nome `@acme/{nome-pacote}`
3. Adicionar `tsconfig.json` extendendo `tsconfig.base.json`
4. Criar estrutura de pastas em `src/`
5. Criar `src/index.ts` com barrel exports

## Regras de Dependência

### Kernel (Núcleo)
- ❌ **NÃO** pode depender de nenhum outro pacote
- ❌ **NÃO** pode importar bibliotecas de framework (Express, Fastify, Prisma, etc.)
- ✅ Apenas TypeScript puro e Node.js built-ins

### Application
- ✅ Pode depender de `kernel`
- ❌ **NÃO** pode depender de pacotes de infraestrutura (web, persistence adapters)

### Pacotes de Infraestrutura (web, messaging adapters)
- ✅ Podem depender de `kernel`, `application`, e outros pacotes core
- ✅ Podem importar frameworks específicos (Fastify, RabbitMQ, etc.)

## Convenções de Código

### Exports
- Cada pacote deve exportar **APENAS** através de `src/index.ts`
- Não permitir imports internos: `@acme/kernel/src/ddd/Entity` ❌
- Usar barrel exports: `@acme/kernel` ✅

### Nomenclatura
- Classes: `PascalCase`
- Interfaces: `PascalCase`
- Types: `PascalCase`
- Ports (interfaces): Sufixo `Port` (ex: `LoggerPort`, `RepositoryPort`)

### Tipos vs Interfaces
- Use `interface` para contratos públicos e ports
- Use `type` para unions e intersections
- Exporte tipos com `export type { ... }`

## Testing

Cada pacote deve ter seus próprios testes:

```typescript
// packages/{pacote}/src/{modulo}.test.ts
import { describe, it, expect } from 'vitest';

describe('MyClass', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

## Versionamento

- Seguimos **Semantic Versioning** (SemVer)
- Breaking changes = Major version bump
- New features = Minor version bump
- Bug fixes = Patch version bump

## Code Review

- Toda mudança deve passar por PR
- Mínimo 1 approval
- CI deve estar verde (build + tests)
