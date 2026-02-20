/**
 * Outbox module for transactional outbox pattern implementation
 */
/* eslint-disable @typescript-eslint/no-unsafe-call -- NestJS framework boundary: Object.assign for DynamicModule */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- NestJS framework boundary: OutboxStore construction */
import type { DynamicModule } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import type { OutboxStorePort } from '@acme/outbox';

export interface CommonsOutboxModuleOptions {
  /**
   * Custom outbox store implementation
   */
  store?: OutboxStorePort;

  /**
   * Enable outbox pattern
   * @default true
   */
  enabled?: boolean;

  /**
   * Outbox processing interval in milliseconds
   * @default 1000
   */
  processingInterval?: number;

  /**
   * Maximum number of retries for failed messages
   * @default 3
   */
  maxRetries?: number;
}

@Global()
@Module({})
export class CommonsOutboxModule {
  static forRoot(options: CommonsOutboxModuleOptions = {}): DynamicModule {
    const store = options.store ?? {
      save: (): Promise<void> => Promise.resolve(),
      findPending: (): Promise<never[]> => Promise.resolve([]),
      markAsProcessed: (): Promise<void> => Promise.resolve(),
      markAsFailed: (): Promise<void> => Promise.resolve(),
    };

    return {
      module: CommonsOutboxModule,
      providers: [
        {
          provide: 'OUTBOX_STORE',
          useValue: store,
        },
        {
          provide: 'OUTBOX_OPTIONS',
          useValue: options,
        },
      ],
      exports: ['OUTBOX_STORE', 'OUTBOX_OPTIONS'],
    };
  }
}
