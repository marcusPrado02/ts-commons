/**
 * Manages named configuration profiles and tracks the active one.
 * Profiles inherit values from the `default` profile (if registered)
 * and may override individual keys.
 */
export class ProfileManager {
  private readonly profiles = new Map<string, Record<string, unknown>>();
  private activeProfile = 'default';

  /** Register a named profile with its configuration values. */
  register(name: string, values: Record<string, unknown>): void {
    this.profiles.set(name, values);
  }

  /** Activate a profile by name. Throws if the profile is not registered. */
  activate(name: string): void {
    if (!this.profiles.has(name)) {
      throw new Error(`Profile not found: ${name}`);
    }
    this.activeProfile = name;
  }

  /**
   * Get a value from the active profile.
   * Falls back to the `default` profile when the key is not found in the
   * active profile.
   */
  get<T = unknown>(key: string): T | undefined {
    const active = this.profiles.get(this.activeProfile);
    if (active !== undefined && key in active) {
      return active[key] as T;
    }
    if (this.activeProfile !== 'default') {
      return this.profiles.get('default')?.[key] as T | undefined;
    }
    return undefined;
  }

  /** Return merged values: default profile overridden by the active profile. */
  getAll(): Record<string, unknown> {
    const defaults = this.profiles.get('default') ?? {};
    if (this.activeProfile === 'default') return { ...defaults };
    const active = this.profiles.get(this.activeProfile) ?? {};
    return { ...defaults, ...active };
  }

  /** List all registered profile names. */
  list(): string[] {
    return [...this.profiles.keys()];
  }

  get current(): string {
    return this.activeProfile;
  }

  get profileCount(): number {
    return this.profiles.size;
  }
}
