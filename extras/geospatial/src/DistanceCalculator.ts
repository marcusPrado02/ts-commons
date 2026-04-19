import type { Point } from './types.js';

/** Earth mean radius in metres (WGS-84). */
const R = 6_371_000;

/**
 * Computes distances between geographic coordinates using the
 * **Haversine formula**, which accounts for the spherical shape of the Earth.
 *
 * All distances are returned in **metres**.
 *
 * @example
 * ```ts
 * const calc = new DistanceCalculator();
 * const d = calc.haversine({ lat: 51.5, lng: -0.1 }, { lat: 48.8, lng: 2.3 });
 * ```
 */
export class DistanceCalculator {
  /**
   * Haversine distance between two WGS-84 points, in metres.
   */
  haversine(from: Point, to: Point): number {
    const dLat = this.toRad(to.lat - from.lat);
    const dLng = this.toRad(to.lng - from.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(from.lat)) * Math.cos(this.toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /**
   * Returns `true` when `point` is within `radiusMeters` of `center`.
   */
  isWithinRadius(center: Point, point: Point, radiusMeters: number): boolean {
    return this.haversine(center, point) <= radiusMeters;
  }

  /**
   * Compute the total path length of an ordered sequence of points, in metres.
   * Returns 0 for arrays with fewer than 2 points.
   */
  pathLength(points: readonly Point[]): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += this.haversine(points[i - 1]!, points[i]!);
    }
    return total;
  }

  /**
   * Returns the bearing (0–360°) from `from` to `to`, measured clockwise
   * from true north.
   */
  bearing(from: Point, to: Point): number {
    const dLng = this.toRad(to.lng - from.lng);
    const y = Math.sin(dLng) * Math.cos(this.toRad(to.lat));
    const x =
      Math.cos(this.toRad(from.lat)) * Math.sin(this.toRad(to.lat)) -
      Math.sin(this.toRad(from.lat)) * Math.cos(this.toRad(to.lat)) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
