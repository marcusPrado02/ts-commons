/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import {
  CoordinateSystem,
  DistanceCalculator,
  Geofence,
  PostGISQueryBuilder,
  GeoJSONIO,
} from './index.js';
import type { GeoQueryExecutor, Point, GeoJSONPolygon, SpatialRecord } from './index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeExecutor(rows: Record<string, unknown>[] = []): GeoQueryExecutor {
  return vi.fn().mockResolvedValue(rows);
}

const LONDON: Point = { lat: 51.5074, lng: -0.1278 };
const PARIS: Point = { lat: 48.8566, lng: 2.3522 };

// ─── CoordinateSystem ─────────────────────────────────────────────────────────

describe('CoordinateSystem', () => {
  const cs = new CoordinateSystem();

  it('toWebMercator() converts lat/lng to x/y (crs = WebMercator)', () => {
    const m = cs.toWebMercator({ lat: 0, lng: 0 });
    expect(m.crs).toBe('WebMercator');
    expect(m.x).toBeCloseTo(0, 0);
    expect(m.y).toBeCloseTo(0, 0);
  });

  it('toWebMercator() non-zero point produces expected approximate values', () => {
    const m = cs.toWebMercator(LONDON);
    expect(m.x).toBeCloseTo(-14_220, -2); // ~-14 220 m
    expect(m.y).toBeCloseTo(6_711_000, -4); // ~6 711 km northing (precision ±10 km)
  });

  it('toWGS84() round-trips back from WebMercator', () => {
    const m = cs.toWebMercator(PARIS);
    const p = cs.toWGS84(m);
    expect(p.lat).toBeCloseTo(PARIS.lat, 4);
    expect(p.lng).toBeCloseTo(PARIS.lng, 4);
  });

  it('toWebMercator() clamps latitude > 85.051129', () => {
    const m = cs.toWebMercator({ lat: 90, lng: 0 });
    expect(Number.isFinite(m.y)).toBe(true);
  });

  it('toWebMercator() clamps latitude < -85.051129', () => {
    const m = cs.toWebMercator({ lat: -90, lng: 0 });
    expect(Number.isFinite(m.y)).toBe(true);
  });

  it('convert() WGS84→WebMercator returns ProjectedPoint', () => {
    const result = cs.convert(LONDON, 'WGS84', 'WebMercator');
    expect((result as any).crs).toBe('WebMercator');
  });

  it('convert() identity (same CRS) returns original point', () => {
    const result = cs.convert(LONDON, 'WGS84', 'WGS84');
    expect(result).toStrictEqual(LONDON);
  });

  it('EARTH_RADIUS_M constant is ~6 371 000', () => {
    expect(CoordinateSystem.EARTH_RADIUS_M).toBeCloseTo(6_371_000, -3);
  });
});

// ─── DistanceCalculator ───────────────────────────────────────────────────────

describe('DistanceCalculator', () => {
  const calc = new DistanceCalculator();

  it('haversine() London→Paris is ~340 km', () => {
    const dist = calc.haversine(LONDON, PARIS);
    expect(dist).toBeGreaterThan(335_000);
    expect(dist).toBeLessThan(345_000);
  });

  it('haversine() same point is 0', () => {
    expect(calc.haversine(LONDON, LONDON)).toBeCloseTo(0, 5);
  });

  it('haversine() is symmetric', () => {
    const ab = calc.haversine(LONDON, PARIS);
    const ba = calc.haversine(PARIS, LONDON);
    expect(ab).toBeCloseTo(ba, 2);
  });

  it('isWithinRadius() true when point is near center', () => {
    const close: Point = { lat: 51.508, lng: -0.128 };
    expect(calc.isWithinRadius(LONDON, close, 1000)).toBe(true);
  });

  it('isWithinRadius() false when point is far', () => {
    expect(calc.isWithinRadius(LONDON, PARIS, 1000)).toBe(false);
  });

  it('isWithinRadius() true when distance exactly equals radius', () => {
    const dist = calc.haversine(LONDON, PARIS);
    expect(calc.isWithinRadius(LONDON, PARIS, dist)).toBe(true);
  });

  it('pathLength() returns 0 for single point', () => {
    expect(calc.pathLength([LONDON])).toBe(0);
  });

  it('pathLength() returns 0 for empty array', () => {
    expect(calc.pathLength([])).toBe(0);
  });

  it('pathLength() sums segment distances', () => {
    const mid: Point = { lat: 50.0, lng: 1.0 };
    const total = calc.pathLength([LONDON, mid, PARIS]);
    const seg1 = calc.haversine(LONDON, mid);
    const seg2 = calc.haversine(mid, PARIS);
    expect(total).toBeCloseTo(seg1 + seg2, 2);
  });

  it('bearing() London→Paris is roughly south-southeast (~140–160°)', () => {
    const b = calc.bearing(LONDON, PARIS);
    expect(b).toBeGreaterThan(140);
    expect(b).toBeLessThan(160);
  });

  it('bearing() north returns ~0°', () => {
    const b = calc.bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(b).toBeCloseTo(0, 0);
  });

  it('bearing() east returns ~90°', () => {
    const b = calc.bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(b).toBeCloseTo(90, 0);
  });
});

