import type { CdcEvent, CdcRawEvent, FilterOptions, TransformOptions } from './types.js';
import { EventNormalizer } from './EventNormalizer.js';
import { CdcFilter } from './CdcFilter.js';
import { CdcTransformer } from './CdcTransformer.js';

interface CdcProcessorOptions {
  readonly filter?: FilterOptions;
  readonly transform?: TransformOptions;
}

type CdcEventHandler = (event: CdcEvent) => void;

/**
 * Orchestrates the CDC pipeline: raw event → normalise → filter → transform → emit.
 *
 * Raw events from Debezium, PostgreSQL, MySQL or MongoDB are fed via {@link ingest}.
 * Subscribers registered with {@link subscribe} receive the processed, canonical
 * {@link CdcEvent} objects.
 *
 * @example
 * ```ts
 * const processor = new CdcProcessor({
 *   filter: { includeTables: ['orders'], includeOperations: ['insert', 'update'] },
 *   transform: { maskFields: ['credit_card'] },
 * });
 * processor.subscribe(event => console.log(event));
 * processor.ingest(rawEvent);
 * ```
 */
export class CdcProcessor {
  private readonly normalizer = new EventNormalizer();
  private readonly filter: CdcFilter;
  private readonly transformer: CdcTransformer;
  private readonly handlers = new Set<CdcEventHandler>();
  private processedCount = 0;
  private skippedCount = 0;

  constructor(options: CdcProcessorOptions = {}) {
    this.filter = new CdcFilter(options.filter);
    this.transformer = new CdcTransformer(options.transform);
  }

  /**
   * Register a handler that will be called for each event that passes the filter.
   * Returns an unsubscribe function.
   */
  subscribe(handler: CdcEventHandler): () => void {
    this.handlers.add(handler);
    return (): void => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Ingest a raw CDC event and run it through the pipeline.
   * Events that fail normalisation or filtering are silently dropped;
   * {@link skipped} is incremented accordingly.
   */
  ingest(raw: CdcRawEvent): void {
    const normalized = this.normalizer.normalize(raw);
    if (normalized === null) {
      this.skippedCount++;
      return;
    }
    if (!this.filter.matches(normalized)) {
      this.skippedCount++;
      return;
    }
    const transformed = this.transformer.transform(normalized);
    this.processedCount++;
    for (const handler of this.handlers) handler(transformed);
  }

  /**
   * Process a batch of raw events.
   */
  ingestAll(events: ReadonlyArray<CdcRawEvent>): void {
    for (const event of events) this.ingest(event);
  }

  /** Total events that were successfully processed and emitted. */
  get processed(): number {
    return this.processedCount;
  }

  /** Events dropped due to normalisation failure or filter exclusion. */
  get skipped(): number {
    return this.skippedCount;
  }
}
