import { describe, it, expect } from 'vitest';
import { Entity } from '../src/ddd/Entity';

// Test implementation
class UserId {
  constructor(public readonly value: string) {}
}

class User extends Entity<UserId> {
  constructor(
    id: UserId,
    private _name: string,
  ) {
    super(id);
  }

  get name(): string {
    return this._name;
  }

  changeName(newName: string): void {
    this._name = newName;
  }
}

class OrderId {
  constructor(public readonly value: string) {}
}

class Order extends Entity<OrderId> {
  constructor(id: OrderId) {
    super(id);
  }
}

describe('Entity', () => {
  describe('creation', () => {
    it('should create an entity with id', () => {
      const id = new UserId('user-123');
      const user = new User(id, 'John Doe');

      expect(user.id).toBe(id);
      expect(user.name).toBe('John Doe');
    });
  });

  describe('id accessor', () => {
    it('should return the entity id', () => {
      const id = new UserId('user-456');
      const user = new User(id, 'Jane Doe');

      expect(user.id.value).toBe('user-456');
    });
  });

  describe('equals', () => {
    it('should return true for entities with same id', () => {
      const id = new UserId('user-123');
      const user1 = new User(id, 'John');
      const user2 = new User(id, 'Jane');

      expect(user1.equals(user2)).toBe(true);
    });

    it('should return false for entities with different ids', () => {
      const user1 = new User(new UserId('user-1'), 'John');
      const user2 = new User(new UserId('user-2'), 'Jane');

      expect(user1.equals(user2)).toBe(false);
    });

    it('should return false for different entity types', () => {
      const user = new User(new UserId('123'), 'John');
      const order = new Order(new OrderId('123'));

      expect(user.equals(order as unknown as Entity<UserId>)).toBe(false);
    });

    it('should return false for non-entity objects', () => {
      const user = new User(new UserId('123'), 'John');
      const notEntity = { id: new UserId('123') };

      expect(user.equals(notEntity as unknown as Entity<UserId>)).toBe(false);
    });
  });

  describe('identity vs state', () => {
    it('should maintain identity despite state changes', () => {
      const id = new UserId('user-123');
      const user1 = new User(id, 'John');
      const user2 = new User(id, 'Jane');

      user1.changeName('Johnny');

      expect(user1.equals(user2)).toBe(true);
      expect(user1.name).toBe('Johnny');
      expect(user2.name).toBe('Jane');
    });
  });
});
