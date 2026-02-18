# ADR-0010: Error Handling Patterns

## Status
**Accepted** - 18/02/2026

## Context
Our Clean Architecture implementation needs consistent error handling patterns that work across all layers while maintaining type safety and avoiding exception-based control flow.

## Decision
We will use **Railway-Oriented Programming** with `Result<T, E>` types and **Problem Details** (RFC 7807) for API errors, avoiding throwing exceptions in business logic.

## Core Patterns

### 1. Result Type for Business Logic
```typescript
// Core Result type
export abstract class Result<T, E> {
  abstract isSuccess(): boolean;
  abstract isFailure(): boolean;
  abstract value(): T;
  abstract error(): E;

  static ok<T>(value: T): Ok<T> {
    return new Ok(value);
  }

  static fail<E>(error: E): Fail<E> {
    return new Fail(error);
  }

  // Monadic operations
  map<U>(fn: (value: T) => U): Result<U, E> {
    return this.isSuccess() 
      ? Result.ok(fn(this.value()))
      : Result.fail(this.error());
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return this.isSuccess()
      ? fn(this.value())
      : Result.fail(this.error());
  }

  mapError<F>(fn: (error: E) => F): Result<T, F> {
    return this.isFailure()
      ? Result.fail(fn(this.error()))
      : Result.ok(this.value());
  }
}
```

### 2. Domain Error Hierarchy
```typescript
// Base domain error
export abstract class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Specific domain errors
export class ValidationError extends DomainError {
  constructor(field: string, value: unknown, rule: string) {
    super(
      `Validation failed for field '${field}': ${rule}`,
      'VALIDATION_ERROR',
      { field, value, rule }
    );
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(rule: string, context?: Record<string, unknown>) {
    super(
      `Business rule violation: ${rule}`,
      'BUSINESS_RULE_VIOLATION',
      context
    );
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entityType: string, id: string) {
    super(
      `${entityType} with id '${id}' not found`,
      'ENTITY_NOT_FOUND',
      { entityType, id }
    );
  }
}
```

### 3. Application Layer Error Handling
```typescript
// Application errors
export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

// Use case with error handling
export class CreateUserUseCase {
  async execute(command: CreateUserCommand): Promise<Result<UserId, ApplicationError>> {
    try {
      // Validate input
      const emailResult = Email.create(command.email);
      if (emailResult.isFailure()) {
        return Result.fail(new ApplicationError(
          'Invalid email provided',
          'INVALID_INPUT',
          emailResult.error(),
          { field: 'email' }
        ));
      }

      const nameResult = UserName.create(command.name);
      if (nameResult.isFailure()) {
        return Result.fail(new ApplicationError(
          'Invalid name provided',
          'INVALID_INPUT',
          nameResult.error(),
          { field: 'name' }
        ));
      }

      // Check business rules
      const existingUser = await this.userRepository.findByEmail(emailResult.value());
      if (existingUser.isSome()) {
        return Result.fail(new ApplicationError(
          'User already exists with this email',
          'USER_ALREADY_EXISTS',
          undefined,
          { email: command.email }
        ));
      }

      // Create and save user
      const user = User.create(
        UserId.create(),
        emailResult.value(),
        nameResult.value()
      );

      const saveResult = await this.userRepository.save(user);
      if (saveResult.isFailure()) {
        return Result.fail(new ApplicationError(
          'Failed to save user',
          'REPOSITORY_ERROR',
          saveResult.error()
        ));
      }

      // Publish event
      await this.eventPublisher.publish(
        new UserCreatedEvent(user.id, user.email, user.name)
      );

      return Result.ok(user.id);

    } catch (error) {
      // Handle unexpected errors
      this.logger.error('Unexpected error in CreateUserUseCase', { error });
      return Result.fail(new ApplicationError(
        'An unexpected error occurred',
        'UNEXPECTED_ERROR',
        error as Error
      ));
    }
  }
}
```

### 4. Infrastructure Error Mapping
```typescript
// Infrastructure errors
export class InfrastructureError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'InfrastructureError';
  }
}

// Repository implementation
export class PostgresUserRepository implements UserRepository {
  async save(user: User): Promise<Result<void, InfrastructureError>> {
    try {
      await this.database.query(
        'INSERT INTO users (id, email, name) VALUES ($1, $2, $3)',
        [user.id.value, user.email.value, user.name.value]
      );
      return Result.ok(undefined);

    } catch (error) {
      if (error instanceof DatabaseError) {
        // Map database-specific errors
        if (error.code === 'unique_violation') {
          return Result.fail(new InfrastructureError(
            'User already exists',
            'DUPLICATE_USER',
            error,
            false
          ));
        }
        
        if (error.code === 'connection_failure') {
          return Result.fail(new InfrastructureError(
            'Database connection failed',
            'CONNECTION_ERROR',
            error,
            true // Retryable
          ));
        }
      }

      return Result.fail(new InfrastructureError(
        'Database operation failed',
        'DATABASE_ERROR',
        error as Error,
        true
      ));
    }
  }
}
```