// ─── Geofence ─────────────────────────────────────────────────────────────────

describe('Geofence', () => {
  const fence = new Geofence();

  const squarePolygon: GeoJSONPolygon = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [0, 2],
        [2, 2],
        [2, 0],
        [0, 0],
      ],
    ],
  };

  it('isInsideCircle() returns true for point within radius', () => {
    const close: Point = { lat: 51.508, lng: -0.127 };
    expect(fence.isInsideCircle(LONDON, close, 2000)).toBe(true);
  });

  it('isInsideCircle() returns false for point outside radius', () => {
    expect(fence.isInsideCircle(LONDON, PARIS, 1000)).toBe(false);
  });

  it('isInsidePolygon() returns true for point inside square', () => {
    const inside: Point = { lat: 1, lng: 1 };
    expect(fence.isInsidePolygon(squarePolygon, inside)).toBe(true);
  });

  it('isInsidePolygon() returns false for point outside square', () => {
    const outside: Point = { lat: 3, lng: 3 };
    expect(fence.isInsidePolygon(squarePolygon, outside)).toBe(false);
  });

  it('isInsidePolygon() returns false for degenerate polygon (< 3 vertices)', () => {
    const bad: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 1],
        ],
      ],
    };
    expect(fence.isInsidePolygon(bad, { lat: 0.5, lng: 0.5 })).toBe(false);
  });

  it('isInsidePolygon() returns false for empty polygon', () => {
    const empty: GeoJSONPolygon = { type: 'Polygon', coordinates: [] };
    expect(fence.isInsidePolygon(empty, { lat: 0, lng: 0 })).toBe(false);
  });

  it('isInsideBoundingBox() true for point inside box', () => {
    const box = { minLat: 50, maxLat: 52, minLng: -1, maxLng: 1 };
    expect(fence.isInsideBoundingBox(box, { lat: 51, lng: 0 })).toBe(true);
  });

  it('isInsideBoundingBox() false for point outside box', () => {
    const box = { minLat: 50, maxLat: 52, minLng: -1, maxLng: 1 };
    expect(fence.isInsideBoundingBox(box, { lat: 53, lng: 0 })).toBe(false);
  });

  it('isInsideBoundingBox() true for point on boundary', () => {
    const box = { minLat: 50, maxLat: 52, minLng: -1, maxLng: 1 };
    expect(fence.isInsideBoundingBox(box, { lat: 50, lng: -1 })).toBe(true);
  });
});

// ─── PostGISQueryBuilder ──────────────────────────────────────────────────────

