/**
 * Probabilistic Bloom filter for negative caching.
 *
 * A Bloom filter can definitively state "definitely not in set" but only
 * "probably in set". Use it as a fast pre-check before expensive lookups to
 * skip work when the item is absent.
 *
 * @example
 * ```typescript
 * const filter = new BloomFilter(4096, 4);
 * filter.add('user:999');
 *
 * if (!filter.mightContain(key)) {
 *   return Option.none(); // definitely not cached — skip Redis + DB
 * }
 * // might be cached — proceed with normal lookup
 * ```
 */
export class BloomFilter {
  private readonly bits: Uint8Array;
  private readonly numHashes: number;
  private itemCount = 0;

  /**
   * @param bitSize   - Number of bits in the filter (default 1024). Larger
   *                    values reduce false positive rate.
   * @param hashCount - Number of independent hash functions (default 3).
   */
  constructor(
    private readonly bitSize: number = 1024,
    hashCount: number = 3,
  ) {
    this.bits = new Uint8Array(Math.ceil(bitSize / 8));
    this.numHashes = hashCount;
  }

  /** Add an item to the filter. */
  add(item: string): void {
    for (let i = 0; i < this.numHashes; i++) {
      const pos = this.hash(item, i) % this.bitSize;
      this.setBit(pos);
    }
    this.itemCount++;
  }

  /**
   * Return `false` if the item is definitely not in the set.
   * Return `true` if the item is probably in the set (may false-positive).
   */
  mightContain(item: string): boolean {
    for (let i = 0; i < this.numHashes; i++) {
      const pos = this.hash(item, i) % this.bitSize;
      if (!this.getBit(pos)) return false;
    }
    return true;
  }

  clear(): void {
    this.bits.fill(0);
    this.itemCount = 0;
  }

  getItemCount(): number {
    return this.itemCount;
  }

  /**
   * Rough upper-bound estimate of the current false-positive rate
   * based on the fraction of bits set.
   */
  estimatedFalsePositiveRate(): number {
    const bitsSet = this.countBitsSet();
    const fillRatio = bitsSet / this.bitSize;
    return Math.pow(fillRatio, this.numHashes);
  }

  // ── Bit manipulation ─────────────────────────────────────────────────────────

  private setBit(position: number): void {
    const byteIndex = Math.floor(position / 8);
    const bitMask = 1 << (position % 8);
    const current = this.bits[byteIndex] ?? 0;
    this.bits[byteIndex] = current | bitMask;
  }

  private getBit(position: number): boolean {
    const byteIndex = Math.floor(position / 8);
    const bitMask = 1 << (position % 8);
    return ((this.bits[byteIndex] ?? 0) & bitMask) !== 0;
  }

  private countBitsSet(): number {
    let count = 0;
    for (const byte of this.bits) {
      count += this.popcount(byte);
    }
    return count;
  }

  private popcount(byte: number): number {
    let b = byte;
    let count = 0;
    while (b > 0) {
      count += b & 1;
      b >>>= 1;
    }
    return count;
  }

  // ── Hashing ──────────────────────────────────────────────────────────────────

  private hash(item: string, seed: number): number {
    let h = (seed + 1) * 2654435761;
    for (let i = 0; i < item.length; i++) {
      h = Math.imul(h ^ item.charCodeAt(i), 2246822519);
      h ^= h >>> 13;
    }
    return Math.abs(h);
  }
}
