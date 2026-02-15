# ts-commons Architecture Decision Records (ADRs)

## ADR-001: Monorepo com pnpm

**Status:** Aceito

**Contexto:**
Precisamos de uma forma de organizar múltiplos pacotes relacionados que compartilham código e configurações.

**Decisão:**
Usar monorepo com pnpm workspaces.

**Consequências:**
- ✅ Single source of truth
- ✅ Dependency hoisting
- ✅ Builds incrementais
- ❌ Requer disciplina em versionamento

---

## ADR-002: Zero Dependencies no Kernel

**Status:** Aceito

**Contexto:**
O domínio não deve depender de frameworks ou bibliotecas externas.

**Decisão:**
Pacote `@acme/kernel` tem ZERO dependencies npm.

**Consequências:**
- ✅ Domínio puro e portável
- ✅ Fácil de testar
- ✅ Não quebra com updates de frameworks
- ❌ Não podemos usar libs úteis (zod, etc.)

---

## ADR-003: Ports & Adapters (Hexagonal)

**Status:** Aceito

**Contexto:**
Precisamos isolar domínio de detalhes de infraestrutura.

**Decisão:**
Usar Ports (interfaces) no kernel/application e Adapters na infra.

**Consequências:**
- ✅ Fácil trocar implementações
- ✅ Testabilidade com fakes
- ✅ Independência de tecnologia
- ❌ Mais boilerplate

---

## ADR-004: CQRS Obrigatório

**Status:** Aceito

**Contexto:**
Queries e Commands têm SLAs e características diferentes.

**Decisão:**
Separar Commands (escrita) de Queries (leitura) no `@acme/application`.

**Consequências:**
- ✅ Otimizações independentes
- ✅ Escalabilidade
- ✅ Clareza de intent
- ❌ Mais código

---

## ADR-005: Outbox Pattern para Eventos

**Status:** Aceito

**Contexto:**
Precisamos garantir at-least-once delivery de eventos.

**Decisão:**
Usar Transactional Outbox Pattern no `@acme/outbox`.

**Consequências:**
- ✅ Eventos sempre publicados
- ✅ Consistência transacional
- ✅ Resiliência a falhas
- ❌ Complexidade adicional
- ❌ Requer poller

---

## ADR-006: Barrel Exports Only

**Status:** Aceito

**Contexto:**
Precisamos controlar surface area da API pública.

**Decisão:**
Cada pacote exporta apenas via `src/index.ts`.

**Consequências:**
- ✅ API pública clara
- ✅ Breaking changes detectáveis
- ✅ Tree-shaking otimizado
- ❌ Imports mais longos internamente