### 5. Web Layer Error Translation
```typescript
// HTTP Error mapping
export class HttpErrorMapper {
  static toHttpResponse(error: ApplicationError): HttpResponse {
    const problemDetails = this.toProblemDetails(error);
    return new HttpResponse(
      this.getHttpStatusCode(error),
      problemDetails
    );
  }

  private static toProblemDetails(error: ApplicationError): ProblemDetails {
    const baseDetails = {
      type: `https://api.example.com/errors/${error.code.toLowerCase()}`,
      title: this.getTitle(error.code),
      status: this.getHttpStatusCode(error),
      detail: error.message,
      instance: `/api/users`, // API endpoint
    };

    // Add specific details based on error type
    switch (error.code) {
      case 'VALIDATION_ERROR':
        return {
          ...baseDetails,
          errors: this.extractValidationErrors(error)
        };

      case 'USER_ALREADY_EXISTS':
        return {
          ...baseDetails,
          conflictingFields: ['email']
        };

      default:
        return baseDetails;
    }
  }

  private static getHttpStatusCode(error: ApplicationError): number {
    switch (error.code) {
      case 'INVALID_INPUT':
      case 'VALIDATION_ERROR':
        return 400; // Bad Request

      case 'USER_ALREADY_EXISTS':
        return 409; // Conflict

      case 'ENTITY_NOT_FOUND':
        return 404; // Not Found

      case 'UNAUTHORIZED':
        return 401; // Unauthorized

      case 'FORBIDDEN':
        return 403; // Forbidden

      case 'CONNECTION_ERROR':
      case 'DATABASE_ERROR':
        return 503; // Service Unavailable

      default:
        return 500; // Internal Server Error
    }
  }
}

// Express middleware
export function errorHandlerMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof ApplicationError) {
    const httpResponse = HttpErrorMapper.toHttpResponse(error);
    res.status(httpResponse.status).json(httpResponse.body);
    return;
  }

  // Handle unexpected errors
  logger.error('Unexpected error', { error, requestId: req.id });
  
  res.status(500).json({
    type: 'https://api.example.com/errors/internal-server-error',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred',
    instance: req.path,
    traceId: req.traceId
  });
}
```

## Railway-Oriented Programming Patterns

### Chaining Operations:
```typescript
export class UserService {
  async updateUserProfile(
    userId: string, 
    profileData: UpdateProfileData
  ): Promise<Result<User, ApplicationError>> {
    return UserId.fromString(userId)
      .flatMap(id => this.userRepository.findById(id))
      .flatMap(user => this.validateProfileData(profileData, user))
      .flatMap(updatedUser => this.userRepository.save(updatedUser))
      .map(user => {
        this.eventPublisher.publish(new UserProfileUpdatedEvent(user));
        return user;
      });
  }

  private validateProfileData(
    data: UpdateProfileData, 
    user: User
  ): Result<User, ApplicationError> {
    const emailResult = data.email 
      ? Email.create(data.email)
      : Result.ok(user.email);

    const nameResult = data.name
      ? UserName.create(data.name) 
      : Result.ok(user.name);

    // Combine results
    return Result.combine(emailResult, nameResult)
      .map(([email, name]) => user.updateProfile(email, name));
  }
}

