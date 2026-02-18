# Usage Guide - TypeScript Commons Library

## Table of Contents

1. [Quick Start](#quick-start)
2. [Package Guide](#package-guide)
3. [Architecture Patterns](#architecture-patterns)
4. [Best Practices](#best-practices)
5. [Examples](#examples)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Installation

Install packages individually or use the meta-package:

```bash
# Install specific packages
pnpm add @acme/kernel @acme/application @acme/web

# Or install all at once (when meta-package is available)
pnpm add @acme/ts-commons
```

### Basic Setup

```typescript
// main.ts
import { Result } from '@acme/kernel';
import { InMemoryCommandBus, type Command, type CommandHandler } from '@acme/application';
import { HttpServer } from '@acme/web';
import { Logger } from '@acme/observability';

const logger = new Logger('MyApp');
const commandBus = new InMemoryCommandBus();
const server = new HttpServer({ port: 3000 });

logger.info('Application starting...');
```

---

## Package Guide

### @acme/kernel - Domain Foundation

The kernel package provides the building blocks for Domain-Driven Design.

#### Core Types

```typescript
import { 
  Entity, 
  ValueObject, 
  AggregateRoot, 
  DomainEvent,
  Result,
  Option 
} from '@acme/kernel';

// Domain Entity
class User extends Entity<UserId> {
  constructor(
    id: UserId,
    private _email: Email,
    private _username: Username
  ) {
    super(id);
  }
  
  get email(): Email { return this._email; }
  get username(): Username { return this._username; }
  
  changeEmail(newEmail: Email): Result<void, DomainError> {
    if (!newEmail.isValid()) {
      return Result.err(new InvalidEmailError(newEmail.value));
    }
    
    this._email = newEmail;
    this.recordEvent(new UserEmailChangedEvent(this.id, newEmail));
    return Result.ok(undefined);
  }
}

// Value Object
class Email extends ValueObject<string> {
  private constructor(email: string) {
    super(email);
  }
  
  static create(email: string): Result<Email, ValidationError> {
    if (!this.isValidEmail(email)) {
      return Result.err(new ValidationError('Invalid email format'));
    }
    return Result.ok(new Email(email));
  }
  
  isValid(): boolean {
    return Email.isValidEmail(this._value);
  }
  
  private static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

// Domain Event
class UserEmailChangedEvent implements DomainEvent {
  readonly occurredAt = new Date();
  readonly eventId = EventId.generate();
  
  constructor(
    public readonly userId: UserId,
    public readonly newEmail: Email
  ) {}
}
```

#### Result Pattern Usage

```typescript
// Chain operations safely
const result = Email.create(userInput.email)
  .flatMap(email => Username.create(userInput.username)
    .map(username => ({ email, username })))
  .flatMap(({ email, username }) => 
    User.create(UserId.generate(), email, username))
  .flatMap(user => userRepository.save(user));

if (result.isErr()) {
  logger.error('User creation failed', { error: result.error });
  return;
}

logger.info('User created successfully', { userId: result.value.id });
```

---

### @acme/application - Use Cases & CQRS

Implements application logic using Command Query Responsibility Segregation.

#### Commands

```typescript
import { BaseCommand, type CommandHandler, Result } from '@acme/application';

// Command
class CreateUserCommand extends BaseCommand {
  constructor(
    public readonly email: string,
    public readonly username: string
  ) {
    super();
  }
}

// Command Handler  
class CreateUserHandler implements CommandHandler<CreateUserCommand, UserId, DomainError> {
  constructor(
    private userRepository: UserRepository,
    private eventBus: EventBus
  ) {}
  
  async handle(command: CreateUserCommand): Promise<Result<UserId, DomainError>> {
    return Email.create(command.email)
      .flatMap(email => Username.create(command.username)
        .map(username => ({ email, username })))
      .flatMapAsync(async ({ email, username }) => {
        const userId = UserId.generate();
        const user = new User(userId, email, username);
        
        return this.userRepository.save(user)
          .flatMapAsync(async () => {
            // Publish domain events
            const events = user.getUncommittedEvents();
            await this.eventBus.publishAll(events);
            return Result.ok(userId);
          });
      });
  }
}
```

#### Queries

```typescript
import { BaseQuery, type QueryHandler } from '@acme/application';

// Query
class GetUserByIdQuery extends BaseQuery<UserDto> {
  constructor(public readonly userId: string) {
    super();
  }
}

// Query Handler
class GetUserByIdHandler implements QueryHandler<GetUserByIdQuery, UserDto, ApplicationError> {
  constructor(private userRepository: UserRepository) {}
  
  async handle(query: GetUserByIdQuery): Promise<Result<UserDto, ApplicationError>> {
    const userId = UserId.fromString(query.userId);
    const userOption = await this.userRepository.findById(userId);
    
    if (userOption.isNone()) {
      return Result.err(new UserNotFoundError(userId));
    }
    
    const user = userOption.value;
    const dto: UserDto = {
      id: user.id.toString(),
      email: user.email.value,
      username: user.username.value,
      createdAt: user.createdAt
    };
    
    return Result.ok(dto);
  }
}
```

#### Use Case Pattern

```typescript
import { UseCase, type UseCaseContext } from '@acme/application';

class RegisterUserUseCase extends UseCase<RegisterUserRequest, RegisterUserResponse> {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus
  ) {
    super();
  }
  
  async execute(
    request: RegisterUserRequest,
    context: UseCaseContext
  ): Promise<Result<RegisterUserResponse, ApplicationError>> {
    
    // Validate business rules
    const existingUser = await this.queryBus.dispatch(
      new GetUserByEmailQuery(request.email)
    );
    
    if (existingUser.isOk()) {
      return Result.err(new UserAlreadyExistsError(request.email));
    }
    
    // Execute command
    const createResult = await this.commandBus.dispatch(
      new CreateUserCommand(request.email, request.username)
    );
    
    return createResult.map(userId => ({
      userId: userId.toString(),
      message: 'User registered successfully'
    }));
  }
}
```

---

### @acme/web - HTTP Infrastructure

Provides HTTP adapters and middleware for web applications.

#### Express Integration

```typescript
import express from 'express';
import { 
  HttpContext, 
  CorrelationMiddleware, 
  ErrorHandlerMiddleware 
} from '@acme/web';

const app = express();

// Add correlation ID middleware
app.use(CorrelationMiddleware.create());

// Add error handling
app.use(ErrorHandlerMiddleware.create());

// Controller
app.post('/users', async (req, res) => {
  const context = HttpContext.fromRequest(req);
  
  const useCase = new RegisterUserUseCase(commandBus, queryBus);
  const result = await useCase.execute(req.body, context);
  
  if (result.isErr()) {
    return res.status(400).json({
      error: result.error.message,
      correlationId: context.correlationId.value
    });
  }
  
  res.status(201).json({
    data: result.value,
    correlationId: context.correlationId.value
  });
});
```

#### Fastify Integration

```typescript
import fastify from 'fastify';
import { HttpContext, FastifyCorrelationPlugin } from '@acme/web';

const server = fastify({ logger: true });

// Register correlation plugin
await server.register(FastifyCorrelationPlugin);

server.post<{
  Body: RegisterUserRequest;
  Reply: RegisterUserResponse;
}>('/users', async (request, reply) => {
  const context = HttpContext.fromFastifyRequest(request);
  
  const useCase = new RegisterUserUseCase(commandBus, queryBus);
  const result = await useCase.execute(request.body, context);
  
  if (result.isErr()) {
    return reply.code(400).send({
      error: result.error.message,
      correlationId: context.correlationId.value
    });
  }
  
  return reply.code(201).send({
    data: result.value,
    correlationId: context.correlationId.value
  });
});
```

---

### @acme/persistence - Data Access

Repository pattern implementation with multiple database adapters.

#### Repository Pattern

```typescript
import { Repository } from '@acme/persistence';

// Abstract repository (application layer)
export abstract class UserRepository extends Repository<User, UserId> {
  abstract findByEmail(email: Email): Promise<Option<User>>;
  abstract findByUsername(username: Username): Promise<Option<User>>;
}

// Concrete implementation (infrastructure layer)
import { TypeOrmUserRepository } from '@acme/persistence/typeorm';

export class UserRepositoryImpl extends TypeOrmUserRepository implements UserRepository {
  async findByEmail(email: Email): Promise<Option<User>> {
    const entity = await this.repository.findOne({
      where: { email: email.value }
    });
    
    if (!entity) {
      return Option.none();
    }
    
    return Option.some(this.toDomain(entity));
  }
  
  protected toDomain(entity: UserEntity): User {
    return new User(
      UserId.fromString(entity.id),
      Email.createUnsafe(entity.email),
      Username.createUnsafe(entity.username)
    );
  }
  
  protected toEntity(user: User): UserEntity {
    return {
      id: user.id.toString(),
      email: user.email.value,
      username: user.username.value,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
```

---

### @acme/messaging - Event Publishing

Supports multiple message brokers for domain event publishing.

#### Event Bus Setup

```typescript
import { EventBus, RabbitMQEventPublisher } from '@acme/messaging';

// Setup event bus
const eventPublisher = new RabbitMQEventPublisher({
  connectionString: 'amqp://localhost:5672',
  exchange: 'domain-events'
});

const eventBus = new EventBus(eventPublisher);

// Register event handlers
eventBus.subscribe(UserEmailChangedEvent, async (event) => {
  // Send welcome email
  await emailService.sendWelcomeEmail(event.userId, event.newEmail);
});

// In your command handler
class CreateUserHandler implements CommandHandler<CreateUserCommand, UserId, DomainError> {
  async handle(command: CreateUserCommand): Promise<Result<UserId, DomainError>> {
    // ... create user logic
    
    // Publish events
    const events = user.getUncommittedEvents();
    await this.eventBus.publishAll(events);
    user.markEventsAsCommitted();
    
    return Result.ok(user.id);
  }
}
```

---

### @acme/observability - Logging & Monitoring

Structured logging and metrics collection.

#### Logging

```typescript
import { Logger, LogLevel } from '@acme/observability';

const logger = new Logger('UserService', {
  level: LogLevel.INFO,
  correlationId: true,
  structured: true
});

// Structured logging
logger.info('User created', {
  userId: user.id.toString(),
  email: user.email.value,
  timestamp: new Date().toISOString()
});

// Error logging with context
logger.error('Failed to create user', {
  error: error.message,
  stack: error.stack,
  input: { email: command.email, username: command.username }
});
```

#### Metrics

```typescript
import { MetricsCollector, Counter, Histogram } from '@acme/observability';

const metrics = new MetricsCollector();

// Counters
const userCreationCounter = metrics.counter('users_created_total', {
  description: 'Total number of users created'
});

// Histograms
const requestDuration = metrics.histogram('http_request_duration_seconds', {
  description: 'HTTP request duration in seconds',
  buckets: [0.1, 0.5, 1, 2, 5]
});

// In your handlers
class CreateUserHandler {
  async handle(command: CreateUserCommand): Promise<Result<UserId, DomainError>> {
    const timer = requestDuration.startTimer();
    
    try {
      const result = await this.createUser(command);
      
      if (result.isOk()) {
        userCreationCounter.inc({ status: 'success' });
      } else {
        userCreationCounter.inc({ status: 'error' });
      }
      
      return result;
    } finally {
      timer();
    }
  }
}
```

---

## Architecture Patterns

### Dependency Injection

```typescript
// Container setup (composition root)
class ApplicationContainer {
  private constructor(
    public readonly userRepository: UserRepository,
    public readonly eventBus: EventBus,
    public readonly commandBus: CommandBus,
    public readonly queryBus: QueryBus
  ) {}
  
  static async create(config: ApplicationConfig): Promise<ApplicationContainer> {
    // Infrastructure
    const database = await Database.connect(config.database);
    const messageQueue = await MessageQueue.connect(config.messaging);
    
    // Repositories
    const userRepository = new UserRepositoryImpl(database);
    
    // Services
    const eventBus = new EventBus(new RabbitMQEventPublisher(messageQueue));
    
    // CQRS Buses
    const commandBus = new InMemoryCommandBus();
    const queryBus = new InMemoryQueryBus();
    
    // Register handlers
    commandBus.register(CreateUserCommand, new CreateUserHandler(userRepository, eventBus));
    queryBus.register(GetUserByIdQuery, new GetUserByIdHandler(userRepository));
    
    return new ApplicationContainer(
      userRepository,
      eventBus,
      commandBus,
      queryBus
    );
  }
}

// Application startup
async function bootstrap(): Promise<void> {
  const config = await ConfigurationBuilder.build();
  const container = await ApplicationContainer.create(config);
  
  const app = express();
  
  // Setup routes with container
  const userController = new UserController(
    container.commandBus,
    container.queryBus
  );
  
  app.use('/api/users', userController.router);
  
  const server = app.listen(config.server.port, () => {
    console.log(`Server running on port ${config.server.port}`);
  });
}
```

### Error Handling

```typescript
// Domain errors
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class UserNotFoundError extends DomainError {
  constructor(userId: UserId) {
    super(
      `User with ID ${userId.toString()} not found`,
      'USER_NOT_FOUND',
      { userId: userId.toString() }
    );
  }
}

// Error handling middleware
export class ErrorHandlerMiddleware {
  static create() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const correlationId = req.headers['x-correlation-id'] as string;
      
      if (error instanceof ValidationError) {
        return res.status(400).json({
          type: 'ValidationError',
          message: error.message,
          details: error.details,
          correlationId
        });
      }
      
      if (error instanceof DomainError) {
        return res.status(400).json({
          type: 'DomainError',
          message: error.message,
          code: error.code,
          correlationId
        });
      }
      
      // Unexpected errors
      logger.error('Unhandled error', { error, correlationId });
      
      res.status(500).json({
        type: 'InternalError',
        message: 'An unexpected error occurred',
        correlationId
      });
    };
  }
}
```

---

## Best Practices

### 1. Domain Modeling

```typescript
// ✅ Good: Rich domain models
class Order extends AggregateRoot<OrderId> {
  private constructor(
    id: OrderId,
    private _customerId: CustomerId,
    private _items: OrderItem[],
    private _status: OrderStatus,
    private _totalAmount: Money
  ) {
    super(id);
  }
  
  static create(customerId: CustomerId, items: OrderItem[]): Result<Order, DomainError> {
    if (items.length === 0) {
      return Result.err(new EmptyOrderError());
    }
    
    const totalAmount = Money.sum(items.map(item => item.totalPrice));
    
    if (totalAmount.isZero()) {
      return Result.err(new ZeroAmountOrderError());
    }
    
    const order = new Order(
      OrderId.generate(),
      customerId,
      items,
      OrderStatus.Pending,
      totalAmount
    );
    
    order.recordEvent(new OrderCreatedEvent(order.id, customerId, totalAmount));
    return Result.ok(order);
  }
  
  confirm(): Result<void, DomainError> {
    if (!this._status.canConfirm()) {
      return Result.err(new InvalidOrderStatusTransitionError(this._status, OrderStatus.Confirmed));
    }
    
    this._status = OrderStatus.Confirmed;
    this.recordEvent(new OrderConfirmedEvent(this.id));
    return Result.ok(undefined);
  }
}

// ❌ Bad: Anemic domain models
class Order {
  id: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  status: string;
  totalAmount: number;
}
```

### 2. Use Case Design

```typescript
// ✅ Good: Single responsibility, explicit dependencies
class ConfirmOrderUseCase extends UseCase<ConfirmOrderRequest, ConfirmOrderResponse> {
  constructor(
    private orderRepository: OrderRepository,
    private inventoryService: InventoryService,
    private paymentService: PaymentService,
    private eventBus: EventBus
  ) {
    super();
  }
  
  async execute(
    request: ConfirmOrderRequest,
    context: UseCaseContext
  ): Promise<Result<ConfirmOrderResponse, ApplicationError>> {
    
    const orderId = OrderId.fromString(request.orderId);
    
    // Load aggregate
    const orderOption = await this.orderRepository.findById(orderId);
    if (orderOption.isNone()) {
      return Result.err(new OrderNotFoundError(orderId));
    }
    const order = orderOption.value;
    
    // Check inventory
    const inventoryResult = await this.inventoryService.reserveItems(order.items);
    if (inventoryResult.isErr()) {
      return Result.err(inventoryResult.error);
    }
    
    // Process payment
    const paymentResult = await this.paymentService.processPayment(
      order.customerId,
      order.totalAmount
    );
    if (paymentResult.isErr()) {
      // Rollback inventory
      await this.inventoryService.releaseReservation(inventoryResult.value);
      return Result.err(paymentResult.error);
    }
    
    // Confirm order
    const confirmResult = order.confirm();
    if (confirmResult.isErr()) {
      return Result.err(new ApplicationError(confirmResult.error.message));
    }
    
    // Save and publish events
    await this.orderRepository.save(order);
    await this.eventBus.publishAll(order.getUncommittedEvents());
    
    return Result.ok({
      orderId: order.id.toString(),
      status: order.status.value,
      confirmedAt: new Date()
    });
  }
}
```

### 3. Repository Implementation

```typescript
// ✅ Good: Domain-focused, proper abstractions
export abstract class OrderRepository extends Repository<Order, OrderId> {
  abstract findByCustomerId(customerId: CustomerId): Promise<Order[]>;
  abstract findPendingOrders(): Promise<Order[]>;
  abstract findByDateRange(startDate: Date, endDate: Date): Promise<Order[]>;
}

export class PostgreSQLOrderRepository extends OrderRepository {
  constructor(private database: Database) {
    super();
  }
  
  async findById(id: OrderId): Promise<Option<Order>> {
    const query = `
      SELECT o.*, oi.* 
      FROM orders o 
      LEFT JOIN order_items oi ON o.id = oi.order_id 
      WHERE o.id = $1
    `;
    
    const result = await this.database.query(query, [id.toString()]);
    
    if (result.rows.length === 0) {
      return Option.none();
    }
    
    return Option.some(this.mapToDomain(result.rows));
  }
  
  private mapToDomain(rows: any[]): Order {
    const orderData = rows[0];
    const items = rows
      .filter(row => row.product_id)
      .map(row => OrderItem.create(
        ProductId.fromString(row.product_id),
        Quantity.create(row.quantity),
        Money.create(row.price, Currency.fromString(row.currency))
      ));
    
    return Order.reconstitute(
      OrderId.fromString(orderData.id),
      CustomerId.fromString(orderData.customer_id),
      items,
      OrderStatus.fromString(orderData.status),
      Money.create(orderData.total_amount, Currency.fromString(orderData.currency))
    );
  }
}
```

---

## Examples

### Complete Microservice Example

```typescript
// domain/entities/Customer.ts
export class Customer extends AggregateRoot<CustomerId> {
  constructor(
    id: CustomerId,
    private _email: Email,
    private _name: CustomerName,
    private _isActive: boolean = true
  ) {
    super(id);
  }
  
  static create(email: Email, name: CustomerName): Customer {
    const customer = new Customer(
      CustomerId.generate(),
      email,
      name
    );
    
    customer.recordEvent(new CustomerCreatedEvent(customer.id, email, name));
    return customer;
  }
  
  deactivate(): Result<void, DomainError> {
    if (!this._isActive) {
      return Result.err(new CustomerAlreadyDeactivatedError(this.id));
    }
    
    this._isActive = false;
    this.recordEvent(new CustomerDeactivatedEvent(this.id));
    return Result.ok(undefined);
  }
}

// application/usecases/CreateCustomerUseCase.ts
export class CreateCustomerUseCase extends UseCase<CreateCustomerRequest, CreateCustomerResponse> {
  constructor(
    private customerRepository: CustomerRepository,
    private eventBus: EventBus
  ) {
    super();
  }
  
  async execute(
    request: CreateCustomerRequest,
    context: UseCaseContext
  ): Promise<Result<CreateCustomerResponse, ApplicationError>> {
    
    const emailResult = Email.create(request.email);
    if (emailResult.isErr()) {
      return Result.err(new ValidationError(emailResult.error.message));
    }
    
    const nameResult = CustomerName.create(request.name);
    if (nameResult.isErr()) {
      return Result.err(new ValidationError(nameResult.error.message));
    }
    
    // Check if customer already exists
    const existingCustomer = await this.customerRepository.findByEmail(emailResult.value);
    if (existingCustomer.isSome()) {
      return Result.err(new CustomerAlreadyExistsError(emailResult.value));
    }
    
    // Create customer
    const customer = Customer.create(emailResult.value, nameResult.value);
    
    // Save to repository
    const saveResult = await this.customerRepository.save(customer);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError(saveResult.error.message));
    }
    
    // Publish domain events
    await this.eventBus.publishAll(customer.getUncommittedEvents());
    
    return Result.ok({
      customerId: customer.id.toString(),
      email: customer.email.value,
      name: customer.name.value,
      createdAt: customer.createdAt
    });
  }
}

// infrastructure/web/CustomerController.ts
export class CustomerController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus
  ) {}
  
  get router(): Router {
    const router = express.Router();
    
    router.post('/', this.createCustomer.bind(this));
    router.get('/:id', this.getCustomer.bind(this));
    router.delete('/:id', this.deactivateCustomer.bind(this));
    
    return router;
  }
  
  async createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = HttpContext.fromRequest(req);
      const useCase = new CreateCustomerUseCase(
        this.customerRepository,
        this.eventBus
      );
      
      const result = await useCase.execute(req.body, context);
      
      if (result.isErr()) {
        return next(result.error);
      }
      
      res.status(201).json({
        data: result.value,
        correlationId: context.correlationId.value
      });
    } catch (error) {
      next(error);
    }
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. TypeScript Compilation Errors

```typescript
// Error: Cannot find module '@acme/kernel'
// Solution: Check tsconfig.json paths configuration
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@acme/*": ["packages/*/src"]
    }
  }
}
```

#### 2. Circular Dependencies

```typescript
// ❌ Problematic: Circular imports between domain and application
// domain/User.ts
import { UserRepository } from '../application/UserRepository';

// application/UserRepository.ts  
import { User } from '../domain/User';

// ✅ Solution: Use dependency inversion
// domain/User.ts - No application layer imports
export class User extends AggregateRoot<UserId> {
  // ... domain logic only
}

// application/ports/UserRepository.ts - Abstract port
export abstract class UserRepository {
  abstract save(user: User): Promise<Result<void, RepositoryError>>;
}

// infrastructure/UserRepositoryImpl.ts - Concrete implementation
export class UserRepositoryImpl extends UserRepository {
  // ... implementation
}
```

#### 3. Event Ordering Issues

```typescript
// ❌ Problem: Events published before persistence
await this.eventBus.publishAll(order.getUncommittedEvents());
await this.orderRepository.save(order); // Might fail after events published

// ✅ Solution: Transactional outbox pattern
await this.unitOfWork.begin();
try {
  await this.orderRepository.save(order);
  await this.outboxRepository.saveEvents(order.getUncommittedEvents());
  await this.unitOfWork.commit();
  
  // Publish events asynchronously after transaction
  this.eventPublisher.publishLater(order.getUncommittedEvents());
} catch (error) {
  await this.unitOfWork.rollback();
  throw error;
}
```

#### 4. Memory Leaks in Event Handlers

```typescript
// ❌ Problem: Event handlers not properly cleaned up
eventBus.subscribe(OrderCreatedEvent, handler); // No cleanup

// ✅ Solution: Proper subscription management
const subscription = eventBus.subscribe(OrderCreatedEvent, handler);

// In cleanup/shutdown
subscription.unsubscribe();

// Or use scoped subscriptions
class OrderService {
  private subscriptions: EventSubscription[] = [];
  
  constructor(private eventBus: EventBus) {
    this.subscriptions.push(
      eventBus.subscribe(OrderCreatedEvent, this.handleOrderCreated.bind(this))
    );
  }
  
  dispose(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }
}
```

### Performance Optimization

#### 1. Repository Query Optimization

```typescript
// ❌ N+1 Query Problem
async getOrdersWithCustomers(customerIds: CustomerId[]): Promise<Order[]> {
  const orders: Order[] = [];
  
  for (const customerId of customerIds) {
    const customerOrders = await this.orderRepository.findByCustomerId(customerId);
    orders.push(...customerOrders);
  }
  
  return orders;
}

// ✅ Batch Loading
async getOrdersWithCustomers(customerIds: CustomerId[]): Promise<Order[]> {
  const query = `
    SELECT o.*, c.name as customer_name, c.email as customer_email
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE o.customer_id = ANY($1)
  `;
  
  const result = await this.database.query(query, [customerIds.map(id => id.toString())]);
  return result.rows.map(row => this.mapToDomainWithCustomer(row));
}
```

#### 2. Event Publishing Optimization

```typescript
// ❌ Synchronous event publishing blocks request
await this.eventBus.publishAll(events); // Blocks until all handlers complete

// ✅ Asynchronous event publishing
this.eventBus.publishAllAsync(events); // Fire and forget

// Or with reliability guarantees
await this.outboxService.scheduleEvents(events); // Transactional outbox
```

---

## Configuration Examples

### Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/myapp
      - RABBITMQ_URL=amqp://rabbitmq:5672
    depends_on:
      - postgres
      - rabbitmq
      - redis
    
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "15672:15672"
    
  redis:
    image: redis:7-alpine
    
volumes:
  postgres_data:
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ts-commons-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ts-commons-app
  template:
    metadata:
      labels:
        app: ts-commons-app
    spec:
      containers:
      - name: app
        image: myregistry/ts-commons-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: RABBITMQ_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: rabbitmq-url
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

---

## Migration from Legacy Systems

### Database Migration

```typescript
// migrations/001_create_users_table.ts
import { Migration } from '@acme/persistence/migrations';

export class CreateUsersTable extends Migration {
  async up(): Promise<void> {
    await this.database.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_username ON users(username);
      CREATE INDEX idx_users_active ON users(is_active);
    `);
  }
  
  async down(): Promise<void> {
    await this.database.query('DROP TABLE users CASCADE');
  }
}
```

### API Migration

```typescript
// Legacy API adapter
export class LegacyUserApiAdapter {
  constructor(
    private createUserUseCase: CreateUserUseCase,
    private getUserUseCase: GetUserUseCase
  ) {}
  
  // Legacy endpoint: POST /legacy/users
  async createUserLegacy(legacyRequest: LegacyCreateUserRequest): Promise<LegacyUserResponse> {
    // Transform legacy request format
    const modernRequest: CreateUserRequest = {
      email: legacyRequest.user_email,
      username: legacyRequest.user_name,
      firstName: legacyRequest.first_name,
      lastName: legacyRequest.last_name
    };
    
    const context = UseCaseContext.create();
    const result = await this.createUserUseCase.execute(modernRequest, context);
    
    if (result.isErr()) {
      throw new LegacyApiError(result.error.message, this.mapErrorCode(result.error));
    }
    
    // Transform to legacy response format
    return {
      user_id: result.value.userId,
      user_email: result.value.email,
      user_name: result.value.username,
      status: 'success',
      created_timestamp: result.value.createdAt.getTime()
    };
  }
}
```

---

This usage guide provides comprehensive examples and patterns for effectively using the TypeScript Commons library in your projects. For more detailed API documentation, refer to the generated [API Documentation](./api/index.html).
