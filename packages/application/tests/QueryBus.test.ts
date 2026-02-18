import { describe, it, expect, beforeEach } from 'vitest';
import { Result } from '@acme/kernel';
import { InMemoryQueryBus, type Query, type QueryHandler } from '../src';

// Test Data Types
interface User {
  id: string;
  username: string;
  email: string;
}

interface UserList {
  users: User[];
  total: number;
}

// Test Queries
class GetUserByIdQuery implements Query<User> {
  readonly _brand?: 'Query';
  readonly _result?: User;
  constructor(public readonly id: string) {}
}

class GetAllUsersQuery implements Query<UserList> {
  readonly _brand?: 'Query';
  readonly _result?: UserList;
  constructor(public readonly limit: number = 10) {}
}

class SearchUsersQuery implements Query<User[]> {
  readonly _brand?: 'Query';
  readonly _result?: User[];
  constructor(public readonly searchTerm: string) {}
}

// Test Query Handlers
class GetUserByIdHandler implements QueryHandler<GetUserByIdQuery, User, Error> {
  private readonly users: User[] = [
    { id: '1', username: 'john', email: 'john@example.com' },
    { id: '2', username: 'jane', email: 'jane@example.com' },
  ];

  handle(query: GetUserByIdQuery): Promise<Result<User, Error>> {
    const user = this.users.find(u => u.id === query.id);
    if (!user) {
      return Promise.resolve(Result.err(new Error(`User not found: ${query.id}`)));
    }
    return Promise.resolve(Result.ok(user));
  }
}

class GetAllUsersHandler implements QueryHandler<GetAllUsersQuery, UserList, Error> {
  private readonly users: User[] = [
    { id: '1', username: 'john', email: 'john@example.com' },
    { id: '2', username: 'jane', email: 'jane@example.com' },
    { id: '3', username: 'bob', email: 'bob@example.com' },
  ];

  handle(query: GetAllUsersQuery): Promise<Result<UserList, Error>> {
    const limited = this.users.slice(0, query.limit);
    return Promise.resolve(Result.ok({
      users: limited,
      total: this.users.length,
    }));
  }
}

class SearchUsersHandler implements QueryHandler<SearchUsersQuery, User[], Error> {
  private readonly users: User[] = [
    { id: '1', username: 'john', email: 'john@example.com' },
    { id: '2', username: 'jane', email: 'jane@example.com' },
    { id: '3', username: 'johnny', email: 'johnny@example.com' },
  ];

  handle(query: SearchUsersQuery): Promise<Result<User[], Error>> {
    const results = this.users.filter(u =>
      u.username.toLowerCase().includes(query.searchTerm.toLowerCase())
    );
    return Promise.resolve(Result.ok(results));
  }
}

