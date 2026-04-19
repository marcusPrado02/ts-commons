import type { CRS, Point, ProjectedPoint } from './types.js';

/** Earth radius in metres (WGS-84 mean). */
const EARTH_RADIUS_M = 6_371_000;

/** Origin half-circumference used for Web Mercator. */
const MERCATOR_ORIGIN = 20_037_508.342_789_244;

/**
 * Converts coordinates between {@link CRS} projections.
 *
 * Supported conversions:
 * - **WGS84 → WebMercator** (EPSG:4326 → EPSG:3857)
 * - **WebMercator → WGS84** (EPSG:3857 → EPSG:4326)
 * - Identity conversion (same CRS) is a no-op.
 *
 * @example
 * ```ts
 * const cs = new CoordinateSystem();
 * const merc = cs.toWebMercator({ lat: 48.8566, lng: 2.3522 });
 * const back  = cs.toWGS84(merc);
 * ```
 */
export class CoordinateSystem {
  /**
   * Convert a WGS-84 {@link Point} to a Web Mercator {@link ProjectedPoint}.
   * Latitude is clamped to ±85.051129° to avoid infinite values at the poles.
   */
  toWebMercator(point: Point): ProjectedPoint {
    const lat = Math.max(-85.051_129, Math.min(85.051_129, point.lat));
    const x = (point.lng / 180) * MERCATOR_ORIGIN;
    const latRad = (lat * Math.PI) / 180;
    const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * (MERCATOR_ORIGIN / Math.PI);
    return { x, y, crs: 'WebMercator' };
  }

  /**
   * Convert a Web Mercator {@link ProjectedPoint} back to WGS-84 {@link Point}.
   */
  toWGS84(projected: ProjectedPoint): Point {
    const lng = (projected.x / MERCATOR_ORIGIN) * 180;
    const lat =
      (Math.atan(Math.exp((projected.y / MERCATOR_ORIGIN) * Math.PI)) * 360) / Math.PI - 90;
    return { lat, lng };
  }

  /**
   * Generic conversion entry point.
   * Converts `point` from its current `sourceCRS` to `targetCRS`.
   */
  convert(point: Point, sourceCRS: CRS, targetCRS: CRS): Point | ProjectedPoint {
    if (sourceCRS === targetCRS) return point;
    if (sourceCRS === 'WGS84' && targetCRS === 'WebMercator') return this.toWebMercator(point);
    if (sourceCRS === 'WebMercator' && targetCRS === 'WGS84') {
      return this.toWGS84({ x: point.lng, y: point.lat, crs: 'WebMercator' });
    }
    return point;
  }

  /** Earth radius constant exposed for downstream use. */
  static get EARTH_RADIUS_M(): number {
    return EARTH_RADIUS_M;
  }
}