describe('PostGISQueryBuilder', () => {
  function makeBuilder(rows: Record<string, unknown>[] = []) {
    const executor = makeExecutor(rows);
    const builder = new PostGISQueryBuilder({ table: 'locations', executor });
    return { builder, executor };
  }

  it('findNearby() calls executor with ST_DWithin SQL', async () => {
    const { builder, executor } = makeBuilder();
    await builder.findNearby({ center: LONDON, radiusMeters: 500 });
    const sql = (executor as any).mock.calls[0]![0] as string;
    expect(sql).toContain('ST_DWithin');
    expect(sql).toContain('locations');
  });

  it('findNearby() passes lng, lat, radius as params', async () => {
    const { builder, executor } = makeBuilder();
    await builder.findNearby({ center: LONDON, radiusMeters: 500 });
    const params = (executor as any).mock.calls[0]![1] as unknown[];
    expect(params[0]).toBe(LONDON.lng);
    expect(params[1]).toBe(LONDON.lat);
    expect(params[2]).toBe(500);
  });

  it('findNearby() maps rows to SpatialRecords', async () => {
    const { builder } = makeBuilder([{ id: 'place1', lat: 51.51, lng: -0.12, properties: null }]);
    const results = await builder.findNearby({ center: LONDON, radiusMeters: 1000 });
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('place1');
    expect(results[0]?.location.lat).toBe(51.51);
  });

  it('findNearby() parses JSON string properties', async () => {
    const { builder } = makeBuilder([
      { id: 'p1', lat: 51.5, lng: -0.1, properties: '{"name":"test"}' },
    ]);
    const results = await builder.findNearby({ center: LONDON, radiusMeters: 1000 });
    expect(results[0]?.properties?.['name']).toBe('test');
  });

  it('findWithinPolygon() passes WKT param', async () => {
    const { builder, executor } = makeBuilder();
    const wkt = 'POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))';
    await builder.findWithinPolygon(wkt);
    const sql = (executor as any).mock.calls[0]![0] as string;
    const params = (executor as any).mock.calls[0]![1] as unknown[];
    expect(sql).toContain('ST_Within');
    expect(params[0]).toBe(wkt);
  });

  it('findWithinPolygon() returns mapped SpatialRecords', async () => {
    const { builder } = makeBuilder([{ id: 'r1', lat: 0.5, lng: 0.5, properties: null }]);
    const results = await builder.findWithinPolygon('POLYGON(...)');
    expect(results[0]?.id).toBe('r1');
  });

  it('upsert() calls executor with INSERT ON CONFLICT SQL', async () => {
    const { builder, executor } = makeBuilder();
    const record: SpatialRecord = { id: 'loc1', location: LONDON };
    await builder.upsert(record);
    const sql = (executor as any).mock.calls[0]![0] as string;
    expect(sql).toContain('INSERT INTO locations');
    expect(sql).toContain('ON CONFLICT (id) DO UPDATE');
  });

  it('upsert() passes id, lng, lat, props as params', async () => {
    const { builder, executor } = makeBuilder();
    const record: SpatialRecord = { id: 'loc1', location: LONDON, properties: { x: 1 } };
    await builder.upsert(record);
    const params = (executor as any).mock.calls[0]![1] as unknown[];
    expect(params[0]).toBe('loc1');
    expect(params[1]).toBe(LONDON.lng);
    expect(params[2]).toBe(LONDON.lat);
  });

  it('delete() calls executor with DELETE SQL', async () => {
    const { builder, executor } = makeBuilder();
    await builder.delete('loc1');
    const sql = (executor as any).mock.calls[0]![0] as string;
    const params = (executor as any).mock.calls[0]![1] as unknown[];
    expect(sql).toContain('DELETE FROM locations WHERE id = $1');
    expect(params[0]).toBe('loc1');
  });
});

// ─── GeoJSONIO ────────────────────────────────────────────────────────────────