describe('InMemoryQueryBus', () => {
  let queryBus: InMemoryQueryBus;

  beforeEach(() => {
    queryBus = new InMemoryQueryBus();
  });

  describe('register', () => {
    it('should register a query handler', () => {
      expect(() => {
        queryBus.register(GetUserByIdQuery, new GetUserByIdHandler());
      }).not.toThrow();
    });

    it('should allow registering multiple handlers', () => {
      queryBus.register(GetUserByIdQuery, new GetUserByIdHandler());
      queryBus.register(GetAllUsersQuery, new GetAllUsersHandler());
      queryBus.register(SearchUsersQuery, new SearchUsersHandler());

      expect(queryBus).toBeDefined();
    });

    it('should allow overriding a handler', () => {
      queryBus.register(GetUserByIdQuery, new GetUserByIdHandler());

      // Override with a new handler
      const newHandler = new GetUserByIdHandler();
      expect(() => {
        queryBus.register(GetUserByIdQuery, newHandler);
      }).not.toThrow();
    });
  });

  describe('dispatch', () => {
    it('should dispatch a query to its handler', async () => {
      queryBus.register(GetUserByIdQuery, new GetUserByIdHandler());

      const query = new GetUserByIdQuery('1');
      const result = await queryBus.dispatch(query);

      expect(result.isOk()).toBe(true);
      const user = result.unwrap() as User;
      expect(user.id).toBe('1');
      expect(user.username).toBe('john');
      expect(user.email).toBe('john@example.com');
    });

    it('should handle query execution errors', async () => {
      queryBus.register(GetUserByIdQuery, new GetUserByIdHandler());

      const query = new GetUserByIdQuery('999');
      const result = await queryBus.dispatch(query);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toBe('User not found: 999');
    });

    it('should throw when dispatching unregistered query', async () => {
      const query = new GetUserByIdQuery('1');

      await expect(queryBus.dispatch(query)).rejects.toThrow(
        'No handler registered for query: GetUserByIdQuery'
      );
    });

    it('should dispatch different query types correctly', async () => {
      queryBus.register(GetUserByIdQuery, new GetUserByIdHandler());
      queryBus.register(GetAllUsersQuery, new GetAllUsersHandler());
      queryBus.register(SearchUsersQuery, new SearchUsersHandler());

      // Get by ID
      const byIdResult = await queryBus.dispatch(new GetUserByIdQuery('2'));
      expect(byIdResult.isOk()).toBe(true);
      expect((byIdResult.unwrap() as User).username).toBe('jane');

      // Get all
      const allResult = await queryBus.dispatch(new GetAllUsersQuery(2));
      expect(allResult.isOk()).toBe(true);
      const userList = allResult.unwrap() as UserList;
      expect(userList.users).toHaveLength(2);
      expect(userList.total).toBe(3);

      // Search
      const searchResult = await queryBus.dispatch(new SearchUsersQuery('john'));
      expect(searchResult.isOk()).toBe(true);
      const searchResults = searchResult.unwrap() as User[];
      expect(searchResults.map((u: User) => u.username)).toEqual(['john', 'johnny']);
      expect(searchResults.map(u => u.username)).toEqual(['john', 'johnny']);
    });

    it('should handle queries with default parameters', async () => {
      queryBus.register(GetAllUsersQuery, new GetAllUsersHandler());

      const result = await queryBus.dispatch(new GetAllUsersQuery());

      expect(result.isOk()).toBe(true);
      const userList = result.unwrap() as UserList;
      expect(userList.users).toHaveLength(3);
    });

    it('should maintain handler isolation', async () => {
      let byIdCount = 0;
      let allUsersCount = 0;

      class CountingByIdHandler implements QueryHandler<GetUserByIdQuery, User, Error> {
        handle(query: GetUserByIdQuery): Promise<Result<User, Error>> {
          byIdCount++;
          return Promise.resolve(Result.ok({ id: query.id, username: 'test', email: 'test@test.com' }));
        }
      }

      class CountingAllUsersHandler implements QueryHandler<GetAllUsersQuery, UserList, Error> {
        handle(_query: GetAllUsersQuery): Promise<Result<UserList, Error>> {
          allUsersCount++;
          return Promise.resolve(Result.ok({ users: [], total: 0 }));
        }
      }

      queryBus.register(GetUserByIdQuery, new CountingByIdHandler());
      queryBus.register(GetAllUsersQuery, new CountingAllUsersHandler());

      await queryBus.dispatch(new GetUserByIdQuery('1'));
      await queryBus.dispatch(new GetUserByIdQuery('2'));
      await queryBus.dispatch(new GetAllUsersQuery());

      expect(byIdCount).toBe(2);
      expect(allUsersCount).toBe(1);
    });

    it('should handle async operations correctly', async () => {
      class AsyncGetUserHandler implements QueryHandler<GetUserByIdQuery, User, Error> {
        async handle(query: GetUserByIdQuery): Promise<Result<User, Error>> {
          // Simulate async database lookup
          await new Promise(resolve => setTimeout(resolve, 10));
          return Result.ok({
            id: query.id,
            username: 'async-user',
            email: 'async@test.com',
          });
        }
      }

      queryBus.register(GetUserByIdQuery, new AsyncGetUserHandler());

      const result = await queryBus.dispatch(new GetUserByIdQuery('5'));

      expect(result.isOk()).toBe(true);
      expect((result.unwrap() as User).username).toBe('async-user');
    });

    it('should handle empty result sets', async () => {
      queryBus.register(SearchUsersQuery, new SearchUsersHandler());

      const result = await queryBus.dispatch(new SearchUsersQuery('nonexistent'));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle queries with no parameters', async () => {
      class GetStatsQuery implements Query<{ count: number }> {
        readonly _brand?: 'Query';
        readonly _result?: { count: number };
        constructor() {}
      }

      class GetStatsHandler implements QueryHandler<GetStatsQuery, { count: number }, Error> {
        handle(_query: GetStatsQuery): Promise<Result<{ count: number }, Error>> {
          return Promise.resolve(Result.ok({ count: 42 }));
        }
      }

      queryBus.register(GetStatsQuery, new GetStatsHandler());

      const result = await queryBus.dispatch(new GetStatsQuery());

      expect(result.isOk()).toBe(true);
      expect((result.unwrap() as { count: number }).count).toBe(42);
    });

    it('should handle queries with complex return types', async () => {
      interface ComplexData {
        nested: {
          deep: {
            value: string;
          };
        };
        array: number[];
        map: Map<string, unknown>;
      }

      class GetComplexDataQuery implements Query<ComplexData> {
        readonly _brand?: 'Query';
        readonly _result?: ComplexData;
        constructor() {}
      }

      class GetComplexDataHandler implements QueryHandler<GetComplexDataQuery, ComplexData, Error> {
        handle(_query: GetComplexDataQuery): Promise<Result<ComplexData, Error>> {
          return Promise.resolve(Result.ok({
            nested: { deep: { value: 'test' } },
            array: [1, 2, 3],
            map: new Map([['key', 'value']]),
          }));
        }
      }

      queryBus.register(GetComplexDataQuery, new GetComplexDataHandler());

      const result = await queryBus.dispatch(new GetComplexDataQuery());

      expect(result.isOk()).toBe(true);
      const data = result.unwrap() as ComplexData;
      expect(data.nested.deep.value).toBe('test');
      expect(data.array).toEqual([1, 2, 3]);
      expect(data.map.get('key')).toBe('value');
    });

    it('should handle queries with primitive return types', async () => {
      class CountQuery implements Query<number> {
        readonly _brand?: 'Query';
        readonly _result?: number;
        constructor() {}
      }

      class CountHandler implements QueryHandler<CountQuery, number, Error> {
        handle(_query: CountQuery): Promise<Result<number, Error>> {
          return Promise.resolve(Result.ok(100));
        }
      }

      queryBus.register(CountQuery, new CountHandler());

      const result = await queryBus.dispatch(new CountQuery());

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(100);
    });

    it('should handle pagination correctly', async () => {
      class PagedQuery implements Query<UserList> {
        readonly _brand?: 'Query';
        readonly _result?: UserList;
        constructor(
          public readonly page: number = 1,
          public readonly pageSize: number = 10,
        ) {}
      }

      class PagedHandler implements QueryHandler<PagedQuery, UserList, Error> {
        private readonly allUsers = Array.from({ length: 25 }, (_, i) => ({
          id: String(i + 1),
          username: `user${i + 1}`,
          email: `user${i + 1}@test.com`,
        }));

        handle(query: PagedQuery): Promise<Result<UserList, Error>> {
          const start = (query.page - 1) * query.pageSize;
          const end = start + query.pageSize;
          const users = this.allUsers.slice(start, end);

          return Promise.resolve(Result.ok({
            users,
            total: this.allUsers.length,
          }));
        }
      }

      queryBus.register(PagedQuery, new PagedHandler());

      // Page 1
      const page1 = await queryBus.dispatch(new PagedQuery(1, 10));
      expect(page1.isOk()).toBe(true);
      expect((page1.unwrap() as UserList).users).toHaveLength(10);
      expect((page1.unwrap() as UserList).users[0]!.id).toBe('1');

      // Page 2
      const page2 = await queryBus.dispatch(new PagedQuery(2, 10));
      expect(page2.isOk()).toBe(true);
      expect((page2.unwrap() as UserList).users).toHaveLength(10);
      expect((page2.unwrap() as UserList).users[0]!.id).toBe('11');

      // Last page (partial)
      const page3 = await queryBus.dispatch(new PagedQuery(3, 10));
      expect((page3.unwrap() as UserList).users).toHaveLength(5);
    });
  });
});