// Result utility for combining multiple results
export class Result {
  static combine<T1, T2, E>(
    result1: Result<T1, E>,
    result2: Result<T2, E>
  ): Result<[T1, T2], E> {
    if (result1.isFailure()) return Result.fail(result1.error());
    if (result2.isFailure()) return Result.fail(result2.error());
    return Result.ok([result1.value(), result2.value()]);
  }
}
```

### Error Recovery:
```typescript
export class UserService {
  async getUserWithFallback(userId: string): Promise<Result<User, ApplicationError>> {
    const primaryResult = await this.primaryRepository.findById(userId);
    
    if (primaryResult.isSuccess()) {
      return primaryResult;
    }

    // Try fallback source
    this.logger.warn('Primary repository failed, trying cache', {
      userId,
      error: primaryResult.error()
    });

    const cacheResult = await this.cacheRepository.findById(userId);
    
    if (cacheResult.isSuccess()) {
      return cacheResult;
    }

    // Both failed
    return Result.fail(new ApplicationError(
      'User not found in any source',
      'USER_NOT_FOUND',
      undefined,
      { userId, attempts: ['primary', 'cache'] }
    ));
  }
}
```

## Async Error Handling

### Promise-based Operations:
```typescript
export class AsyncOperationService {
  async processUserBatch(
    userIds: string[]
  ): Promise<Result<ProcessingSummary, ApplicationError>> {
    const results = await Promise.allSettled(
      userIds.map(id => this.processUser(id))
    );

    const successful: string[] = [];
    const failed: Array<{ id: string; error: ApplicationError }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.isSuccess()) {
        successful.push(userIds[index]);
      } else {
        const error = result.status === 'fulfilled' 
          ? result.value.error()
          : new ApplicationError('Processing failed', 'PROCESSING_ERROR', result.reason);
        
        failed.push({ id: userIds[index], error });
      }
    });

    const summary = new ProcessingSummary(successful, failed);
    
    if (failed.length === userIds.length) {
      return Result.fail(new ApplicationError(
        'All users failed to process',
        'BATCH_PROCESSING_FAILED',
        undefined,
        summary
      ));
    }

    return Result.ok(summary);
  }
}
```

### Circuit Breaker Pattern:
```typescript
export class CircuitBreakerService {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  async callWithCircuitBreaker<T>(
    operation: () => Promise<Result<T, InfrastructureError>>
  ): Promise<Result<T, ApplicationError>> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.timeout) {
        return Result.fail(new ApplicationError(
          'Circuit breaker is open',
          'CIRCUIT_BREAKER_OPEN',
          undefined,
          { state: this.state, failures: this.failures }
        ));
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      
      if (result.isSuccess()) {
        this.onSuccess();
        return result;
      } else {
        this.onFailure();
        return Result.fail(new ApplicationError(
          'Operation failed',
          'OPERATION_FAILED',
          result.error()
        ));
      }
    } catch (error) {
      this.onFailure();
      return Result.fail(new ApplicationError(
        'Unexpected error in circuit breaker',
        'CIRCUIT_BREAKER_ERROR',
        error as Error
      ));
    }
  }
}
```

## Testing Error Scenarios

### Unit Tests for Error Paths:
```typescript
describe('CreateUserUseCase Error Handling', () => {
  it('should return validation error for invalid email', async () => {
    const command = new CreateUserCommand('invalid-email', 'John Doe');
    
    const result = await useCase.execute(command);
    
    expect(result.isFailure()).toBe(true);
    expect(result.error().code).toBe('INVALID_INPUT');
    expect(result.error().details).toMatchObject({ field: 'email' });
  });

  it('should handle repository failure gracefully', async () => {
    const command = new CreateUserCommand('john@example.com', 'John Doe');
    mockRepository.save.mockResolvedValue(
      Result.fail(new InfrastructureError('Database down', 'DB_ERROR'))
    );
    
    const result = await useCase.execute(command);
    
    expect(result.isFailure()).toBe(true);
    expect(result.error().code).toBe('REPOSITORY_ERROR');
    expect(result.error().cause).toBeInstanceOf(InfrastructureError);
  });
});
```

## Consequences

### Positive:
- ✅ **Type-safe error handling**: Compile-time error path validation
- ✅ **No hidden exceptions**: All errors are explicit in return types
- ✅ **Composable operations**: Railway-oriented programming enables chaining
- ✅ **Clear error boundaries**: Each layer handles its own error types
- ✅ **Testable error paths**: Easy to test both success and failure scenarios

### Negative:
- ❌ **Learning curve**: Developers need to understand Result patterns
- ❌ **Verbose code**: More code required compared to exception throwing
- ❌ **Performance overhead**: Additional object allocations for Results
- ❌ **Integration challenges**: Interfacing with exception-based libraries

### Risk Mitigation:
- Comprehensive documentation and examples
- Utility functions to reduce boilerplate
- Training sessions on Result patterns
- Gradual migration from existing exception-based code

## Performance Considerations

### Result Pooling:
```typescript
// Optimize frequent Result allocations
const OK_VOID = Result.ok(undefined);
const COMMON_ERRORS = new Map<string, Result<never, ApplicationError>>();

export function cachedError(code: string, message: string): Result<never, ApplicationError> {
  if (!COMMON_ERRORS.has(code)) {
    COMMON_ERRORS.set(code, Result.fail(new ApplicationError(message, code)));
  }
  return COMMON_ERRORS.get(code)!;
}
```

## References
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/)
- [RFC 7807 - Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
- [Functional Error Handling](https://blog.logrocket.com/functional-error-handling-with-express-js-and-ddd/)
- [Result Pattern in TypeScript](https://khalilstemmler.com/articles/enterprise-typescript-nodejs/handling-errors-result-class/)
