# @acme/validation

Request validation utilities — Zod integration, composite validators, and plain-function validators with a unified `Result`-based API.

## Installation

```bash
pnpm add @acme/validation
```

`zod` is a peer dependency and must be installed separately:

```bash
pnpm add zod
```

## Exports

| Export                  | Kind      | Description                                                         |
| ----------------------- | --------- | ------------------------------------------------------------------- |
| `ValidationError`       | class     | Error carrying one or more `ValidationIssue` objects                |
| `ValidationIssue`       | type      | Single field-level issue (`field`, `message`, `code`, `value`)      |
| `Validator<T>`          | interface | Abstract validator: `validate(input): Promise<ValidationResult<T>>` |
| `ValidationResult<T>`   | type      | `Result<T, ValidationError>` from `@acme/kernel`                    |
| `ZodValidator<T>`       | class     | Wraps a Zod schema as a `Validator`                                 |
| `CompositeValidator<T>` | class     | Chains multiple validators; aggregates all issues                   |
| `FunctionValidator<T>`  | class     | Wraps a plain predicate as a `Validator`                            |

## Usage

### Validate with a Zod schema

```ts
import { z } from 'zod';
import { ZodValidator } from '@acme/validation';

const schema = z.object({
  email: z.string().email(),
  age: z.number().min(18),
});

const validator = new ZodValidator(schema);
const result = await validator.validate({ email: 'bad', age: 15 });

if (result.isErr()) {
  const err = result.unwrapErr();
  console.log(err.issues);
  // [{ field: 'email', message: 'Invalid email', code: 'invalid_string' },
  //  { field: 'age',   message: 'Number must be >= 18', code: 'too_small' }]
}
```

### Add a business-rule check with FunctionValidator

```ts
import { FunctionValidator } from '@acme/validation';

type CreateUserDto = { email: string; age: number };

// Returns the typed value on success, or null to signal failure.
const disposableEmailCheck = new FunctionValidator<CreateUserDto>(
  (input) => {
    const dto = input as CreateUserDto;
    return dto.email.endsWith('@mailinator.com') ? null : dto;
  },
  'email',
  'Disposable email addresses are not allowed',
);

const result = await disposableEmailCheck.validate(req.body);
```

### Chain validators with CompositeValidator

```ts
import { CompositeValidator } from '@acme/validation';

// All validators run; issues from every failing validator are aggregated.
const validator = new CompositeValidator(schemaValidator, disposableEmailCheck);
const result = await validator.validate(req.body);

if (result.isErr()) {
  const err = result.unwrapErr(); // ValidationError

  if (err.hasField('email')) {
    console.log(err.firstMessage('email'));
  }

  // Map all issues to a response body
  const errors = err.issues.map(({ field, message }) => ({ field, message }));
  res.status(422).json({ errors });
}
```

## Dependencies

| Package        | Role                                                        |
| -------------- | ----------------------------------------------------------- |
| `@acme/kernel` | Provides the `Result<T, E>` type used by `ValidationResult` |
| `zod` (peer)   | Schema definition for `ZodValidator`                        |
