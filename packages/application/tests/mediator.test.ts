/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  Mediator,
  LoggingBehavior,
  ValidationBehavior,
  MediatorValidationError,
  CachingBehavior,
} from '../src';
import type { MediatorRequest, RequestHandler, PipelineBehavior } from '../src';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

class GetUserQuery implements MediatorRequest<string> {
  constructor(public readonly userId: string) {}
}

class CreateUserCommand implements MediatorRequest<void> {
  constructor(
    public readonly name: string,
    public readonly email: string,
  ) {}
}

class GetUserHandler implements RequestHandler<GetUserQuery, string> {
  readonly calls: string[] = [];
  async handle(request: GetUserQuery): Promise<string> {
    this.calls.push(request.userId);
    return `User:${request.userId}`;
  }
}

class CreateUserHandler implements RequestHandler<CreateUserCommand, void> {
  readonly calls: string[] = [];
  async handle(command: CreateUserCommand): Promise<void> {
    this.calls.push(command.name);
  }
}

function makeMediator() {
  const mediator = new Mediator();
  const handler = new GetUserHandler();
  mediator.register(GetUserQuery, handler);
  return { mediator, handler };
}

// ─── Mediator ─────────────────────────────────────────────────────────────────

describe('Mediator', () => {
  let mediator: Mediator;
  let handler: GetUserHandler;

  beforeEach(() => {
    ({ mediator, handler } = makeMediator());
  });

  it('handlerCount() reflects registered handlers', () => {
    expect(mediator.handlerCount()).toBe(1);
  });

  it('behaviorCount() starts at 0', () => {
    expect(mediator.behaviorCount()).toBe(0);
  });

  it('send() dispatches to the registered handler', async () => {
    const result = await mediator.send(new GetUserQuery('u-1'));
    expect(result).toBe('User:u-1');
  });

  it('send() calls the handler with the correct request', async () => {
    await mediator.send(new GetUserQuery('u-42'));
    expect(handler.calls).toContain('u-42');
  });

  it('send() throws when no handler is registered', async () => {
    await expect(mediator.send(new CreateUserCommand('Alice', 'a@b.com'))).rejects.toThrow(
      'No handler registered for request: CreateUserCommand',
    );
  });

  it('register() supports multiple request types', async () => {
    const cmdHandler = new CreateUserHandler();
    mediator.register(CreateUserCommand, cmdHandler);
    await mediator.send(new CreateUserCommand('Bob', 'b@b.com'));
    expect(cmdHandler.calls).toContain('Bob');
  });

  it('addBehavior() increments behaviorCount', () => {
    const logging = new LoggingBehavior();
    mediator.addBehavior(logging);
    expect(mediator.behaviorCount()).toBe(1);
  });

  it('behaviors are sorted by order (lower first)', () => {
    const order: number[] = [];
    const b1: PipelineBehavior = {
      order: 30,
      handle: async (_r, next) => {
        order.push(30);
        return next();
      },
    };
    const b2: PipelineBehavior = {
      order: 10,
      handle: async (_r, next) => {
        order.push(10);
        return next();
      },
    };
    const b3: PipelineBehavior = {
      order: 20,
      handle: async (_r, next) => {
        order.push(20);
        return next();
      },
    };
    mediator.addBehavior(b1);
    mediator.addBehavior(b2);
    mediator.addBehavior(b3);
    return mediator.send(new GetUserQuery('u-1')).then(() => {
      expect(order).toEqual([10, 20, 30]);
    });
  });

  it('behaviors without order default to 0', async () => {
    const order: number[] = [];
    const b1: PipelineBehavior = {
      handle: async (_r, next) => {
        order.push(0);
        return next();
      },
    };
    const b2: PipelineBehavior = {
      order: 5,
      handle: async (_r, next) => {
        order.push(5);
        return next();
      },
    };
    mediator.addBehavior(b2);
    mediator.addBehavior(b1);
    await mediator.send(new GetUserQuery('u-1'));
    expect(order[0]).toBe(0);
    expect(order[1]).toBe(5);
  });

  it('send() passes request through all behaviors', async () => {
    const seen: string[] = [];
    const b: PipelineBehavior = {
      handle: async (req, next) => {
        seen.push((req as GetUserQuery).userId);
        return next();
      },
    };
    mediator.addBehavior(b);
    await mediator.send(new GetUserQuery('u-99'));
    expect(seen).toContain('u-99');
  });
});

