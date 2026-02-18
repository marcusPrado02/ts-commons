/**
 * Core module for TypeScript Commons Platform integration with NestJS
 * Provides global configuration and base infrastructure
 */
/* eslint-disable @typescript-eslint/no-unsafe-call -- NestJS framework boundary: Object.assign for DynamicModule */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- NestJS framework boundary: Clock construction */
import type { DynamicModule } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import type { Clock } from '@acme/kernel';
import { SystemClock } from '@acme/kernel';

export interface CommonsCoreModuleOptions {
  /**
   * Custom clock implementation for testing
   */
  clock?: Clock;

  /**
   * Enable global validation pipe
   * @default true
   */
  enableValidation?: boolean;

  /**
   * Enable global transformation pipe
   * @default true
   */
  enableTransformation?: boolean;
}

@Global()
@Module({})
export class CommonsCoreModule {
  static forRoot(options: CommonsCoreModuleOptions = {}): DynamicModule {
    const clock = options.clock ?? new SystemClock();

    return {
      module: CommonsCoreModule,
      providers: [
        {
          provide: 'CLOCK',
          useValue: clock,
        },
        {
          provide: 'COMMONS_OPTIONS',
          useValue: options,
        },
      ],
      exports: ['CLOCK', 'COMMONS_OPTIONS'],
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: CommonsCoreModule,
      providers: [],
      exports: [],
    };
  }
}
