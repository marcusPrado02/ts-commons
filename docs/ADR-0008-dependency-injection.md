# ADR-0008: Dependency Injection Approach

## Status
**Accepted** - 18/02/2026

## Context
Our Clean Architecture implementation needs a dependency injection strategy that supports:
- Loose coupling between layers
- Testability with easy mocking
- Framework agnostic approach
- Type safety with TypeScript
- Performance optimization

## Decision
We will use **Manual Constructor Injection** with **Factory Pattern** instead of reflection-based DI containers.

## Rationale

### Manual Injection Benefits:
- **Explicit dependencies**: Clear dependency graph
- **Type safety**: Full TypeScript compile-time checking
- **Zero runtime overhead**: No reflection or metadata
- **Framework agnostic**: No external DI library dependency
- **Debugging friendly**: Easy to trace dependency resolution
- **Bundle size**: No additional runtime library

### Architecture Pattern:
```typescript
// Domain Layer (no dependencies)
export class User extends Entity<UserId> {
  constructor(
    id: UserId,
    private email: Email,
    private name: UserName
  ) {
    super(id);
  }
}

// Application Layer (depends on abstractions)
export class CreateUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private eventPublisher: EventPublisher,
    private logger: Logger
  ) {}

  async execute(command: CreateUserCommand): Promise<Result<void, ApplicationError>> {
    // implementation
  }
}

// Infrastructure Layer (implements abstractions)
export class PostgresUserRepository implements UserRepository {
  constructor(
    private database: Database,
    private logger: Logger
  ) {}
}
```

## Implementation Patterns

### 1. Factory Pattern:
```typescript
// ApplicationServiceFactory.ts
export class ApplicationServiceFactory {
  constructor(
    private infrastructure: InfrastructureContainer
  ) {}

  createUserService(): CreateUserUseCase {
    return new CreateUserUseCase(
      this.infrastructure.userRepository,
      this.infrastructure.eventPublisher,
      this.infrastructure.logger
    );
  }

  createOrderService(): CreateOrderUseCase {
    return new CreateOrderUseCase(
      this.infrastructure.orderRepository,
      this.infrastructure.userRepository,
      this.infrastructure.eventPublisher,
      this.infrastructure.logger
    );
  }
}
```

### 2. Container Pattern:
```typescript
// InfrastructureContainer.ts
export class InfrastructureContainer {
  private _logger?: Logger;
  private _database?: Database;
  private _userRepository?: UserRepository;

  get logger(): Logger {
    if (!this._logger) {
      this._logger = new ConsoleLogger();
    }
    return this._logger;
  }

  get database(): Database {
    if (!this._database) {
      this._database = new PostgresDatabase(
        this.configuration.databaseUrl,
        this.logger
      );
    }
    return this._database;
  }

  get userRepository(): UserRepository {
    if (!this._userRepository) {
      this._userRepository = new PostgresUserRepository(
        this.database,
        this.logger
      );
    }
    return this._userRepository;
  }
}
```

### 3. Composition Root:
```typescript
// main.ts (Application entry point)
export async function createApplication(): Promise<Application> {
  // Load configuration
  const config = await ConfigurationLoader.load();
  
  // Create infrastructure
  const infrastructure = new InfrastructureContainer(config);
  
  // Create application services
  const services = new ApplicationServiceFactory(infrastructure);
  
  // Create web adapters
  const webAdapters = new WebAdapterFactory(services, infrastructure);
  
  // Compose application
  return new Application(webAdapters, infrastructure);
}

// Start application
const app = await createApplication();
await app.start();
```

## Testing Strategy

### Unit Tests (Mocked Dependencies):
```typescript
describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let mockRepository: jest.Mocked<UserRepository>;
  let mockPublisher: jest.Mocked<EventPublisher>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findByEmail: jest.fn(),
    } as jest.Mocked<UserRepository>;
    
    mockPublisher = {
      publish: jest.fn(),
    } as jest.Mocked<EventPublisher>;
    
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    } as jest.Mocked<Logger>;

    useCase = new CreateUserUseCase(
      mockRepository,
      mockPublisher,
      mockLogger
    );
  });

  it('should create user successfully', async () => {
    // Test implementation
  });
});
```

