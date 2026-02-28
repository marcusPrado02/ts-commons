import type { BoundingBox, Point } from './types.js';
import type { GeoJSONPolygon } from './types.js';

/**
 * Determines whether geographic points are inside a defined fence.
 *
 * Two fence shapes are supported:
 * - **Circular** — defined by a centre point and radius
 * - **Polygon** — defined by a GeoJSON polygon (exterior ring only)
 *   using the ray-casting algorithm
 *
 * @example
 * ```ts
 * const geo = new Geofence();
 * const inside = geo.isInsideCircle({ lat: 51.5, lng: -0.1 }, { lat: 51.5, lng: -0.09 }, 1000);
 * ```
 */
export class Geofence {
  /**
   * Returns `true` when `point` is within `radiusMeters` of `center`.
   * Uses the Haversine formula for accurate spherical distance.
   */
  isInsideCircle(center: Point, point: Point, radiusMeters: number): boolean {
    const dist = this.haversine(center, point);
    return dist <= radiusMeters;
  }

  /**
   * Returns `true` when `point` lies inside the exterior ring of `polygon`
   * (holes are ignored). Uses the ray-casting algorithm.
   */
  isInsidePolygon(polygon: GeoJSONPolygon, point: Point): boolean {
    const ring = polygon.coordinates[0];
    if (ring === undefined || ring.length < 3) return false;
    return this.rayCast(ring, point.lat, point.lng);
  }

  /**
   * Returns `true` when `point` is inside `box`.
   */
  isInsideBoundingBox(box: BoundingBox, point: Point): boolean {
    return (
      point.lat >= box.minLat &&
      point.lat <= box.maxLat &&
      point.lng >= box.minLng &&
      point.lng <= box.maxLng
    );
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Haversine distance in metres — local copy to avoid circular imports. */
  private haversine(from: Point, to: Point): number {
    const R = 6_371_000;
    const toRad = (d: number): number => (d * Math.PI) / 180;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /** Ray-casting point-in-polygon test (lon/lat treated as x/y). */
  private rayCast(ring: Array<[number, number]>, lat: number, lng: number): boolean {
    let inside = false;
    const n = ring.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }
}
