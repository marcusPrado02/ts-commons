import type { StoryModule } from '../story/StoryTypes';

// ---------------------------------------------------------------------------
// DomainError — base error type for domain layer violations
// ---------------------------------------------------------------------------

class DomainError extends Error {
  readonly code: string;
  readonly context: Record<string, unknown>;

  constructor(message: string, code: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.context = context;
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, message: this.message, code: this.code, context: this.context };
  }
}

export const DomainErrorModule: StoryModule<DomainError> = {
  meta: {
    title: 'DomainError',
    description: 'Base error type for domain-layer violations.',
    component: 'DomainError',
    tags: ['errors', 'ddd', 'domain'],
    create: () => new DomainError('Order not found', 'ORDER_NOT_FOUND', { orderId: '123' }),
  },
  stories: [
    {
      name: 'name is DomainError',
      description: 'The error name property identifies the type.',
      args: {},
      execute: (subject) => subject.name,
      expectedOutcome: 'DomainError',
    },
    {
      name: 'message is preserved',
      description: 'The human-readable message passed to constructor is accessible.',
      args: {},
      execute: (subject) => subject.message,
      expectedOutcome: 'Order not found',
    },
    {
      name: 'code carries machine-readable identifier',
      description: 'code is used for programmatic error handling.',
      args: {},
      execute: (subject) => subject.code,
      expectedOutcome: 'ORDER_NOT_FOUND',
    },
    {
      name: 'context carries diagnostic data',
      description: 'Extra context is stored for logging/tracing.',
      args: {},
      execute: (subject) => subject.context['orderId'],
      expectedOutcome: '123',
    },
    {
      name: 'toJSON produces a plain object',
      description: 'Serialization via toJSON includes all fields.',
      args: {},
      execute: (subject): unknown => {
        const obj = subject.toJSON();
        return `${String(obj['name'])}-${String(obj['code'])}`;
      },
      expectedOutcome: 'DomainError-ORDER_NOT_FOUND',
    },
    {
      name: 'instanceof Error is true',
      description: 'DomainError extends Error so it is an Error instance.',
      args: {},
      execute: (subject) => subject instanceof Error,
      expectedOutcome: 'true',
    },
  ],
};

// ---------------------------------------------------------------------------
// ValidationError — errors caused by invalid input
// ---------------------------------------------------------------------------

interface ValidationViolation {
  readonly field: string;
  readonly message: string;
}

class ValidationError extends Error {
  readonly violations: readonly ValidationViolation[];

  constructor(violations: ValidationViolation[]) {
    super(`Validation failed with ${violations.length} violation(s)`);
    this.name = 'ValidationError';
    this.violations = violations;
  }

  hasViolation(field: string): boolean {
    return this.violations.some((v) => v.field === field);
  }

  getViolation(field: string): ValidationViolation | undefined {
    return this.violations.find((v) => v.field === field);
  }

  violationCount(): number {
    return this.violations.length;
  }
}

function buildValidationError(): ValidationError {
  return new ValidationError([
    { field: 'email', message: 'must be a valid email' },
    { field: 'age', message: 'must be >= 0' },
  ]);
}

export const ValidationErrorModule: StoryModule<ValidationError> = {
  meta: {
    title: 'ValidationError',
    description: 'Aggregates multiple field-level violations into a single error.',
    component: 'ValidationError',
    tags: ['errors', 'validation', 'input'],
    create: buildValidationError,
  },
  stories: [
    {
      name: 'name is ValidationError',
      description: 'Error name identifies the error class.',
      args: {},
      execute: (subject) => subject.name,
      expectedOutcome: 'ValidationError',
    },
    {
      name: 'message summarises violation count',
      description: 'Message includes the number of violations.',
      args: {},
      execute: (subject) => subject.message,
      expectedOutcome: 'Validation failed with 2 violation(s)',
    },
    {
      name: 'hasViolation finds existing field',
      description: 'hasViolation returns true for a field that failed.',
      args: {},
      execute: (subject) => subject.hasViolation('email'),
      expectedOutcome: 'true',
    },
    {
      name: 'hasViolation returns false for absent field',
      description: 'hasViolation returns false when the field is clean.',
      args: {},
      execute: (subject) => subject.hasViolation('name'),
      expectedOutcome: 'false',
    },
    {
      name: 'getViolation returns violation message',
      description: 'Retrieve the message for a specific failing field.',
      args: {},
      execute: (subject): unknown => {
        const v = subject.getViolation('age');
        return v !== undefined ? v.message : '';
      },
      expectedOutcome: 'must be >= 0',
    },
    {
      name: 'violationCount returns total violations',
      description: 'Total number of violations collected.',
      args: {},
      execute: (subject) => subject.violationCount(),
      expectedOutcome: '2',
    },
  ],
};

// ---------------------------------------------------------------------------
// NotFoundError — resource could not be located
// ---------------------------------------------------------------------------

class NotFoundError extends Error {
  readonly resource: string;
  readonly identifier: string | number;

  constructor(resource: string, identifier: string | number) {
    super(`${resource} with id '${String(identifier)}' was not found`);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.identifier = identifier;
  }

  isSameResource(resource: string): boolean {
    return this.resource === resource;
  }
}

export const NotFoundErrorModule: StoryModule<NotFoundError> = {
  meta: {
    title: 'NotFoundError',
    description: 'Signals that a requested resource does not exist.',
    component: 'NotFoundError',
    tags: ['errors', 'not-found', 'http'],
    create: () => new NotFoundError('User', 'user-42'),
  },
  stories: [
    {
      name: 'name is NotFoundError',
      description: 'Error name identifies the error class.',
      args: {},
      execute: (subject) => subject.name,
      expectedOutcome: 'NotFoundError',
    },
    {
      name: 'message includes resource and identifier',
      description: 'Human-readable message is generated from constructor args.',
      args: {},
      execute: (subject) => subject.message,
      expectedOutcome: "User with id 'user-42' was not found",
    },
    {
      name: 'resource property is accessible',
      description: 'The resource name is stored for programmatic access.',
      args: {},
      execute: (subject) => subject.resource,
      expectedOutcome: 'User',
    },
    {
      name: 'identifier property is accessible',
      description: 'The missing identifier is stored for logging.',
      args: {},
      execute: (subject) => subject.identifier,
      expectedOutcome: 'user-42',
    },
    {
      name: 'isSameResource matches same type',
      description: 'Useful for filtering errors by domain aggregate.',
      args: {},
      execute: (subject) => subject.isSameResource('User'),
      expectedOutcome: 'true',
    },
    {
      name: 'isSameResource rejects different type',
      description: 'Returns false for a non-matching resource name.',
      args: {},
      execute: (subject) => subject.isSameResource('Order'),
      expectedOutcome: 'false',
    },
  ],
};