describe('GeoJSONIO', () => {
  const io = new GeoJSONIO();

  it('toPoint() creates GeoJSON Point with [lng, lat]', () => {
    const p = io.toPoint(LONDON);
    expect(p.type).toBe('Point');
    expect(p.coordinates[0]).toBe(LONDON.lng);
    expect(p.coordinates[1]).toBe(LONDON.lat);
  });

  it('fromPoint() recreates original Point', () => {
    const g = io.toPoint(PARIS);
    const back = io.fromPoint(g);
    expect(back).toStrictEqual(PARIS);
  });

  it('toLineString() contains all coordinates', () => {
    const ls = io.toLineString([LONDON, PARIS]);
    expect(ls.type).toBe('LineString');
    expect(ls.coordinates).toHaveLength(2);
    expect(ls.coordinates[0]![0]).toBe(LONDON.lng);
  });

  it('fromLineString() restores all Points', () => {
    const pts = [LONDON, PARIS];
    const ls = io.toLineString(pts);
    const back = io.fromLineString(ls);
    expect(back[0]?.lat).toBeCloseTo(LONDON.lat, 5);
    expect(back[1]?.lng).toBeCloseTo(PARIS.lng, 5);
  });

  it('toPolygon() closes the ring', () => {
    const ring = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 1 },
    ];
    const poly = io.toPolygon(ring);
    const coords = poly.coordinates[0]!;
    expect(coords[coords.length - 1]).toStrictEqual(coords[0]);
  });

  it('toPolygon() does not double-close an already closed ring', () => {
    const ring = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 1 },
      { lat: 0, lng: 0 },
    ];
    const poly = io.toPolygon(ring);
    expect(poly.coordinates[0]).toHaveLength(4);
  });

  it('fromPolygon() extracts exterior ring as Points', () => {
    const ring = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 1 },
      { lat: 0, lng: 0 },
    ];
    const poly = io.toPolygon(ring);
    const pts = io.fromPolygon(poly);
    expect(pts[0]?.lat).toBe(0);
    expect(pts[0]?.lng).toBe(0);
  });

  it('toFeature() wraps geometry with type: Feature', () => {
    const g = io.toPoint(LONDON);
    const f = io.toFeature(g, { name: 'London' });
    expect(f.type).toBe('Feature');
    expect(f.geometry).toBe(g);
    expect(f.properties?.['name']).toBe('London');
  });

  it('toFeature() omits properties when not provided', () => {
    const f = io.toFeature(io.toPoint(LONDON));
    expect(f.properties).toBeUndefined();
  });

  it('pointToFeature() is shorthand for toFeature(toPoint(...))', () => {
    const f = io.pointToFeature(PARIS, { city: 'Paris' });
    expect(f.type).toBe('Feature');
    expect(f.geometry.type).toBe('Point');
    expect(f.properties?.['city']).toBe('Paris');
  });

  it('featureToPoint() round-trips through pointToFeature()', () => {
    const f = io.pointToFeature(LONDON);
    const p = io.featureToPoint(f);
    expect(p).toStrictEqual(LONDON);
  });

  it('toFeatureCollection() wraps features array', () => {
    const f1 = io.pointToFeature(LONDON);
    const f2 = io.pointToFeature(PARIS);
    const fc = io.toFeatureCollection([f1, f2]);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(2);
  });

  it('isGeometry() true for Point', () => {
    expect(io.isGeometry({ type: 'Point', coordinates: [0, 0] })).toBe(true);
  });

  it('isGeometry() true for LineString', () => {
    expect(io.isGeometry({ type: 'LineString', coordinates: [] })).toBe(true);
  });

  it('isGeometry() true for Polygon', () => {
    expect(io.isGeometry({ type: 'Polygon', coordinates: [] })).toBe(true);
  });

  it('isGeometry() false for non-geometry', () => {
    expect(io.isGeometry({ type: 'Circle' })).toBe(false);
    expect(io.isGeometry(null)).toBe(false);
    expect(io.isGeometry(42)).toBe(false);
  });

  it('isValidPoint() true for valid coordinates', () => {
    expect(io.isValidPoint(io.toPoint(LONDON))).toBe(true);
  });

  it('isValidPoint() false for out-of-range latitude', () => {
    expect(io.isValidPoint({ type: 'Point', coordinates: [0, 99] })).toBe(false);
  });

  it('isValidPoint() false for out-of-range longitude', () => {
    expect(io.isValidPoint({ type: 'Point', coordinates: [200, 0] })).toBe(false);
  });

  it('isValidLineString() true for valid coords', () => {
    const ls = io.toLineString([LONDON, PARIS]);
    expect(io.isValidLineString(ls)).toBe(true);
  });

  it('isValidLineString() false if any coordinate is out of range', () => {
    const invalid = {
      type: 'LineString' as const,
      coordinates: [
        [0, 0],
        [200, 0],
      ] as [[number, number], [number, number]],
    };
    expect(io.isValidLineString(invalid)).toBe(false);
  });
});
