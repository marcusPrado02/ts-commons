/**
 * Decorator for transactional methods.
 * Wraps method execution in a Unit of Work.
 */
export function Transactional(): MethodDecorator {
  return function (_target: unknown, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      // NOTE: This is a marker decorator.
      // Actual transaction handling should be implemented by infrastructure layer
      // using UnitOfWork from dependency injection.
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
