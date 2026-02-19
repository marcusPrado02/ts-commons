/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ValidationError } from './ValidationError';
import { ZodValidator } from './ZodValidator';
import { CompositeValidator, FunctionValidator } from './CompositeValidator';

// ---------------------------------------------------------------------------
// Suite 1: ValidationError
// ---------------------------------------------------------------------------

describe('ValidationError', () => {
  it('constructor sets message, name and issues', () => {
    const err = new ValidationError([{ field: 'email', message: 'Invalid email' }]);
    expect(err.name).toBe('ValidationError');
    expect(err.issues).toHaveLength(1);
    expect(err.message).toContain('1 issue');
  });

  it('fromMessage() creates a single-issue error for a named field', () => {
    const err = ValidationError.fromMessage('name', 'Too short', 'too_small');
    expect(err.issues[0]).toMatchObject({ field: 'name', message: 'Too short', code: 'too_small' });
  });

  it('hasField() returns true for a field with issues and false otherwise', () => {
    const err = ValidationError.fromIssues([
      { field: 'email', message: 'Invalid' },
      { field: 'age', message: 'Too small' },
    ]);
    expect(err.hasField('email')).toBe(true);
    expect(err.hasField('phone')).toBe(false);
  });

  it('getFieldIssues() returns only issues for the requested field', () => {
    const err = ValidationError.fromIssues([
      { field: 'email', message: 'Invalid format' },
      { field: 'email', message: 'Already taken' },
      { field: 'name', message: 'Required' },
    ]);
    expect(err.getFieldIssues('email')).toHaveLength(2);
    expect(err.getFieldIssues('name')).toHaveLength(1);
  });

  it('firstMessage() returns message of first matching issue', () => {
    const err = ValidationError.fromMessage('email', 'Invalid email');
    expect(err.firstMessage('email')).toBe('Invalid email');
    expect(err.firstMessage('phone')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 2: ZodValidator
// ---------------------------------------------------------------------------

describe('ZodValidator', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().min(18),
  });
  const validator = new ZodValidator(schema);

  it('returns Ok with parsed value for valid input', async () => {
    const result = await validator.validate({ email: 'alice@acme.com', age: 25 });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ email: 'alice@acme.com', age: 25 });
  });

  it('returns Err with issues for invalid email', async () => {
    const result = await validator.validate({ email: 'not-an-email', age: 25 });
    expect(result.isErr()).toBe(true);
    const err = result.unwrapErr();
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.hasField('email')).toBe(true);
  });

  it('returns Err for value below minimum (age < 18)', async () => {
    const result = await validator.validate({ email: 'alice@acme.com', age: 16 });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().hasField('age')).toBe(true);
  });

  it('maps nested field paths using dot notation', async () => {
    const nested = z.object({ address: z.object({ city: z.string().min(1) }) });
    const v = new ZodValidator(nested);
    const result = await v.validate({ address: { city: '' } });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().hasField('address.city')).toBe(true);
  });

  it('uses "_root" for top-level (non-field) issues', async () => {
    const rootSchema = z.string().min(1);
    const v = new ZodValidator(rootSchema);
    const result = await v.validate('');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().hasField('_root')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: CompositeValidator
// ---------------------------------------------------------------------------

describe('CompositeValidator', () => {
  type Dto = { name: string; age: number };

  const zodV = new ZodValidator(z.object({ name: z.string().min(1), age: z.number() }));

  const adultV = new FunctionValidator<Dto>(
    (input: unknown) => {
      const obj = input as Dto;
      return obj.age >= 18 ? obj : null;
    },
    'age',
    'Must be 18 or older',
    'too_small',
  );

  it('returns Ok when all validators pass', async () => {
    const composite = new CompositeValidator(zodV, adultV);
    const result = await composite.validate({ name: 'Alice', age: 25 });
    expect(result.isOk()).toBe(true);
  });

  it('aggregates issues from all failing validators', async () => {
    const composite = new CompositeValidator(zodV, adultV);
    const result = await composite.validate({ name: '', age: 15 });
    expect(result.isErr()).toBe(true);
    const err = result.unwrapErr();
    expect(err.hasField('name')).toBe(true);
    expect(err.hasField('age')).toBe(true);
    expect(err.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('collects issues only from failing validators when one passes', async () => {
    const composite = new CompositeValidator(zodV, adultV);
    // zodV passes, adultV fails
    const result = await composite.validate({ name: 'Bob', age: 16 });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().hasField('age')).toBe(true);
  });

  it('works with a single validator', async () => {
    const composite = new CompositeValidator(zodV);
    const ok = await composite.validate({ name: 'Alice', age: 30 });
    expect(ok.isOk()).toBe(true);
  });

  it('collects issues from multiple independent field failures', async () => {
    const composite = new CompositeValidator(zodV);
    const result = await composite.validate({ name: '', age: 'not-a-number' });
    expect(result.isErr()).toBe(true);
    // at least both fields have issues
    const err = result.unwrapErr();
    expect(err.issues.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: FunctionValidator
// ---------------------------------------------------------------------------

describe('FunctionValidator', () => {
  it('returns Ok when predicate returns a value', async () => {
    const v = new FunctionValidator<number>(
      (input: unknown) => (typeof input === 'number' && input > 0 ? input : null),
      'value',
      'Must be positive',
    );
    const result = await v.validate(5);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(5);
  });

  it('returns Err with the configured field and message when predicate returns null', async () => {
    const v = new FunctionValidator<number>(
      (input: unknown) => (typeof input === 'number' && input > 0 ? input : null),
      'value',
      'Must be positive',
    );
    const result = await v.validate(-1);
    expect(result.isErr()).toBe(true);
    const err = result.unwrapErr();
    expect(err.hasField('value')).toBe(true);
    expect(err.firstMessage('value')).toBe('Must be positive');
  });

  it('includes error code when provided', async () => {
    const v = new FunctionValidator<string>(
      (input: unknown) => (typeof input === 'string' && input.length > 0 ? input : null),
      'name',
      'Required',
      'required',
    );
    const result = await v.validate('');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().issues[0]).toMatchObject({ code: 'required' });
  });

  it('is composable with CompositeValidator', async () => {
    const notEmpty = new FunctionValidator<string>(
      (input: unknown) => (typeof input === 'string' && input.trim().length > 0 ? input : null),
      'text',
      'Cannot be empty',
    );
    const notTooLong = new FunctionValidator<string>(
      (input: unknown) => (typeof input === 'string' && input.length <= 10 ? input : null),
      'text',
      'Too long',
    );
    const composite = new CompositeValidator(notEmpty, notTooLong);

    const ok = await composite.validate('hello');
    expect(ok.isOk()).toBe(true);

    const tooLong = await composite.validate('this is too long');
    expect(tooLong.isErr()).toBe(true);
  });
});
