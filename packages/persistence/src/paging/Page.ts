export interface Page<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly sort?: Sort[];
}

export interface Sort {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}
