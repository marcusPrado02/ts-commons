/**
 * Represents an API version following a major.minor scheme.
 *
 * @example
 * ```ts
 * const v1 = ApiVersion.of(1);
 * const v2 = ApiVersion.of(2, 1);
 * const path = ApiVersion.of(1).toPath('/users'); // '/v1/users'
 * ```
 */
export class ApiVersion {
  readonly major: number;
  readonly minor: number;

  private constructor(major: number, minor: number) {
    this.major = major;
    this.minor = minor;
  }

  /** Creates an ApiVersion. `minor` defaults to 0. */
  static of(major: number, minor = 0): ApiVersion {
    if (major < 1) throw new Error('major version must be >= 1');
    if (minor < 0) throw new Error('minor version must be >= 0');
    return new ApiVersion(major, minor);
  }

  /** Parses a version string like "v1", "v2.1" or "1.0". */
  static parse(value: string): ApiVersion {
    const cleaned = value.replace(/^v/i, '');
    const parts = cleaned.split('.');
    const major = parseInt(parts[0] ?? '1', 10);
    const minor = parseInt(parts[1] ?? '0', 10);
    if (isNaN(major) || isNaN(minor)) {
      throw new Error(`Invalid API version: "${value}"`);
    }
    return ApiVersion.of(major, minor);
  }

  /** Returns the URL path segment, e.g. `"v1"` or `"v2"`. */
  toSegment(): string {
    return `v${this.major}`;
  }

  /** Prepends the version segment to a path: `/v1/users`. */
  toPath(path: string): string {
    const base = path.startsWith('/') ? path : `/${path}`;
    return `/${this.toSegment()}${base}`;
  }

  /** Returns `"1.0"` style string. */
  toString(): string {
    return `${this.major}.${this.minor}`;
  }

  /** True if this version has the same major as `other`. */
  isCompatibleWith(other: ApiVersion): boolean {
    return this.major === other.major;
  }

  /** Compares two versions. Returns -1, 0, or 1. */
  compareTo(other: ApiVersion): -1 | 0 | 1 {
    if (this.major !== other.major) return this.major < other.major ? -1 : 1;
    if (this.minor !== other.minor) return this.minor < other.minor ? -1 : 1;
    return 0;
  }

  equals(other: ApiVersion): boolean {
    return this.major === other.major && this.minor === other.minor;
  }
}