// ─── LoggingBehavior ──────────────────────────────────────────────────────────

describe('LoggingBehavior', () => {
  let mediator: Mediator;
  let logging: LoggingBehavior;

  beforeEach(() => {
    mediator = new Mediator();
    const handler = new GetUserHandler();
    mediator.register(GetUserQuery, handler);
    logging = new LoggingBehavior();
    mediator.addBehavior(logging);
  });

  it('records an entry after a successful dispatch', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    expect(logging.getEntries()).toHaveLength(1);
  });

  it('records the correct requestType', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    expect(logging.getEntries()[0]?.requestType).toBe('GetUserQuery');
  });

  it('records success=true on success', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    expect(logging.getEntries()[0]?.success).toBe(true);
  });

  it('records durationMs >= 0', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    expect(logging.getEntries()[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records success=false when handler throws', async () => {
    const failHandler: RequestHandler<GetUserQuery, string> = {
      handle: async () => {
        throw new Error('handler failed');
      },
    };
    mediator.register(GetUserQuery, failHandler);
    await expect(mediator.send(new GetUserQuery('u-err'))).rejects.toThrow();
    expect(logging.getEntries()[0]?.success).toBe(false);
  });

  it('records the error message on failure', async () => {
    const failHandler: RequestHandler<GetUserQuery, string> = {
      handle: async () => {
        throw new Error('oops');
      },
    };
    mediator.register(GetUserQuery, failHandler);
    await expect(mediator.send(new GetUserQuery('u-err'))).rejects.toThrow();
    expect(logging.getEntries()[0]?.error).toBe('oops');
  });

  it('clear() removes all entries', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    logging.clear();
    expect(logging.getEntries()).toHaveLength(0);
  });

  it('accumulates multiple entries', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    await mediator.send(new GetUserQuery('u-2'));
    expect(logging.getEntries()).toHaveLength(2);
  });

  it('getEntries() returns a copy', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    const entries = logging.getEntries() as any[];
    entries[0].success = false;
    expect(logging.getEntries()[0]?.success).toBe(true);
  });
});

// ─── ValidationBehavior ───────────────────────────────────────────────────────

