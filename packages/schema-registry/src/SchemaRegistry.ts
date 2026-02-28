/* eslint-disable @typescript-eslint/require-await */
import type { Schema, SchemaId, SchemaVersion, CompatibilityMode } from './types';
import {
  IncompatibleSchemaError,
  SubjectNotFoundError,
  SchemaVersionNotFoundError,
} from './errors';

/**
 * In-memory Schema Registry compatible with the Confluent Schema Registry API
 * concepts: subjects, versions, compatibility modes.
 *
 * Supports JSON, Avro, and Protobuf schema types.
 * Enforces BACKWARD, FORWARD, FULL, or NONE compatibility.
 */
export class SchemaRegistry {
  private readonly subjects = new Map<string, SchemaVersion[]>();
  private readonly globalCompatibility: CompatibilityMode;
  private readonly subjectCompatibility = new Map<string, CompatibilityMode>();
  private nextId = 1;

  constructor(defaultCompatibility: CompatibilityMode = 'BACKWARD') {
    this.globalCompatibility = defaultCompatibility;
  }

  /**
   * Register a schema under `subject`. Compatibility is checked against the
   * latest version (if one exists). Returns the assigned SchemaId.
   */
  async register(subject: string, schema: Schema): Promise<SchemaId> {
    const existing = this.subjects.get(subject) ?? [];
    if (existing.length > 0) {
      const latest = existing[existing.length - 1]!.schema;
      const mode = this.subjectCompatibility.get(subject) ?? this.globalCompatibility;
      const compatible = this.checkCompatibility(latest, schema, mode);
      if (!compatible) {
        throw new IncompatibleSchemaError(subject);
      }
    }
    const id = this.nextId++;
    const version: SchemaVersion = {
      id,
      version: existing.length + 1,
      schema,
      subject,
      createdAt: new Date(),
    };
    this.subjects.set(subject, [...existing, version]);
    return id;
  }

  /** Get the latest schema version for a subject. */
  async getLatest(subject: string): Promise<Schema> {
    const versions = this.subjects.get(subject);
    if (versions === undefined || versions.length === 0) {
      throw new SubjectNotFoundError(subject);
    }
    return versions[versions.length - 1]!.schema;
  }

  /** Get a specific version for a subject. */
  async getVersion(subject: string, version: number): Promise<SchemaVersion> {
    const versions = this.subjects.get(subject);
    const found = versions?.find((v) => v.version === version);
    if (found === undefined) {
      throw new SchemaVersionNotFoundError(subject, version);
    }
    return found;
  }

  /** List all subjects currently registered. */
  listSubjects(): string[] {
    return [...this.subjects.keys()];
  }

  /** List all version numbers for a subject. */
  listVersions(subject: string): number[] {
    return (this.subjects.get(subject) ?? []).map((v) => v.version);
  }

  /** Delete a subject and all its versions. */
  deleteSubject(subject: string): boolean {
    return this.subjects.delete(subject);
  }

  /** Set per-subject compatibility mode. */
  setCompatibility(subject: string, mode: CompatibilityMode): void {
    this.subjectCompatibility.set(subject, mode);
  }

  /** Get compatibility mode for a subject (or global default). */
  getCompatibility(subject: string): CompatibilityMode {
    return this.subjectCompatibility.get(subject) ?? this.globalCompatibility;
  }

  /**
   * Check whether `next` schema is compatible with `existing` under `mode`.
   *
   * Rules (field-name based for JSON/Avro/Protobuf approximation):
   * - NONE: always compatible
   * - BACKWARD: new schema can read data written by old schema
   *   → may add optional fields; must not remove required fields
   * - FORWARD: old schema can read data written by new schema
   *   → may add required fields; must not remove optional fields
   * - FULL: both BACKWARD and FORWARD
   */
  checkCompatibility(existing: Schema, next: Schema, mode: CompatibilityMode): boolean {
    if (mode === 'NONE') return true;
    const existingFields = new Map(existing.fields.map((f) => [f.name, f]));
    const nextFields = new Map(next.fields.map((f) => [f.name, f]));
    if (mode === 'BACKWARD' || mode === 'FULL') {
      if (!this.backwardCheck(existingFields, nextFields)) return false;
    }
    if (mode === 'FORWARD' || mode === 'FULL') {
      if (!this.forwardCheck(existingFields, nextFields)) return false;
    }
    return true;
  }

  private backwardCheck(
    existingFields: Map<string, { optional?: boolean }>,
    nextFields: Map<string, unknown>,
  ): boolean {
    for (const [name, field] of existingFields) {
      if (field.optional !== true && !nextFields.has(name)) return false;
    }
    return true;
  }

  private forwardCheck(
    existingFields: Map<string, { optional?: boolean }>,
    nextFields: Map<string, unknown>,
  ): boolean {
    for (const [name, field] of existingFields) {
      if (field.optional === true && !nextFields.has(name)) return false;
    }
    return true;
  }

  get subjectCount(): number {
    return this.subjects.size;
  }
}
