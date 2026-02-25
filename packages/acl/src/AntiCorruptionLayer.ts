import type { Translator, DataConverter, ProtocolAdapter } from './types.js';
import { TranslatorRegistry } from './TranslatorRegistry.js';
import { DataFormatRegistry } from './DataFormatRegistry.js';
import { ProtocolAdapterRegistry } from './ProtocolAdapterRegistry.js';

/**
 * Central facade that composes all ACL registries.
 *
 * Use this class as the single entry point for anti-corruption layer concerns:
 * - Translate value objects between contexts via a named {@link Translator}.
 * - Convert raw data payloads between formats via a {@link DataConverter}.
 * - Map requests/responses between external protocols and the internal domain
 *   via a {@link ProtocolAdapter}.
 *
 * @example
 * const acl = new AntiCorruptionLayer()
 *   .registerTranslator('legacy-user', new LegacyUserTranslator())
 *   .registerConverter(new JsonToCsvConverter())
 *   .registerProtocolAdapter('rest-v1', new RestV1Adapter());
 *
 * const user = acl.translate<LegacyUserDto, User>('legacy-user', legacyDto);
 */
export class AntiCorruptionLayer {
  private readonly translators = new TranslatorRegistry();
  private readonly converters = new DataFormatRegistry();
  private readonly protocols = new ProtocolAdapterRegistry();

  // ── Translators ────────────────────────────────────────────────────────────

  /** Register a synchronous translator under `key`. Returns `this`. */
  registerTranslator<TSource, TTarget>(
    key: string,
    translator: Translator<TSource, TTarget>,
  ): this {
    this.translators.register(key, translator);
    return this;
  }

  /**
   * Translate `source` using the translator registered under `key`.
   * @throws {Error} if no translator is registered for `key`.
   */
  translate<TSource, TTarget>(key: string, source: TSource): TTarget {
    return this.translators.translate(key, source);
  }

  /** Returns `true` if a translator is registered under `key`. */
  hasTranslator(key: string): boolean {
    return this.translators.has(key);
  }

  // ── Data format converters ─────────────────────────────────────────────────

  /** Register a data format converter. Returns `this`. */
  registerConverter<TFrom, TTo>(converter: DataConverter<TFrom, TTo>): this {
    this.converters.register(converter);
    return this;
  }

  /**
   * Convert `data` from `fromFormat` to `toFormat`.
   * @throws {Error} if no converter is registered for the format pair.
   */
  convert<TFrom, TTo>(fromFormat: string, toFormat: string, data: TFrom): TTo {
    return this.converters.convert(fromFormat, toFormat, data);
  }

  /** Returns `true` if a converter exists for the given format pair. */
  hasConverter(fromFormat: string, toFormat: string): boolean {
    return this.converters.has(fromFormat, toFormat);
  }

  // ── Protocol adapters ──────────────────────────────────────────────────────

  /** Register a protocol adapter under `key`. Returns `this`. */
  registerProtocolAdapter<TExtReq, TIntReq, TIntRes, TExtRes>(
    key: string,
    adapter: ProtocolAdapter<TExtReq, TIntReq, TIntRes, TExtRes>,
  ): this {
    this.protocols.register(key, adapter);
    return this;
  }

  /**
   * Translate an external request to the internal domain model.
   * @throws {Error} if no adapter is registered for `key`.
   */
  adaptRequest<TExtReq, TIntReq>(key: string, external: TExtReq): TIntReq {
    return this.protocols.adaptRequest(key, external);
  }

  /**
   * Translate an internal response to the external wire representation.
   * @throws {Error} if no adapter is registered for `key`.
   */
  adaptResponse<TIntRes, TExtRes>(key: string, internal: TIntRes): TExtRes {
    return this.protocols.adaptResponse(key, internal);
  }

  /** Returns `true` if a protocol adapter is registered under `key`. */
  hasProtocolAdapter(key: string): boolean {
    return this.protocols.has(key);
  }
}