describe('ValidationBehavior', () => {
  it('passes through when validation returns no errors', async () => {
    const { mediator } = makeMediator();
    mediator.addBehavior(
      new ValidationBehavior<GetUserQuery>((req) =>
        req.userId.length > 0 ? [] : ['userId is required'],
      ),
    );
    const result = await mediator.send(new GetUserQuery('u-1'));
    expect(result).toBe('User:u-1');
  });

  it('throws MediatorValidationError when validation fails', async () => {
    const { mediator } = makeMediator();
    mediator.addBehavior(new ValidationBehavior<GetUserQuery>(() => ['userId is required']));
    await expect(mediator.send(new GetUserQuery(''))).rejects.toBeInstanceOf(
      MediatorValidationError,
    );
  });

  it('MediatorValidationError contains the error messages', async () => {
    const { mediator } = makeMediator();
    mediator.addBehavior(
      new ValidationBehavior<GetUserQuery>(() => ['userId is required', 'userId too short']),
    );
    let caught: MediatorValidationError | undefined;
    try {
      await mediator.send(new GetUserQuery(''));
    } catch (e) {
      caught = e as MediatorValidationError;
    }
    expect(caught?.errors).toContain('userId is required');
    expect(caught?.errors).toContain('userId too short');
  });

  it('MediatorValidationError has correct name', async () => {
    const { mediator } = makeMediator();
    mediator.addBehavior(new ValidationBehavior<GetUserQuery>(() => ['err']));
    let caught: MediatorValidationError | undefined;
    try {
      await mediator.send(new GetUserQuery(''));
    } catch (e) {
      caught = e as MediatorValidationError;
    }
    expect(caught?.name).toBe('MediatorValidationError');
  });

  it('MediatorValidationError message contains the errors', async () => {
    const { mediator } = makeMediator();
    mediator.addBehavior(new ValidationBehavior<GetUserQuery>(() => ['bad input']));
    let caught: MediatorValidationError | undefined;
    try {
      await mediator.send(new GetUserQuery(''));
    } catch (e) {
      caught = e as MediatorValidationError;
    }
    expect(caught?.message).toContain('bad input');
  });

  it('does not call the handler when validation fails', async () => {
    const { mediator, handler } = makeMediator();
    mediator.addBehavior(new ValidationBehavior<GetUserQuery>(() => ['err']));
    await mediator.send(new GetUserQuery('')).catch(() => undefined);
    expect(handler.calls).toHaveLength(0);
  });

  it('has order 20', () => {
    const b = new ValidationBehavior(() => []);
    expect(b.order).toBe(20);
  });
});

// ─── CachingBehavior ──────────────────────────────────────────────────────────

describe('CachingBehavior', () => {
  let mediator: Mediator;
  let handler: GetUserHandler;
  let cache: CachingBehavior<GetUserQuery, string>;

  beforeEach(() => {
    handler = new GetUserHandler();
    mediator = new Mediator();
    mediator.register(GetUserQuery, handler);
    cache = new CachingBehavior<GetUserQuery, string>((req) => req.userId);
    mediator.addBehavior(cache);
  });

  it('first request calls the handler', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    expect(handler.calls).toHaveLength(1);
  });

  it('second identical request returns cached value', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    await mediator.send(new GetUserQuery('u-1'));
    expect(handler.calls).toHaveLength(1);
  });

  it('returns the cached response', async () => {
    const first = await mediator.send(new GetUserQuery('u-1'));
    const second = await mediator.send(new GetUserQuery('u-1'));
    expect(second).toBe(first);
  });

  it('different keys call the handler separately', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    await mediator.send(new GetUserQuery('u-2'));
    expect(handler.calls).toHaveLength(2);
  });

  it('size() reflects cached entries', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    await mediator.send(new GetUserQuery('u-2'));
    expect(cache.size()).toBe(2);
  });

  it('has() returns true for a cached key', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    expect(cache.has('u-1')).toBe(true);
  });

  it('has() returns false for an unknown key', () => {
    expect(cache.has('missing')).toBe(false);
  });

  it('invalidate() removes a single entry', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    cache.invalidate('u-1');
    expect(cache.has('u-1')).toBe(false);
    expect(cache.size()).toBe(0);
  });

  it('clear() removes all entries', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    await mediator.send(new GetUserQuery('u-2'));
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('after invalidate, handler is called again', async () => {
    await mediator.send(new GetUserQuery('u-1'));
    cache.invalidate('u-1');
    await mediator.send(new GetUserQuery('u-1'));
    expect(handler.calls).toHaveLength(2);
  });

  it('stale entry (expired TTL) is refreshed by calling handler again', async () => {
    const shortCache = new CachingBehavior<GetUserQuery, string>((r) => r.userId, 1);
    const m2 = new Mediator();
    m2.register(GetUserQuery, handler);
    m2.addBehavior(shortCache);
    await m2.send(new GetUserQuery('u-1'));
    // wait for TTL to expire
    await new Promise((res) => setTimeout(res, 10));
    await m2.send(new GetUserQuery('u-1'));
    expect(handler.calls).toHaveLength(2);
  });

  it('has order 30', () => {
    expect(cache.order).toBe(30);
  });
});
