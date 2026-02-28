import type {
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  GeoJSONGeometry,
  GeoJSONLineString,
  GeoJSONPoint,
  GeoJSONPolygon,
  Point,
} from './types.js';

/**
 * Serialises and deserialises GeoJSON geometries and features.
 *
 * This helper keeps the rest of the library independent of format details and
 * makes it easy to interchange data with external mapping tools.
 *
 * @example
 * ```ts
 * const io = new GeoJSONIO();
 * const feature = io.pointToFeature({ lat: 51.5, lng: -0.1 }, { name: 'London' });
 * const point   = io.featureToPoint(feature);
 * ```
 */
export class GeoJSONIO {
  // ── Serialisation ──────────────────────────────────────────────────────────

  /** Create a GeoJSON Point geometry from a {@link Point}. */
  toPoint(point: Point): GeoJSONPoint {
    return { type: 'Point', coordinates: [point.lng, point.lat] };
  }

  /** Create a GeoJSON LineString geometry from an ordered array of {@link Point}s. */
  toLineString(points: readonly Point[]): GeoJSONLineString {
    return {
      type: 'LineString',
      coordinates: points.map((p) => [p.lng, p.lat]),
    };
  }

  /**
   * Create a GeoJSON Polygon geometry from an exterior ring.
   * The ring is automatically closed (first point appended if not already equal
   * to the last point).
   */
  toPolygon(ring: readonly Point[]): GeoJSONPolygon {
    const coords = ring.map((p): [number, number] => [p.lng, p.lat]);
    if (coords.length === 0) return { type: 'Polygon', coordinates: [[]] };
    const first = coords[0] as [number, number];
    const last = coords[coords.length - 1] as [number, number];
    const isClosed = first[0] === last[0] && first[1] === last[1];
    if (!isClosed) coords.push(first);
    return { type: 'Polygon', coordinates: [coords] };
  }

  /** Wrap any geometry in a GeoJSON Feature. */
  toFeature<G extends GeoJSONGeometry>(
    geometry: G,
    properties?: Record<string, unknown>,
  ): GeoJSONFeature<G> {
    const f: GeoJSONFeature<G> = { type: 'Feature', geometry };
    if (properties !== undefined) f.properties = properties;
    return f;
  }

  /** Shorthand: create a Point Feature from a {@link Point}. */
  pointToFeature(point: Point, properties?: Record<string, unknown>): GeoJSONFeature<GeoJSONPoint> {
    return this.toFeature(this.toPoint(point), properties);
  }

  /** Wrap an array of features in a FeatureCollection. */
  toFeatureCollection<G extends GeoJSONGeometry>(
    features: Array<GeoJSONFeature<G>>,
  ): GeoJSONFeatureCollection<G> {
    return { type: 'FeatureCollection', features };
  }

  // ── Deserialisation ────────────────────────────────────────────────────────

  /** Extract a {@link Point} from a GeoJSON Point geometry. */
  fromPoint(g: GeoJSONPoint): Point {
    return { lat: g.coordinates[1], lng: g.coordinates[0] };
  }

  /** Extract a {@link Point} from a Feature containing a GeoJSON Point. */
  featureToPoint(f: GeoJSONFeature<GeoJSONPoint>): Point {
    return this.fromPoint(f.geometry);
  }

  /** Extract an ordered array of {@link Point}s from a LineString geometry. */
  fromLineString(g: GeoJSONLineString): Point[] {
    return g.coordinates.map(([lng, lat]) => ({ lat, lng }));
  }

  /** Extract the exterior ring as {@link Point}s from a Polygon geometry. */
  fromPolygon(g: GeoJSONPolygon): Point[] {
    return (g.coordinates[0] ?? []).map(([lng, lat]) => ({ lat, lng }));
  }

  // ── Validation helpers ─────────────────────────────────────────────────────

  /** Returns `true` when the value appears to be a valid GeoJSON geometry object. */
  isGeometry(value: unknown): value is GeoJSONGeometry {
    if (value === null || typeof value !== 'object') return false;
    const v = value as { type?: unknown };
    return v.type === 'Point' || v.type === 'LineString' || v.type === 'Polygon';
  }

  /** Returns `true` when all coordinates of a LineString are valid WGS-84 values. */
  isValidLineString(g: GeoJSONLineString): boolean {
    return g.coordinates.every(([lng, lat]) => this.isValidCoord(lat, lng));
  }

  /** Returns `true` when the Point's coordinates are valid WGS-84. */
  isValidPoint(g: GeoJSONPoint): boolean {
    const [lng, lat] = g.coordinates;
    return this.isValidCoord(lat, lng);
  }

  private isValidCoord(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }
}
