/**
 * Bidirectional mapper interface for MongoDB documents.
 *
 * Consumers implement this interface to convert between domain entities and
 * MongoDB document plain objects (`Record<string, unknown>`).
 *
 * @template TDomain     - Domain entity type
 * @template TDocument   - MongoDB document shape (defaults to plain Record)
 *
 * @example
 * ```typescript
 * class UserMongoMapper implements MongoMapper<User> {
 *   toDocument(domain: User): Record<string, unknown> {
 *     return { _id: domain.id.value, name: domain.name, email: domain.email };
 *   }
 *   toDomain(doc: Record<string, unknown>): User {
 *     return { id: { value: doc['_id'] as string }, name: doc['name'] as string, email: doc['email'] as string };
 *   }
 * }
 * ```
 */
export interface MongoMapper<
  TDomain,
  TDocument extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Convert a domain entity to a plain MongoDB document object. */
  toDocument(domain: TDomain): TDocument;

  /** Convert a MongoDB document plain object to a domain entity. */
  toDomain(document: TDocument): TDomain;
}
