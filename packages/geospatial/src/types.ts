/**
 * Core types for the `@acme/geospatial` package.
 */

/** WGS-84 longitude, clamped to -180..180. */
export type Longitude = number;

/** WGS-84 latitude, clamped to -90..90. */
export type Latitude = number;

/** A geographic point in WGS-84 decimal degrees. */
export interface Point {
  lat: Latitude;
  lng: Longitude;
}

/** An axis-aligned bounding rectangular region. */
export interface BoundingBox {
  minLat: Latitude;
  maxLat: Latitude;
  minLng: Longitude;
  maxLng: Longitude;
}

/** Supported Coordinate Reference Systems. */
export type CRS = 'WGS84' | 'WebMercator';

/** A point in a projected coordinate system (metres). */
export interface ProjectedPoint {
  x: number;
  y: number;
  crs: CRS;
}

// ─── GeoJSON ──────────────────────────────────────────────────────────────────

/** GeoJSON Point geometry. Coordinates are [longitude, latitude]. */
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number];
}

/** GeoJSON LineString geometry. */
export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: Array<[number, number]>;
}

/**
 * GeoJSON Polygon geometry.
 * First ring is the exterior; subsequent rings are holes.
 */
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>;
}

/** Any supported GeoJSON geometry. */
export type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon;

/** GeoJSON Feature wrapping a geometry with optional properties. */
export interface GeoJSONFeature<G extends GeoJSONGeometry = GeoJSONGeometry> {
  type: 'Feature';
  geometry: G;
  properties?: Record<string, unknown>;
}

/** GeoJSON FeatureCollection. */
export interface GeoJSONFeatureCollection<G extends GeoJSONGeometry = GeoJSONGeometry> {
  type: 'FeatureCollection';
  features: Array<GeoJSONFeature<G>>;
}

// ─── Spatial domain ───────────────────────────────────────────────────────────

/** A record stored in a spatial data source, identified by a string id. */
export interface SpatialRecord {
  id: string;
  location: Point;
  properties?: Record<string, unknown>;
}

/** Query for records within a circular radius. */
export interface NearbyQuery {
  center: Point;
  radiusMeters: number;
}

// ─── PostGIS ──────────────────────────────────────────────────────────────────

/** Generic SQL executor for PostGIS queries. */
export type GeoQueryExecutor = (
  sql: string,
  params?: unknown[],
) => Promise<Record<string, unknown>[]>;

/** PostGIS query results returned per-row. */
export interface PostGISRow {
  id: string;
  lat: number;
  lng: number;
  properties?: Record<string, unknown>;
}
