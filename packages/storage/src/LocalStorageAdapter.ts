import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { StorageNotFoundError } from './StorageErrors';
import type { StoragePort } from './StoragePort';
import type {
  DownloadOptions,
  ListObjectsOptions,
  ListObjectsResult,
  MultipartPart,
  MultipartUploadInfo,
  PresignedUrlOptions,
  StorageObjectBody,
  StorageObjectMetadata,
  UploadOptions,
} from './StorageTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBuffer(body: StorageObjectBody): Buffer {
  return Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf-8');
}

function ctPath(filePath: string): string {
  return `${filePath}.ct`;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readContentType(filePath: string): Promise<string> {
  try {
    return await readFile(ctPath(filePath), 'utf-8');
  } catch {
    return 'application/octet-stream';
  }
}

function buildMeta(
  bucket: string,
  key: string,
  size: number,
  lastModified: Date,
  contentType: string,
): StorageObjectMetadata {
  return { key, bucket, size, lastModified, contentType };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Local filesystem storage adapter.
 *
 * Objects are written to `<basePath>/<bucket>/<key>`.
 * A sidecar `<key>.ct` file stores the content-type string.
 *
 * @example
 * ```ts
 * const storage = new LocalStorageAdapter('/tmp/storage');
 * await storage.upload('images', 'logo.png', pngBuffer, { contentType: 'image/png' });
 * ```
 */
export class LocalStorageAdapter implements StoragePort {
  constructor(private readonly basePath: string) {}

  private filePath(bucket: string, key: string): string {
    return join(this.basePath, bucket, key);
  }

  async upload(
    bucket: string,
    key: string,
    body: StorageObjectBody,
    options?: UploadOptions,
  ): Promise<StorageObjectMetadata> {
    const fp = this.filePath(bucket, key);
    await mkdir(dirname(fp), { recursive: true });
    const buf = toBuffer(body);
    await writeFile(fp, buf);
    const ct = options?.contentType ?? 'application/octet-stream';
    await writeFile(ctPath(fp), ct);
    return buildMeta(bucket, key, buf.byteLength, new Date(), ct);
  }

  async download(bucket: string, key: string, options?: DownloadOptions): Promise<Buffer> {
    const fp = this.filePath(bucket, key);
    const exists = await pathExists(fp);
    if (!exists) throw new StorageNotFoundError(bucket, key);
    const buf = await readFile(fp);
    if (options?.range === undefined) return buf;
    return buf.subarray(options.range.start, options.range.end + 1);
  }

  async delete(bucket: string, key: string): Promise<void> {
    const fp = this.filePath(bucket, key);
    await rm(fp, { force: true });
    await rm(ctPath(fp), { force: true });
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    return pathExists(this.filePath(bucket, key));
  }

  async getMetadata(bucket: string, key: string): Promise<StorageObjectMetadata> {
    const fp = this.filePath(bucket, key);
    let stats;
    try {
      stats = await stat(fp);
    } catch {
      throw new StorageNotFoundError(bucket, key);
    }
    const ct = await readContentType(fp);
    return buildMeta(bucket, key, stats.size, stats.mtime, ct);
  }

  async listObjects(bucket: string, options?: ListObjectsOptions): Promise<ListObjectsResult> {
    const bucketPath = join(this.basePath, bucket);
    const bucketExists = await pathExists(bucketPath);
    if (!bucketExists) return { objects: [], isTruncated: false };
    const prefix = options?.prefix ?? '';
    const maxKeys = options?.maxKeys ?? 1000;
    const entries = await readdir(bucketPath, { recursive: true });
    const keys = entries.filter((e) => !e.endsWith('.ct') && e.startsWith(prefix));
    const sliced = keys.slice(0, maxKeys);
    const objects = await Promise.all(sliced.map((k) => this.getMetadata(bucket, k)));
    return { objects, isTruncated: keys.length > maxKeys };
  }

  getPresignedUrl(bucket: string, key: string, options: PresignedUrlOptions): Promise<string> {
    const fp = this.filePath(bucket, key);
    return Promise.resolve(`file://${fp}?op=${options.operation}&ttl=${options.expiresInSeconds}`);
  }

  initiateMultipartUpload(
    bucket: string,
    key: string,
    _options?: UploadOptions,
  ): Promise<MultipartUploadInfo> {
    return Promise.resolve({ uploadId: randomUUID(), key, bucket });
  }

  async uploadPart(
    _bucket: string,
    _key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<MultipartPart> {
    const partPath = join(this.basePath, '.multipart', uploadId, String(partNumber));
    await mkdir(dirname(partPath), { recursive: true });
    await writeFile(partPath, body);
    return { partNumber, etag: String(partNumber) };
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: readonly MultipartPart[],
  ): Promise<StorageObjectMetadata> {
    const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const chunks = await Promise.all(
      sorted.map((p) =>
        readFile(join(this.basePath, '.multipart', uploadId, String(p.partNumber))),
      ),
    );
    const merged = Buffer.concat(chunks);
    await rm(join(this.basePath, '.multipart', uploadId), { recursive: true, force: true });
    return this.upload(bucket, key, merged);
  }

  async abortMultipartUpload(_bucket: string, _key: string, uploadId: string): Promise<void> {
    await rm(join(this.basePath, '.multipart', uploadId), { recursive: true, force: true });
  }

  checkHealth(): Promise<boolean> {
    return pathExists(this.basePath);
  }
}
