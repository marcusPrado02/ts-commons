/**
 * Environment enum for standard environments.
 */
export enum Env {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test',
}

export function getEnv(): Env {
  const env = process.env['NODE_ENV'] ?? 'development';
  return (Object.values(Env) as string[]).includes(env) ? (env as Env) : Env.DEVELOPMENT;
}

export function isDevelopment(): boolean {
  return getEnv() === Env.DEVELOPMENT;
}

export function isProduction(): boolean {
  return getEnv() === Env.PRODUCTION;
}

export function isTest(): boolean {
  return getEnv() === Env.TEST;
}
