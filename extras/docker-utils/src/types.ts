// ── Health types ─────────────────────────────────────────────────────────────

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  message: string | undefined;
  latencyMs: number | undefined;
}

export interface HealthReport {
  overall: HealthStatus;
  checks: HealthCheck[];
  timestamp: string;
  version: string | undefined;
}

export interface HttpHealthResponse {
  statusCode: number;
  body: string;
  contentType: string;
}

// ── Shutdown types ────────────────────────────────────────────────────────────

export interface ShutdownHandler {
  name: string;
  fn: () => Promise<void>;
}

export interface ShutdownResult {
  success: boolean;
  errors: string[];
}

// ── Container context ─────────────────────────────────────────────────────────

export interface DockerContext {
  hostname: string;
  nodeEnv: string;
  isContainer: boolean;
  imageTag: string | undefined;
  buildDate: string | undefined;
  gitCommit: string | undefined;
}
