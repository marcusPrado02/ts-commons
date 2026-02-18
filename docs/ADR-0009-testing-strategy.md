# ADR-0009: Testing Strategy

## Status
**Accepted** - 18/02/2026

## Context
Our monorepo needs a comprehensive testing strategy that ensures code quality, maintains high coverage, and supports different types of testing across all architectural layers.

## Decision
We will implement a **3-tier testing pyramid** with **Vitest** as the primary testing framework and **Test-Driven Development (TDD)** practices.

## Testing Pyramid

### 1. Unit Tests (70% of tests)
**Scope**: Individual functions, classes, and components in isolation
**Target Coverage**: 95% for domain logic, 85% for application logic

```typescript
// Domain Layer Tests
describe('User Entity', () => {
  it('should create user with valid data', () => {
    const userId = UserId.create();
    const email = Email.create('john@example.com').unwrap();
    const name = UserName.create('John Doe').unwrap();
    
    const user = User.create(userId, email, name);
    
    expect(user.isSuccess()).toBe(true);
    expect(user.unwrap().email.value).toBe('john@example.com');
  });

  it('should not allow invalid email', () => {
    const result = Email.create('invalid-email');
    
    expect(result.isFailure()).toBe(true);
    expect(result.error().message).toContain('Invalid email format');
  });
});

// Application Layer Tests  
describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let mockRepository: jest.Mocked<UserRepository>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    mockRepository = createMocked<UserRepository>();
    mockEventPublisher = createMocked<EventPublisher>();
    useCase = new CreateUserUseCase(mockRepository, mockEventPublisher);
  });

  it('should create user and publish event', async () => {
    const command = new CreateUserCommand('john@example.com', 'John Doe');
    mockRepository.findByEmail.mockResolvedValue(Option.none());
    mockRepository.save.mockResolvedValue(Result.ok());

    const result = await useCase.execute(command);

    expect(result.isSuccess()).toBe(true);
    expect(mockRepository.save).toHaveBeenCalledOnce();
    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      expect.any(UserCreatedEvent)
    );
  });
});
```

### 2. Integration Tests (25% of tests)
**Scope**: Testing interactions between components, including database and external services

```typescript
describe('User Management Integration', () => {
  let app: TestApplication;
  let database: Database;

  beforeEach(async () => {
    app = await createTestApplication();
    database = app.infrastructure.database;
    await database.migrate();
  });

  afterEach(async () => {
    await database.clean();
    await app.stop();
  });

  it('should handle complete user lifecycle', async () => {
    // Create user
    const createResult = await app.services.createUser.execute(
      new CreateUserCommand('john@example.com', 'John Doe')
    );
    expect(createResult.isSuccess()).toBe(true);

    // Verify user exists in database
    const user = await app.infrastructure.userRepository.findByEmail(
      Email.create('john@example.com').unwrap()
    );
    expect(user.isSome()).toBe(true);

    // Update user
    const updateResult = await app.services.updateUser.execute(
      new UpdateUserCommand(user.unwrap().id, 'Jane Doe')
    );
    expect(updateResult.isSuccess()).toBe(true);
  });

  it('should handle database constraints', async () => {
    const command = new CreateUserCommand('john@example.com', 'John Doe');
    
    // Create first user
    await app.services.createUser.execute(command);
    
    // Try to create duplicate
    const result = await app.services.createUser.execute(command);
    
    expect(result.isFailure()).toBe(true);
    expect(result.error().code).toBe('USER_ALREADY_EXISTS');
  });
});
```

### 3. End-to-End Tests (5% of tests)
**Scope**: Complete user workflows through HTTP endpoints

```typescript
describe('User API E2E', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await TestServer.create();
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(async () => {
    await server.database.clean();
  });

  it('should handle user registration flow', async () => {
    const userData = {
      email: 'john@example.com',
      name: 'John Doe',
      password: 'SecurePassword123!'
    };

    // Register user
    const registerResponse = await request(server.app)
      .post('/api/users/register')
      .send(userData)
      .expect(201);

    expect(registerResponse.body).toMatchObject({
      id: expect.any(String),
      email: userData.email,
      name: userData.name
    });

    // Login
    const loginResponse = await request(server.app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      })
      .expect(200);

    expect(loginResponse.body).toHaveProperty('token');

    // Get profile
    const profileResponse = await request(server.app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${loginResponse.body.token}`)
      .expect(200);

    expect(profileResponse.body.email).toBe(userData.email);
  });
});
```

## Framework and Tooling

### Primary Framework: Vitest
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      lines: 80,
      functions: 75,
      branches: 80,
      statements: 80,
      exclude: [
        'dist/**',
        'coverage/**',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    },
    testTimeout: 10000,
    setupFiles: ['./tests/setup.ts']
  }
});
```

### Test Utilities and Helpers:
```typescript
// tests/helpers/TestApplication.ts
export class TestApplication {
  constructor(
    public infrastructure: InfrastructureContainer,
    public services: ApplicationServiceFactory
  ) {}

  static async create(config?: Partial<Configuration>): Promise<TestApplication> {
    const testConfig = createTestConfiguration(config);
    const infrastructure = new InfrastructureContainer(testConfig);
    const services = new ApplicationServiceFactory(infrastructure);
    
    await infrastructure.database.migrate();
    
    return new TestApplication(infrastructure, services);
  }

  async stop(): Promise<void> {
    await this.infrastructure.database.close();
  }
}

// tests/helpers/Mocked.ts
export function createMocked<T>(): jest.Mocked<T> {
  return {} as jest.Mocked<T>;
}

// tests/helpers/TestData.ts
export class UserTestDataBuilder {
  private email = 'test@example.com';
  private name = 'Test User';

  withEmail(email: string): this {
    this.email = email;
    return this;
  }

  withName(name: string): this {
    this.name = name;
    return this;
  }

  build(): CreateUserCommand {
    return new CreateUserCommand(this.email, this.name);
  }
}

export const testData = {
  user: () => new UserTestDataBuilder(),
  validEmail: () => Email.create('test@example.com').unwrap(),
  validUserId: () => UserId.create()
};
```

