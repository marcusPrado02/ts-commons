import type { HttpHealthResponse } from './types';
import type { HealthAggregator } from './HealthAggregator';

const LIVE_PATHS = new Set(['/health/live', '/healthz']);
const READY_PATHS = new Set(['/health/ready', '/readyz']);

export class HealthCheckHandler {
  private readonly aggregator: HealthAggregator;

  constructor(aggregator: HealthAggregator) {
    this.aggregator = aggregator;
  }

  handleLiveness(): Promise<HttpHealthResponse> {
    return Promise.resolve({
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
      contentType: 'application/json',
    });
  }

  async handleReadiness(): Promise<HttpHealthResponse> {
    const report = await this.aggregator.aggregate();
    const statusCode = report.overall === 'down' ? 503 : 200;
    return {
      statusCode,
      body: JSON.stringify(report),
      contentType: 'application/json',
    };
  }

  handleRequest(path: string): Promise<HttpHealthResponse> {
    if (LIVE_PATHS.has(path)) {
      return this.handleLiveness();
    }
    if (READY_PATHS.has(path)) {
      return this.handleReadiness();
    }
    return Promise.resolve({ statusCode: 404, body: 'Not Found', contentType: 'text/plain' });
  }
}