### Integration Tests (Real Dependencies):
```typescript
describe('User Integration', () => {
  let infrastructure: InfrastructureContainer;
  let services: ApplicationServiceFactory;

  beforeEach(async () => {
    infrastructure = new InfrastructureContainer(testConfig);
    services = new ApplicationServiceFactory(infrastructure);
    await infrastructure.database.migrate();
  });

  afterEach(async () => {
    await infrastructure.database.clean();
  });

  it('should handle complete user workflow', async () => {
    const createUser = services.createUserService();
    const getUser = services.getUserService();
    
    // Test complete workflow
  });
});
```

## Alternative Approaches Considered

### 1. Reflection-based DI (inversify, tsyringe):
**Pros**: Automatic wiring, decorators
**Cons**: Runtime overhead, bundle size, complexity, debugging difficulty

### 2. Service Locator Pattern:
**Pros**: Simple implementation
**Cons**: Hidden dependencies, testing difficulty, tight coupling

### 3. Function-based Injection:
**Pros**: Functional approach, simple
**Cons**: Parameter explosion, type safety challenges

## Advanced Patterns

### Conditional Dependencies:
```typescript
export class NotificationServiceFactory {
  createEmailService(): EmailService {
    if (this.config.emailProvider === 'sendgrid') {
      return new SendgridEmailService(this.config.sendgridApiKey);
    } else if (this.config.emailProvider === 'ses') {
      return new SESEmailService(this.awsClient);
    }
    throw new Error(`Unknown email provider: ${this.config.emailProvider}`);
  }
}
```

### Plugin Architecture:
```typescript
export class PluginContainer {
  private plugins = new Map<string, Plugin>();

  registerPlugin(name: string, plugin: Plugin): void {
    this.plugins.set(name, plugin);
  }

  createServiceWithPlugins(): PluginService {
    return new PluginService(Array.from(this.plugins.values()));
  }
}
```

### Scoped Instances:
```typescript
export class ScopedContainer {
  private requestScoped = new Map<string, any>();

  createRequestScope(): RequestScope {
    return {
      userRepository: new CachedUserRepository(
        this.infrastructure.userRepository,
        new Map() // Request-scoped cache
      ),
      eventPublisher: new BufferedEventPublisher(
        this.infrastructure.eventPublisher
      )
    };
  }
}
```

## Consequences

### Positive:
- ✅ Explicit and type-safe dependency graph
- ✅ Zero runtime overhead
- ✅ Framework independence
- ✅ Easy debugging and testing
- ✅ Compile-time dependency validation

### Negative:
- ❌ More boilerplate code
- ❌ Manual wiring complexity with many services
- ❌ No automatic lifecycle management
- ❌ Repetitive factory methods

### Risk Mitigation:
- Code generators for factory methods
- Clear architectural guidelines
- Comprehensive testing of composition root
- Documentation with examples

## Performance Considerations

### Lazy Loading:
```typescript
get expensiveService(): ExpensiveService {
  if (!this._expensiveService) {
    this._expensiveService = new ExpensiveService(this.dependencies);
  }
  return this._expensiveService;
}
```

### Singleton vs Instance:
```typescript
// Singleton for stateless services
get logger(): Logger {
  return this._logger ??= new ConsoleLogger();
}

// New instance for stateful services
createUserSession(): UserSession {
  return new UserSession(this.userRepository, this.logger);
}
```

## References
- [Dependency Injection Principles](https://martinfowler.com/articles/injection.html)
- [Clean Architecture by Robert Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Composition Root Pattern](https://blog.ploeh.dk/2011/07/28/CompositionRoot/)
- [TypeScript Dependency Injection](https://khalilstemmler.com/articles/tutorials/dependency-injection-inversion-explained/)