## Test Organization

### Directory Structure:
```
packages/
└── kernel/
    ├── src/
    │   ├── Entity.ts
    │   └── ValueObject.ts
    ├── tests/
    │   ├── unit/
    │   │   ├── Entity.test.ts
    │   │   └── ValueObject.test.ts
    │   ├── integration/
    │   │   └── DomainServices.test.ts
    │   └── helpers/
    │       └── TestBuilders.ts
    └── vitest.config.ts
```

### Test Naming Convention:
- **Unit tests**: `ClassName.test.ts`
- **Integration tests**: `FeatureName.integration.test.ts`
- **E2E tests**: `WorkflowName.e2e.test.ts`

### Test Categories with Tags:
```typescript
describe('User Entity', { tags: ['unit', 'domain'] }, () => {
  // Unit tests
});

describe('User Repository', { tags: ['integration', 'database'] }, () => {
  // Integration tests
});

describe('User API', { tags: ['e2e', 'api'] }, () => {
  // E2E tests
});
```

## TDD Workflow

### Red-Green-Refactor Cycle:
1. **Red**: Write failing test first
2. **Green**: Write minimal code to make test pass
3. **Refactor**: Improve code while keeping tests green

### Example TDD Session:
```typescript
// 1. RED: Write failing test
describe('Email ValueObject', () => {
  it('should validate email format', () => {
    const result = Email.create('invalid-email');
    expect(result.isFailure()).toBe(true);
  });
});

// 2. GREEN: Minimal implementation
export class Email extends ValueObject<string> {
  static create(value: string): Result<Email, ValidationError> {
    if (!value.includes('@')) {
      return Result.fail(new ValidationError('Invalid email format'));
    }
    return Result.ok(new Email(value));
  }
}

// 3. REFACTOR: Improve implementation
export class Email extends ValueObject<string> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  static create(value: string): Result<Email, ValidationError> {
    if (!this.EMAIL_REGEX.test(value)) {
      return Result.fail(new ValidationError('Invalid email format'));
    }
    return Result.ok(new Email(value));
  }
}
```

## Performance Testing

### Benchmark Tests:
```typescript
describe('Performance Tests', () => {
  it('should handle 1000 users creation under 100ms', async () => {
    const startTime = performance.now();
    
    const promises = Array.from({ length: 1000 }, (_, i) =>
      User.create(
        UserId.create(),
        Email.create(`user${i}@example.com`).unwrap(),
        UserName.create(`User ${i}`).unwrap()
      )
    );
    
    await Promise.all(promises);
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(100);
  });
});
```

### Memory Leak Detection:
```typescript
describe('Memory Tests', () => {
  it('should not leak memory during bulk operations', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < 10000; i++) {
      const user = User.create(/* ... */);
      // Process user
    }
    
    global.gc?.(); // Force garbage collection
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
  });
});
```

## CI/CD Integration

### GitHub Actions:
```yaml
# .github/workflows/test.yml
- name: Run Unit Tests
  run: pnpm test:unit --reporter=verbose --coverage

- name: Run Integration Tests
  run: pnpm test:integration
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

- name: Run E2E Tests
  run: pnpm test:e2e
  env:
    TEST_TIMEOUT: 30000
```

### Test Scripts:
```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest --run src/**/*.test.ts",
    "test:integration": "vitest --run tests/integration/**/*.test.ts",
    "test:e2e": "vitest --run tests/e2e/**/*.test.ts",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui"
  }
}
```

## Quality Gates

### Coverage Requirements:
- **Domain Layer**: 95% coverage (business logic is critical)
- **Application Layer**: 90% coverage (use cases are important)
- **Infrastructure Layer**: 80% coverage (adapters have external dependencies)
- **Overall Project**: 85% coverage

### Test Quality Metrics:
- **Mutation Testing Score**: 85%+ (using Stryker)
- **Test Execution Time**: <30 seconds for unit tests
- **Flaky Test Rate**: <1% (tests that fail intermittently)

## Consequences

### Positive:
- ✅ High confidence in code changes
- ✅ Early bug detection
- ✅ Living documentation through tests
- ✅ Faster development with TDD
- ✅ Better architecture through testability

### Negative:
- ❌ Initial time investment for test setup
- ❌ Test maintenance overhead
- ❌ Potential over-testing of simple code
- ❌ Learning curve for TDD practices

### Risk Mitigation:
- Test utilities and helpers to reduce boilerplate
- Clear testing guidelines and examples
- Regular test reviews and refactoring
- Automated test quality checks

## References
- [Test Pyramid by Martin Fowler](https://martinfowler.com/articles/practical-test-pyramid.html)
- [TDD by Example - Kent Beck](https://www.amazon.com/Test-Driven-Development-Kent-Beck/dp/0321146530)
- [Vitest Documentation](https://vitest.dev/)
- [Testing JavaScript Applications](https://testingjavascript.com/)
