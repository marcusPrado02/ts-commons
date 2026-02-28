export class IncompatibleSchemaError extends Error {
  constructor(
    public readonly subject: string,
    public readonly reason?: string,
  ) {
    super(
      reason !== undefined
        ? `Schema for subject "${subject}" is incompatible: ${reason}`
        : `Schema for subject "${subject}" is incompatible`,
    );
    this.name = 'IncompatibleSchemaError';
  }
}

export class SubjectNotFoundError extends Error {
  constructor(public readonly subject: string) {
    super(`Subject not found: ${subject}`);
    this.name = 'SubjectNotFoundError';
  }
}

export class SchemaVersionNotFoundError extends Error {
  constructor(
    public readonly subject: string,
    public readonly version: number,
  ) {
    super(`Schema version ${version.toString()} not found for subject "${subject}"`);
    this.name = 'SchemaVersionNotFoundError';
  }
}
