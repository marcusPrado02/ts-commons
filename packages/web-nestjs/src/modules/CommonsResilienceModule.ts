/**
 * Resilience module for circuit breakers, retry policies and timeout
 */
/* eslint-disable @typescript-eslint/no-unsafe-call -- NestJS framework boundary: Object.assign for DynamicModule */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- NestJS framework boundary: CircuitBreaker construction */
import type { DynamicModule } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { CircuitBreaker } from '@acme/resilience';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
}

export interface CommonsResilienceModuleOptions {
  /**
   * Circuit breaker configuration
   */
  circuitBreaker?: CircuitBreakerConfig;

  /**
   * Enable circuit breaker
   * @default true
   */
  enableCircuitBreaker?: boolean;
}

@Global()
@Module({})
export class CommonsResilienceModule {
  static forRoot(
    options: CommonsResilienceModuleOptions = {}
  ): DynamicModule {
    const providers = [];

    if (options.enableCircuitBreaker !== false && options.circuitBreaker) {
      providers.push({
        provide: 'CIRCUIT_BREAKER',
        useValue: new CircuitBreaker(
          options.circuitBreaker.failureThreshold,
          options.circuitBreaker.resetTimeoutMs
        ),
      });
    }

    providers.push({
      provide: 'RESILIENCE_OPTIONS',
      useValue: options,
    });

    return {
      module: CommonsResilienceModule,
      providers,
      exports: providers.map((p) => p.provide),
    };
  }
}
