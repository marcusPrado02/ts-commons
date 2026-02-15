export interface ReadRepositoryPort<T, TId> {
  findById(id: TId): Promise<T | null>;
  findAll(): Promise<T[]>;
  exists(id: TId): Promise<boolean>;
}

export interface WriteRepositoryPort<T, TId> {
  save(entity: T): Promise<void>;
  delete(id: TId): Promise<void>;
}

export interface RepositoryPort<T, TId>
  extends ReadRepositoryPort<T, TId>,
    WriteRepositoryPort<T, TId> {}
