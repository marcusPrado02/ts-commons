import type { GeoQueryExecutor, NearbyQuery, SpatialRecord } from './types.js';

/**
 * Executes spatial queries against a PostGIS-enabled PostgreSQL database.
 *
 * All SQL is delegated to the injected {@link GeoQueryExecutor}, keeping the
 * adapter fully testable without a real database connection.
 *
 * Geometry columns are assumed to use `SRID 4326` (WGS-84).
 *
 * @example
 * ```ts
 * const q = new PostGISQueryBuilder({ table: 'locations', executor });
 * const nearby = await q.findNearby({ center: { lat: 48.8, lng: 2.3 }, radiusMeters: 500 });
 * ```
 */
export class PostGISQueryBuilder {
  private readonly table: string;
  private readonly executor: GeoQueryExecutor;

  constructor(config: { table: string; executor: GeoQueryExecutor }) {
    this.table = config.table;
    this.executor = config.executor;
  }

  /**
   * Find all records within `radiusMeters` of `center`.
   * Returns records ordered by ascending distance.
   */
  async findNearby(query: NearbyQuery): Promise<SpatialRecord[]> {
    const sql = `
      SELECT id,
             ST_Y(location::geometry) AS lat,
             ST_X(location::geometry) AS lng,
             properties
      FROM ${this.table}
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
      ORDER BY ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      )
    `.trim();
    const rows = await this.executor(sql, [query.center.lng, query.center.lat, query.radiusMeters]);
    return rows.map((r) => this.rowToRecord(r));
  }

  /**
   * Find all records whose location falls within the given polygon WKT.
   *
   * @param wkt - Well-Known Text polygon, e.g. `POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))`
   */
  async findWithinPolygon(wkt: string): Promise<SpatialRecord[]> {
    const sql = `
      SELECT id,
             ST_Y(location::geometry) AS lat,
             ST_X(location::geometry) AS lng,
             properties
      FROM ${this.table}
      WHERE ST_Within(
        location::geometry,
        ST_GeomFromText($1, 4326)
      )
    `.trim();
    const rows = await this.executor(sql, [wkt]);
    return rows.map((r) => this.rowToRecord(r));
  }

  /**
   * Insert or update a spatial record.
   * Uses an `INSERT … ON CONFLICT (id) DO UPDATE` upsert.
   */
  async upsert(record: SpatialRecord): Promise<void> {
    const propsJson = JSON.stringify(record.properties ?? {});
    const sql = `
      INSERT INTO ${this.table} (id, location, properties)
      VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)
      ON CONFLICT (id) DO UPDATE
        SET location   = EXCLUDED.location,
            properties = EXCLUDED.properties
    `.trim();
    await this.executor(sql, [record.id, record.location.lng, record.location.lat, propsJson]);
  }

  /** Delete a record by id. */
  async delete(id: string): Promise<void> {
    await this.executor(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private rowToRecord(row: Record<string, unknown>): SpatialRecord {
    const record: SpatialRecord = {
      id: typeof row['id'] === 'string' ? row['id'] : '',
      location: {
        lat: Number(row['lat'] ?? 0),
        lng: Number(row['lng'] ?? 0),
      },
    };
    if (row['properties'] !== undefined && row['properties'] !== null) {
      record.properties =
        typeof row['properties'] === 'string'
          ? (JSON.parse(row['properties']) as Record<string, unknown>)
          : (row['properties'] as Record<string, unknown>);
    }
    return record;
  }
}
