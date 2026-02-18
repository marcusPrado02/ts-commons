/**
 * TypeORM adapter for Clean Architecture repositories
 *
 * This package provides TypeORM implementations of repository patterns,
 * unit of work, pagination, and other persistence abstractions.
 */

export { TypeORMRepository } from './TypeORMRepository';
export { TypeORMUnitOfWork } from './TypeORMUnitOfWork';
export { TypeORMPaginator } from './TypeORMPaginator';
export type { TypeORMMapper } from './TypeORMMapper';
