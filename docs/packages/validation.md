# @marcusprado02/validation

Schema and business-rule validation. Returns typed `Result<T, ValidationError>` — never throws.

**Install:** `pnpm add @marcusprado02/validation @marcusprado02/kernel`

---

## `ZodValidator`

Wraps a Zod schema as a `ValidatorPort`. Returns `Ok<ValidatedInput>` or `Err<ValidationError>` with a full list of field errors.

```typescript
import { ZodValidator } from '@marcusprado02/validation';
import { z } from 'zod';

const placeOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().positive(),
        price: z.number().positive(),
      }),
    )
    .min(1, 'Order must have at least one item'),
  couponCode: z.string().optional(),
});

const validator = new ZodValidator(placeOrderSchema);

const result = validator.validate(rawInput);

result.match({
  ok: (input) => placeOrderUseCase.execute(input),
  err: (error) =>
    reply.status(422).send({
      error: 'Validation failed',
      fields: error.fields, // [{ field: 'customerId', message: 'Invalid UUID' }]
    }),
});
```

---

## `CompositeValidator` — Chaining Multiple Rules

Runs validators in sequence. Short-circuits on the first failure (default) or collects all errors.

```typescript
import { CompositeValidator } from '@marcusprado02/validation';

// 1. Schema validator — checks shape and types
// 2. Business rule validator — checks domain rules (e.g. customer not blocked)
const validator = new CompositeValidator<PlaceOrderInput>([
  new ZodValidator(schema),
  new CustomerNotBlockedValidator(customerRepo),
  new StockAvailableValidator(stockService),
]);

const result = await validator.validate(input);
```

---

## Custom Validators

Implement `ValidatorPort<T>` to create reusable business rule validators:

```typescript
import type { ValidatorPort, ValidationError } from '@marcusprado02/validation';
import { Result } from '@marcusprado02/kernel';

export class CustomerNotBlockedValidator implements ValidatorPort<PlaceOrderInput> {
  constructor(private readonly customerRepo: CustomerRepository) {}

  async validate(input: PlaceOrderInput): Promise<Result<PlaceOrderInput, ValidationError>> {
    const customer = await this.customerRepo.findById(input.customerId);

    if (!customer) {
      return Result.err(ValidationError.field('customerId', 'Customer not found'));
    }

    if (customer.isBlocked) {
      return Result.err(ValidationError.field('customerId', 'Customer account is blocked'));
    }

    return Result.ok(input);
  }
}
```

---

## Integration with `Mediator`

Use `ValidationBehavior` to run validation automatically before any handler:

```typescript
import { Mediator, ValidationBehavior } from '@marcusprado02/application';

const mediator = new Mediator([
  new ValidationBehavior(validator),
  // other behaviors...
]);

// ValidationBehavior checks request.validator if the request has one
// Returns Err<ValidationError> before reaching the handler if invalid
```

---

## Summary

| Export                  | Purpose                            |
| ----------------------- | ---------------------------------- |
| `ZodValidator<T>`       | Validate with a Zod schema         |
| `CompositeValidator<T>` | Chain multiple validators          |
| `ValidatorPort<T>`      | Interface for custom validators    |
| `ValidationError`       | Error type with per-field messages |
