export type SchemaId = number;
export type CompatibilityMode = 'NONE' | 'BACKWARD' | 'FORWARD' | 'FULL';
export type SchemaType = 'JSON' | 'AVRO' | 'PROTOBUF';

export interface SchemaField {
  name: string;
  type: string;
  optional?: boolean;
}

export interface Schema {
  type: SchemaType;
  fields: SchemaField[];
  namespace?: string;
}

export interface SchemaVersion {
  id: SchemaId;
  version: number;
  schema: Schema;
  subject: string;
  createdAt: Date;
}
