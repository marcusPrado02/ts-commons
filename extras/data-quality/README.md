# @marcusprado02/data-quality

Data quality rules, profiling, and anomaly detection. Validates records against typed rules, profiles dataset distributions, and detects outliers using statistical methods.

## Installation

```bash
pnpm add @marcusprado02/data-quality
```

## Quick Start

```typescript
import { QualityValidator, DataProfiler, ZScoreAnomalyDetector } from '@marcusprado02/data-quality';

// Validate records
const validator = new QualityValidator([
  { field: 'email', type: 'string', required: true, pattern: /.+@.+/ },
  { field: 'age', type: 'number', min: 0, max: 150 },
]);

const report = await validator.validate(records);
// report.violations, report.passRate, report.failedRecords

// Profile a dataset
const profiler = new DataProfiler();
const profile = await profiler.profile(records);
// profile.fields[n].nullRate, profile.fields[n].uniqueCount, profile.fields[n].distribution

// Detect anomalies
const detector = new ZScoreAnomalyDetector({ threshold: 3 });
const anomalies = await detector.detect(records, 'amount');
```

## Anomaly Detectors

| Detector                   | Method                               |
| -------------------------- | ------------------------------------ |
| `ZScoreAnomalyDetector`    | Standard deviation outlier detection |
| `NullAnomalyDetector`      | Detects unexpected null spikes       |
| `CompositeAnomalyDetector` | Chains multiple detectors            |

## See Also

- [`@marcusprado02/data-pipeline`](../data-pipeline) — ETL framework
- [`@marcusprado02/data-warehouse`](../data-warehouse) — warehouse connectors
