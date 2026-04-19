import { existsSync } from 'fs';
import { hostname as osHostname } from 'os';
import type { DockerContext } from './types';

const CONTAINER_MARKERS = ['/.dockerenv', '/run/.containerenv'] as const;

export function readDockerContext(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): DockerContext {
  return {
    hostname: env['HOSTNAME'] ?? osHostname(),
    nodeEnv: env['NODE_ENV'] ?? 'development',
    isContainer: isContainerEnv(env),
    imageTag: env['IMAGE_TAG'],
    buildDate: env['BUILD_DATE'],
    gitCommit: env['GIT_COMMIT'],
  };
}

function isContainerEnv(env: Record<string, string | undefined>): boolean {
  if (env['KUBERNETES_SERVICE_HOST'] !== undefined) return true;
  if (env['DOCKER_CONTAINER'] === 'true') return true;
  return containerMarkerExists();
}

function containerMarkerExists(): boolean {
  for (const marker of CONTAINER_MARKERS) {
    if (existsSync(marker)) return true;
  }
  return false;
}
