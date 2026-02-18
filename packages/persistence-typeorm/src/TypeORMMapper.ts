/**
 * Mapper interface for converting between domain and persistence models
 */
export interface TypeORMMapper<TDomain, TPersistence> {
  /**
   * Convert domain entity to persistence entity
   */
  toPersistence(domain: TDomain): TPersistence;

  /**
   * Convert persistence entity to domain entity
   */
  toDomain(persistence: TPersistence): TDomain;
}
