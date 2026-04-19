# @marcusprado02/geospatial

Geospatial utilities: coordinate system conversions, distance calculations, geofencing, PostGIS query building, and GeoJSON I/O.

## Installation

```bash
pnpm add @marcusprado02/geospatial
```

## Quick Start

```typescript
import { DistanceCalculator, Geofence, PostGISQueryBuilder } from '@marcusprado02/geospatial';

// Haversine distance between two points
const calc = new DistanceCalculator();
const distanceKm = calc.between(
  { lat: -23.5505, lon: -46.6333 }, // São Paulo
  { lat: -22.9068, lon: -43.1729 }, // Rio de Janeiro
);

// Geofencing: check if a point is inside a polygon
const fence = new Geofence([
  { lat: -23.54, lon: -46.64 },
  { lat: -23.54, lon: -46.62 },
  { lat: -23.56, lon: -46.62 },
  { lat: -23.56, lon: -46.64 },
]);
const inside = fence.contains({ lat: -23.55, lon: -46.63 }); // true
```

## PostGIS Queries

```typescript
import { PostGISQueryBuilder } from '@marcusprado02/geospatial';

const builder = new PostGISQueryBuilder('locations');
const query = builder
  .withinRadius({ lat: -23.55, lon: -46.63 }, 5_000) // 5km
  .orderByDistance()
  .limit(10)
  .build();

// query.sql, query.params — pass to your DB client
```

## GeoJSON I/O

```typescript
import { GeoJSONIO } from '@marcusprado02/geospatial';

const io = new GeoJSONIO();
const geojson = io.toFeatureCollection(records);
const back = io.fromFeatureCollection(geojson);
```

## See Also

- [`@marcusprado02/persistence`](../persistence) — repository pattern
- [`@marcusprado02/timeseries`](../timeseries) — time-series data
