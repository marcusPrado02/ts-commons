# Architecture Testing Package

## Overview

The `@marcusprado02/architecture-tests` package provides comprehensive automated validation of Clean Architecture, CQRS, and Domain-Driven Design patterns in TypeScript codebases.

## Features

### Clean Architecture Validation

- **Layer Dependency Analysis**: Validates that dependencies flow in only one direction (Domain ← Application ← Infrastructure)
- **Circular Dependency Detection**: Identifies and reports circular dependencies between packages
- **Layer Component Counting**: Ensures proper distribution of components across architectural layers

### CQRS Implementation Validation

- **Command-Query Separation**: Verifies that commands and queries are properly separated
- **Handler Validation**: Ensures each command and query has corresponding handlers
- **Side Effect Detection**: Validates that queries don't modify state
- **Event Sourcing Compliance**: Checks event sourcing implementation patterns

### Domain-Driven Design Validation

- **Entity Identity**: Ensures entities have proper identity properties
- **Value Object Immutability**: Validates that value objects are immutable
- **Aggregate Root Responsibilities**: Verifies aggregate roots handle domain events
- **Repository Placement**: Ensures repository interfaces are in domain layer, implementations in infrastructure
- **Domain Logic Isolation**: Prevents domain logic from leaking into infrastructure

## Architecture Analyzers

### DependencyAnalyzer

Analyzes package-level dependencies and layer violations:

- Loads all workspace packages and their dependencies
- Maps packages to architectural layers (Domain/Application/Infrastructure)
- Detects layer violations and circular dependencies
- Provides detailed violation reporting with severity levels

### CQRSAnalyzer

Examines CQRS implementation compliance:

- Identifies Commands, Queries, Handlers, and Events from source code
- Validates command-query separation principles
- Checks handler implementations and coverage
- Detects side effects in query operations

### DDDAnalyzer

Validates Domain-Driven Design patterns:

- Identifies Entities, Value Objects, Aggregate Roots, and other DDD components
- Validates entity identity requirements
- Checks value object immutability
- Ensures proper domain logic placement

## Test Suites

### clean-architecture.test.ts

- Validates Clean Architecture layer compliance
- Prevents critical dependency violations
- Ensures domain layer isolation
- Reports architecture metrics

### cqrs-implementation.test.ts

- Validates CQRS pattern implementation
- Ensures command-query separation
- Validates handler completeness
- Checks for proper side effect isolation

### ddd-compliance.test.ts

- Validates Domain-Driven Design implementation
- Ensures proper entity and value object design
- Validates domain logic placement
- Checks for anemic domain model anti-patterns

### integrated-architecture.test.ts

- **DDD**: Padrões de Domain-Driven Design
- **Hexagonal Architecture**: Ports & Adapters

## 🔍 Tipos de Teste

### 1. Dependency Rules Tests

Valida que as dependências seguem a direção correta:

```
Kernel (Domain) ← Application ← Infrastructure
```

### 2. CQRS Validation Tests

Verifica implementação correta de Command Query Responsibility Segregation.

### 3. DDD Pattern Tests

Valida padrões Domain-Driven Design como Aggregates, Entities, Value Objects.

### 4. Package Boundary Tests

Garante que os pacotes não violem as regras de encapsulamento.

## 🚀 Execução

```bash
# Executar todos os testes de arquitetura
pnpm test:architecture

# Executar categoria específica
pnpm test:architecture --grep "Dependency Rules"
```

## 📊 Relatórios

Os testes geram relatórios detalhados sobre:

- Violações de dependência encontradas
- Métricas de acoplamento
- Sugestões de refatoração
