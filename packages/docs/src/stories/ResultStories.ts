import type { StoryModule } from '../story/StoryTypes';

// ---------------------------------------------------------------------------
// Result<T, E> — Success or failure with an explicit error type
// ---------------------------------------------------------------------------

type ResultOk<T> = { readonly ok: true; readonly value: T };
type ResultErr<E> = { readonly ok: false; readonly error: E };
type Result<T, E> = ResultOk<T> | ResultErr<E>;

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}
function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
function mapResult<T, U, E>(r: Result<T, E>, fn: (v: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : r;
}
function getOrElse<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

type ParsedResult = Result<number, string>;

function parseNumber(input: string): ParsedResult {
  const n = Number(input);
  return Number.isNaN(n) ? err(`'${input}' is not a number`) : ok(n);
}

export const ResultModule: StoryModule<ParsedResult> = {
  meta: {
    title: 'Result<T, E>',
    description: 'Success-or-failure monad — avoid throwing exceptions for expected errors.',
    component: 'Result',
    tags: ['result', 'functional', 'error-handling'],
    create: () => parseNumber('42'),
  },
  stories: [
    {
      name: 'ok result has ok=true',
      description: 'A successful parse produces an Ok variant.',
      args: {},
      execute: (subject) => subject.ok,
      expectedOutcome: 'true',
    },
    {
      name: 'ok result carries the value',
      description: 'The parsed number is accessible via .value.',
      args: {},
      execute: (subject) => (subject.ok ? subject.value : -1),
      expectedOutcome: '42',
    },
    {
      name: 'err result has ok=false',
      description: 'A failed parse produces an Err variant.',
      args: {},
      execute: () => parseNumber('abc').ok,
      expectedOutcome: 'false',
    },
    {
      name: 'err result carries the error message',
      description: 'The error string is accessible via .error.',
      args: {},
      execute: (): unknown => {
        const r = parseNumber('abc');
        return r.ok ? '' : r.error;
      },
      expectedOutcome: "'abc' is not a number",
    },
    {
      name: 'map transforms ok value',
      description: 'map() applies a function to the success value.',
      args: {},
      execute: (subject): unknown => {
        const doubled = mapResult(subject, (v) => v * 2);
        return doubled.ok ? doubled.value : -1;
      },
      expectedOutcome: '84',
    },
    {
      name: 'map is a no-op for err',
      description: 'map() passes the error straight through.',
      args: {},
      execute: (): unknown => {
        const r = parseNumber('x');
        const doubled = mapResult(r, (v) => v * 2);
        return doubled.ok;
      },
      expectedOutcome: 'false',
    },
    {
      name: 'getOrElse returns value for ok',
      description: 'Fallback is ignored when the result is Ok.',
      args: {},
      execute: (subject) => getOrElse(subject, -1),
      expectedOutcome: '42',
    },
    {
      name: 'getOrElse returns fallback for err',
      description: 'Fallback is used when the result is Err.',
      args: {},
      execute: () => getOrElse(parseNumber('bad'), 0),
      expectedOutcome: '0',
    },
  ],
};

// ---------------------------------------------------------------------------
// Option<T> — A value that may or may not be present
// ---------------------------------------------------------------------------

type OptionSome<T> = { readonly some: true; readonly value: T };
type OptionNone = { readonly some: false };
type Option<T> = OptionSome<T> | OptionNone;

function some<T>(value: T): Option<T> {
  return { some: true, value };
}
const none: OptionNone = { some: false };

function mapOption<T, U>(opt: Option<T>, fn: (v: T) => U): Option<U> {
  return opt.some ? some(fn(opt.value)) : none;
}

function optionOrElse<T>(opt: Option<T>, fallback: T): T {
  return opt.some ? opt.value : fallback;
}

function findUser(id: number): Option<string> {
  const db: Record<number, string> = { 1: 'Alice', 2: 'Bob' };
  const user = db[id];
  return user !== undefined ? some(user) : none;
}

export const OptionModule: StoryModule<Option<string>> = {
  meta: {
    title: 'Option<T>',
    description: 'Represent an optional value without null/undefined.',
    component: 'Option',
    tags: ['option', 'functional', 'nullable'],
    create: () => findUser(1),
  },
  stories: [
    {
      name: 'some has some=true',
      description: 'A found value produces a Some variant.',
      args: {},
      execute: (subject) => subject.some,
      expectedOutcome: 'true',
    },
    {
      name: 'some carries the value',
      description: 'The string value is accessible via .value.',
      args: {},
      execute: (subject) => (subject.some ? subject.value : ''),
      expectedOutcome: 'Alice',
    },
    {
      name: 'none has some=false',
      description: 'A missing record produces a None variant.',
      args: {},
      execute: () => findUser(99).some,
      expectedOutcome: 'false',
    },
    {
      name: 'map transforms some value',
      description: 'map() applies a function inside Some.',
      args: {},
      execute: (subject): unknown => {
        const upper = mapOption(subject, (s) => s.toUpperCase());
        return upper.some ? upper.value : '';
      },
      expectedOutcome: 'ALICE',
    },
    {
      name: 'orElse returns value for some',
      description: 'Fallback is ignored when the option is Some.',
      args: {},
      execute: (subject) => optionOrElse(subject, 'Unknown'),
      expectedOutcome: 'Alice',
    },
    {
      name: 'orElse returns fallback for none',
      description: 'Fallback is used when the option is None.',
      args: {},
      execute: () => optionOrElse(findUser(99), 'Unknown'),
      expectedOutcome: 'Unknown',
    },
  ],
};

// ---------------------------------------------------------------------------
// Either<L, R> — Left (failure/warning) or Right (success)
// ---------------------------------------------------------------------------

type EitherLeft<L> = { readonly tag: 'left'; readonly left: L };
type EitherRight<R> = { readonly tag: 'right'; readonly right: R };
type Either<L, R> = EitherLeft<L> | EitherRight<R>;

function left<L>(l: L): Either<L, never> {
  return { tag: 'left', left: l };
}
function right<R>(r: R): Either<never, R> {
  return { tag: 'right', right: r };
}
function foldEither<L, R, T>(e: Either<L, R>, onLeft: (l: L) => T, onRight: (r: R) => T): T {
  return e.tag === 'left' ? onLeft(e.left) : onRight(e.right);
}

function divide(a: number, b: number): Either<string, number> {
  return b === 0 ? left('division by zero') : right(a / b);
}

export const EitherModule: StoryModule<Either<string, number>> = {
  meta: {
    title: 'Either<L, R>',
    description: 'Two-track bifunctor for modelling success/failure or left/right branches.',
    component: 'Either',
    tags: ['either', 'functional', 'bifunctor'],
    create: () => divide(10, 2),
  },
  stories: [
    {
      name: 'right result has tag=right',
      description: 'A successful division is Right.',
      args: {},
      execute: (subject) => subject.tag,
      expectedOutcome: 'right',
    },
    {
      name: 'right carries the numeric value',
      description: '10 / 2 = 5 lives in .right.',
      args: {},
      execute: (subject) => (subject.tag === 'right' ? subject.right : -1),
      expectedOutcome: '5',
    },
    {
      name: 'left result has tag=left',
      description: 'Division by zero produces a Left.',
      args: {},
      execute: () => divide(10, 0).tag,
      expectedOutcome: 'left',
    },
    {
      name: 'fold dispatches to onLeft for left',
      description: 'fold() calls the left handler when the either is Left.',
      args: {},
      execute: () =>
        foldEither(
          divide(5, 0),
          (l) => l,
          (r) => String(r),
        ),
      expectedOutcome: 'division by zero',
    },
    {
      name: 'fold dispatches to onRight for right',
      description: 'fold() calls the right handler when the either is Right.',
      args: {},
      execute: (subject) =>
        foldEither(
          subject,
          (l) => l,
          (r) => String(r),
        ),
      expectedOutcome: '5',
    },
  ],
};
