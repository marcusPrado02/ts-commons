# 🛠️ Comandos Úteis - ts-commons

## 📦 Gerenciamento de Pacotes

### Instalar Dependências

```bash
# Instalar todas as dependências do workspace
pnpm install

# Instalar dependência em um pacote específico
pnpm --filter @marcusprado02/kernel add <package>

# Instalar dev dependency em um pacote
pnpm --filter @marcusprado02/kernel add -D <package>

# Instalar dependência workspace em outro pacote
pnpm --filter @marcusprado02/application add @marcusprado02/kernel
```

### Remover Dependências

```bash
# Remover de um pacote específico
pnpm --filter @marcusprado02/kernel remove <package>
```

---

## 🔨 Build & Compilação

### Build Completo

```bash
# Build todos os pacotes
pnpm build

# Build com script customizado (recomendado)
./scripts/build-all.sh

# Build em modo watch
pnpm -r run build --watch
```

### Build Pacote Específico

```bash
# Build apenas kernel
pnpm --filter @marcusprado02/kernel build

# Build kernel e suas dependências
pnpm --filter @marcusprado02/kernel... build
```

### Limpar Builds

```bash
# Limpar todos os builds
pnpm clean

# Limpar tudo (incluindo node_modules)
pnpm clean && rm -rf node_modules
```

---

## 🧪 Testes

### Rodar Testes

```bash
# Todos os testes
pnpm test

# Testes em watch mode
pnpm test:watch

# Testes de um pacote específico
pnpm --filter @marcusprado02/kernel test

# Testes com coverage
pnpm -r run test -- --coverage
```

---

## 🎨 Code Quality

### Linting

```bash
# Lint todos os arquivos
pnpm lint

# Lint com auto-fix
pnpm lint --fix

# Lint pacote específico
pnpm --filter @marcusprado02/kernel lint
```

### Formatação

```bash
# Formatar todos os arquivos
pnpm format

# Verificar formatação (CI)
pnpm format --check
```

### Type Checking

```bash
# Type check todos os pacotes
pnpm typecheck

# Type check pacote específico
pnpm --filter @marcusprado02/kernel typecheck
```

---

## 📊 Análise & Debugging

### Listar Dependências

```bash
# Ver árvore de dependências
pnpm list --depth=2

# Ver dependências de um pacote
pnpm --filter @marcusprado02/application list

# Ver apenas dependências de produção
pnpm list --prod
```

### Verificar Workspace

```bash
# Listar todos os pacotes no workspace
pnpm list -r --depth -1

# Ver informações de um pacote
pnpm --filter @marcusprado02/kernel info
```

### Análise de Bundle

```bash
# Ver tamanho dos pacotes compilados
du -sh packages/*/dist

# Ver arquivos TypeScript por pacote
find packages -name "*.ts" | grep -v node_modules | wc -l
```

---

## 🔄 Scripts Úteis

### Executar Script em Todos os Pacotes

```bash
# Rodar script "build" em todos
pnpm -r run build

# Rodar script em paralelo (mais rápido)
pnpm -r --parallel run test

# Rodar em ordem topológica (respeitando deps)
pnpm -r --workspace-concurrency=1 run build
```

### Executar Script em Pacotes Específicos

```bash
# Apenas pacotes que dependem de kernel
pnpm --filter ...@marcusprado02/kernel run test

# Apenas kernel e suas dependências
pnpm --filter @marcusprado02/kernel... run build
```

---

## 🚀 Publicação

### Preparar para Publicação

```bash
# 1. Limpar tudo
pnpm clean

# 2. Reinstalar dependências
pnpm install

# 3. Build completo
pnpm build

# 4. Rodar testes
pnpm test

# 5. Lint
pnpm lint
```

### Publicar Pacotes

```bash
# Publicar todos os pacotes (dry-run)
pnpm -r publish --dry-run

# Publicar de verdade
pnpm -r publish --access public

# Publicar pacote específico
pnpm --filter @marcusprado02/kernel publish --access public
```

### Bump de Versão

```bash
# Patch (0.1.0 -> 0.1.1)
pnpm -r exec npm version patch

# Minor (0.1.0 -> 0.2.0)
pnpm -r exec npm version minor

# Major (0.1.0 -> 1.0.0)
pnpm -r exec npm version major
```

---

## 🔍 Debugging & Troubleshooting

### Verificar Problemas

```bash
# Ver erros do TypeScript
pnpm typecheck 2>&1 | grep error

# Ver warnings do ESLint
pnpm lint 2>&1 | grep warning

# Verificar imports circulares
npx madge --circular --extensions ts packages/*/src
```

### Limpar Cache

```bash
# Limpar cache do TypeScript
find . -name "*.tsbuildinfo" -delete

# Limpar cache do pnpm
pnpm store prune

# Reset completo
pnpm clean && rm -rf node_modules pnpm-lock.yaml && pnpm install
```

---

## 📝 Git & Controle de Versão

### Commits Convencionais

```bash
# Feature
git commit -m "feat(kernel): add new ValueObject base class"

# Fix
git commit -m "fix(application): resolve CommandBus type error"

# Docs
git commit -m "docs(readme): update installation guide"

# Breaking change
git commit -m "feat(kernel)!: change Entity constructor signature"
```

### Ver Mudanças

```bash
# Ver arquivos modificados
git status

# Ver diff de um pacote específico
git diff packages/kernel

# Ver commits de um pacote
git log --oneline packages/kernel
```

---

## 🎯 Workflows Comuns

### Adicionar Novo Pacote

```bash
# 1. Criar estrutura
mkdir -p packages/novo-pacote/src
cd packages/novo-pacote

# 2. Criar package.json
cat > package.json << EOF
{
  "name": "@marcusprado02/novo-pacote",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
EOF

# 3. Criar tsconfig.json
cat > tsconfig.json << EOF
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  }
}
EOF

# 4. Criar src/index.ts
echo "export const VERSION = '0.1.0';" > src/index.ts

# 5. Build
cd ../.. && pnpm build
```

### Atualizar Dependências

```bash
# Ver updates disponíveis
pnpm outdated

# Update interativo
pnpm update -i

# Update de dev dependencies
pnpm update -D

# Update específico
pnpm update typescript@latest
```

### Desenvolvimento Local

```bash
# 1. Terminal 1: Watch build
pnpm -r run build --watch

# 2. Terminal 2: Watch tests
pnpm -r run test:watch

# 3. Terminal 3: Lint on save (VSCode faz automaticamente)
```

---

## 💡 Dicas de Performance

```bash
# Build apenas pacotes modificados
pnpm -r --filter "[origin/main]" run build

# Cache de build do TypeScript (já habilitado via composite)
# Não precisa fazer nada, já está otimizado!

# Paralelizar testes
pnpm -r --parallel run test

# Skip prepare scripts (mais rápido)
pnpm install --ignore-scripts
```

---

## 🆘 Troubleshooting

### Erro: "Cannot find module"

```bash
# Rebuild tudo
pnpm clean && pnpm install && pnpm build
```

### Erro de tipos TypeScript

```bash
# Limpar caches
find . -name "*.tsbuildinfo" -delete
pnpm typecheck
```

### pnpm-lock.yaml desatualizado

```bash
rm pnpm-lock.yaml
pnpm install
```

---

**Referência rápida sempre à mão! 🎯**
