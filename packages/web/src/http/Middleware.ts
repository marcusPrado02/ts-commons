import type { HttpContext } from './HttpContext';

export type Middleware = (
  context: HttpContext,
  next: () => Promise<void>,
) => Promise<void>;

export class MiddlewareChain {
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(context: HttpContext): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        if (middleware) {
          await middleware(context, next);
        }
      }
    };

    await next();
  }
}
