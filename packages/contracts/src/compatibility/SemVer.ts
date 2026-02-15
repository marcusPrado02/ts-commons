import { ValueObject } from '@acme/kernel';

export class SemVer extends ValueObject<string> {
  private readonly major: number;
  private readonly minor: number;
  private readonly patch: number;

  private constructor(value: string) {
    super(value);
    const parts = value.split('.').map(Number);
    this.major = parts[0] ?? 0;
    this.minor = parts[1] ?? 0;
    this.patch = parts[2] ?? 0;
  }

  static create(version: string): SemVer {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error(`Invalid semver: ${version}`);
    }
    return new SemVer(version);
  }

  getMajor(): number {
    return this.major;
  }

  getMinor(): number {
    return this.minor;
  }

  getPatch(): number {
    return this.patch;
  }

  isCompatibleWith(other: SemVer): boolean {
    return this.major === other.major && this.minor >= other.minor;
  }
}
