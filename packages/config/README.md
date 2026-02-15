# @acme/config

Gerenciamento de configuração seguindo **12-Factor App** com validação de schema e múltiplas sources.

## Instalação

```bash
pnpm add @acme/config
```

## Features

- 🌍 **12-Factor Config** - Configuração via environment variables
- ✅ **Schema Validation** - Validação tipo-safe de configurações
- 📁 **Multiple Sources** - Suporte a process.env, .env files, etc.
- 🔒 **Type-safe** - Configurações tipadas

## Uso Básico

```typescript
import { ConfigLoader, ProcessEnvSource, Result } from '@acme/config';

// 1. Definir schema de configuração
interface AppConfig {
  port: number;
  databaseUrl: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// 2. Criar validador de schema
const configSchema = {
  validate(raw: Record<string, string | undefined>): Result<AppConfig, string[]> {
    const errors: string[] = [];
    
    const port = parseInt(raw['PORT'] ?? '3000');
    if (isNaN(port)) errors.push('PORT must be a number');
    
    const databaseUrl = raw['DATABASE_URL'];
    if (!databaseUrl) errors.push('DATABASE_URL is required');
    
    const logLevel = raw['LOG_LEVEL'] ?? 'info';
    if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
      errors.push('LOG_LEVEL must be debug, info, warn, or error');
    }
    
    if (errors.length > 0) {
      return Result.err(errors);
    }
    
    return Result.ok({
      port,
      databaseUrl: databaseUrl!,
      logLevel: logLevel as AppConfig['logLevel'],
    });
  }
};

// 3. Carregar configuração
const loader = new ConfigLoader(
  configSchema,
  [new ProcessEnvSource()]
);

const config = await loader.load();
console.log(config.port); // Tipado como number
```

## Environment Detection

```typescript
import { getEnv, isProduction, isDevelopment } from '@acme/config';

if (isProduction()) {
  // Configurações de produção
}

if (isDevelopment()) {
  // Configurações de desenvolvimento
}

console.log(getEnv()); // 'production' | 'development' | 'staging' | 'test'
```

## Multiple Config Sources

```typescript
import { ConfigLoader, ProcessEnvSource, DotenvSource } from '@acme/config';

const loader = new ConfigLoader(configSchema, [
  new DotenvSource('.env'),        // 1. Carrega .env primeiro
  new ProcessEnvSource(),          // 2. process.env sobrescreve .env
]);
```

## Best Practices

### ✅ DO
- Use environment variables em produção
- Valide todas as configurações no startup
- Falhe rápido se configuração inválida
- Use .env apenas em desenvolvimento

### ❌ DON'T
- Não commite .env no git
- Não use valores default para secrets
- Não carregue .env em produção
