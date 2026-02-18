/**
 * Observability module for structured logging, metrics and tracing
 */
/* eslint-disable @typescript-eslint/no-unsafe-call -- NestJS framework boundary: Object.assign for DynamicModule */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- NestJS framework boundary: Logger construction */
import type { DynamicModule } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import type { Logger } from '@acme/observability';

export interface CommonsObservabilityModuleOptions {
  /**
   * Custom logger implementation
   */
  logger?: Logger;

  /**
   * Minimum log level
   * @default 'info'
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Service name for logging context
   */
  serviceName?: string;

  /**
   * Enable request logging
   * @default true
   */
  enableRequestLogging?: boolean;

  /**
   * Enable error logging
   * @default true
   */
  enableErrorLogging?: boolean;
}

@Global()
@Module({})
export class CommonsObservabilityModule {
  static forRoot(
    options: CommonsObservabilityModuleOptions = {}
  ): DynamicModule {
    const logger = options.logger ?? {
      debug: (): void => {},
      info: (): void => {},
      warn: (): void => {},
      error: (): void => {},
    };

    return {
      module: CommonsObservabilityModule,
      providers: [
        {
          provide: 'LOGGER',
          useValue: logger,
        },
        {
          provide: 'OBSERVABILITY_OPTIONS',
          useValue: options,
        },
      ],
      exports: ['LOGGER', 'OBSERVABILITY_OPTIONS'],
    };
  }
}
