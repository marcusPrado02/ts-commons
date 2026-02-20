import { randomUUID } from 'node:crypto';
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
// Internal shapes
// ---------------------------------------------------------------------------

interface StoredObject {
  readonly body: Buffer;
  readonly metadata: StorageObjectMetadata;
}

interface MultipartEntry {
  readonly info: MultipartUploadInfo;
  readonly parts: Map<number, Buffer>;
  readonly options?: UploadOptions;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBuffer(body: StorageObjectBody): Buffer {
  return Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf-8');
}

function buildMetadata(
  bucket: string,
  key: string,
  size: number,
  options?: UploadOptions,
): StorageObjectMetadata {
  return {
    key,
    bucket,
    size,
    contentType: options?.contentType ?? 'application/octet-stream',
    lastModified: new Date(),
    etag: randomUUID(),
    ...(options?.customMetadata !== undefined ? { customMetadata: options.customMetadata } : {}),
  };
}

function mergeMultipartParts(
  parts: readonly MultipartPart[],
  buffers: Map<number, Buffer>,
): Buffer {
  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  const chunks = sorted.map((p) => buffers.get(p.partNumber) ?? Buffer.alloc(0));
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * In-memory storage adapter for testing.
 *
 * All data is kept in memory. Use {@link clear} in `beforeEach` hooks to
 * reset state between tests.
 *
 * @example
 * ```ts
 * const storage = new InMemoryStorageAdapter();
 * await storage.upload('bucket', 'file.txt', 'hello');
 * const buf = await storage.download('bucket', 'file.txt');
 * console.log(buf.toString()); // 'hello'
 * ```
 */
export class InMemoryStorageAdapter implements StoragePort {
  private readonly objects = new Map<string, StoredObject>();
  private readonly multiparts = new Map<string, MultipartEntry>();

  private storeKey(bucket: string, key: string): string {
    return `${bucket}\x00${key}`;
  }

  upload(
    bucket: string,
    key: string,
    body: StorageObjectBody,
    options?: UploadOptions,
  ): Promise<StorageObjectMetadata> {
    const buf = toBuffer(body);
    const metadata = buildMetadata(bucket, key, buf.byteLength, options);
    this.objects.set(this.storeKey(bucket, key), { body: buf, metadata });
    return Promise.resolve(metadata);
  }

  download(bucket: string, key: string, options?: DownloadOptions): Promise<Buffer> {
    const entry = this.objects.get(this.storeKey(bucket, key));
    if (entry === undefined) return Promise.reject(new StorageNotFoundError(bucket, key));
    if (options?.range === undefined) return Promise.resolve(Buffer.from(entry.body));
    return Promise.resolve(entry.body.subarray(options.range.start, options.range.end + 1));
  }

  delete(bucket: string, key: string): Promise<void> {
    this.objects.delete(this.storeKey(bucket, key));
    return Promise.resolve();
  }

  exists(bucket: string, key: string): Promise<boolean> {
    return Promise.resolve(this.objects.has(this.storeKey(bucket, key)));
  }

  getMetadata(bucket: string, key: string): Promise<StorageObjectMetadata> {
    const entry = this.objects.get(this.storeKey(bucket, key));
    if (entry === undefined) return Promise.reject(new StorageNotFoundError(bucket, key));
    return Promise.resolve(entry.metadata);
  }

  listObjects(bucket: string, options?: ListObjectsOptions): Promise<ListObjectsResult> {
    const prefix = options?.prefix ?? '';
    const maxKeys = options?.maxKeys ?? 1000;
    const bucketPrefix = `${bucket}\x00`;
    const all = [...this.objects.entries()]
      .filter(
        ([k]) => k.startsWith(bucketPrefix) && k.slice(bucketPrefix.length).startsWith(prefix),
      )
      .map(([, v]) => v.metadata);
    return Promise.resolve({ objects: all.slice(0, maxKeys), isTruncated: all.length > maxKeys });
  }

  getPresignedUrl(bucket: string, key: string, options: PresignedUrlOptions): Promise<string> {
    return Promise.resolve(
      `https://storage.acme.dev/${bucket}/${key}?op=${options.operation}&ttl=${options.expiresInSeconds}`,
    );
  }

  initiateMultipartUpload(
    bucket: string,
    key: string,
    options?: UploadOptions,
  ): Promise<MultipartUploadInfo> {
    const uploadId = randomUUID();
    const info: MultipartUploadInfo = { uploadId, key, bucket };
    this.multiparts.set(uploadId, {
      info,
      parts: new Map(),
      ...(options !== undefined ? { options } : {}),
    });
    return Promise.resolve(info);
  }

  uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<MultipartPart> {
    const entry = this.multiparts.get(uploadId);
    if (entry === undefined) return Promise.reject(new StorageNotFoundError(bucket, key));
    entry.parts.set(partNumber, body);
    return Promise.resolve({ partNumber, etag: randomUUID() });
  }

  completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: readonly MultipartPart[],
  ): Promise<StorageObjectMetadata> {
    const entry = this.multiparts.get(uploadId);
    if (entry === undefined) return Promise.reject(new StorageNotFoundError(bucket, key));
    const merged = mergeMultipartParts(parts, entry.parts);
    const metadata = buildMetadata(bucket, key, merged.byteLength, entry.options);
    this.objects.set(this.storeKey(bucket, key), { body: merged, metadata });
    this.multiparts.delete(uploadId);
    return Promise.resolve(metadata);
  }

  abortMultipartUpload(_bucket: string, _key: string, uploadId: string): Promise<void> {
    this.multiparts.delete(uploadId);
    return Promise.resolve();
  }

  checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }

  /** Reset all stored objects and in-progress uploads. */
  clear(): void {
    this.objects.clear();
    this.multiparts.clear();
  }

  /** Number of objects currently stored across all buckets. */
  getObjectCount(): number {
    return this.objects.size;
  }
}
