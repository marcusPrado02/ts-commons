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
// Client interfaces  (mirrors @google-cloud/storage shapes)
// ---------------------------------------------------------------------------

export interface GcsSaveOptions {
  readonly contentType?: string;
  readonly metadata?: Record<string, string>;
}

export interface GcsFileMetadata {
  readonly size?: string;
  readonly contentType?: string;
  readonly updated?: string;
  readonly etag?: string;
  readonly metadata?: Record<string, string>;
}

export interface GcsSignedUrlConfig {
  readonly action: 'read' | 'write';
  /** Unix timestamp in milliseconds. */
  readonly expires: number;
}

export interface GcsGetFilesQuery {
  readonly prefix?: string;
  readonly maxResults?: number;
}

export interface GcsFileLikeWithName {
  readonly name: string;
  readonly metadata: GcsFileMetadata;
}

/** Per-file client for a specific object. */
export interface GcsFileLike {
  save(data: Buffer | string, options?: GcsSaveOptions): Promise<void>;
  download(): Promise<readonly [Buffer]>;
  delete(): Promise<void>;
  exists(): Promise<readonly [boolean]>;
  getMetadata(): Promise<readonly [GcsFileMetadata]>;
  getSignedUrl(config: GcsSignedUrlConfig): Promise<readonly [string]>;
}

/** Per-bucket client. */
export interface GcsBucketLike {
  file(name: string): GcsFileLike;
  getFiles(query?: GcsGetFilesQuery): Promise<readonly [readonly GcsFileLikeWithName[]]>;
}

/** Factory that returns a bucket client for the given bucket name. */
export type GcsBucketFactory = (bucket: string) => GcsBucketLike;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBuffer(body: StorageObjectBody): Buffer {
  return Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf-8');
}

function gcsMetaToStorage(
  bucket: string,
  key: string,
  meta: GcsFileMetadata,
): StorageObjectMetadata {
  const sizeStr = meta.size ?? '0';
  const size = parseInt(sizeStr, 10);
  const lastModified = meta.updated !== undefined ? new Date(meta.updated) : new Date();
  return {
    key,
    bucket,
    size: isNaN(size) ? 0 : size,
    contentType: meta.contentType ?? 'application/octet-stream',
    lastModified,
    ...(meta.etag !== undefined ? { etag: meta.etag } : {}),
    ...(meta.metadata !== undefined ? { customMetadata: meta.metadata } : {}),
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Storage adapter backed by Google Cloud Storage.
 *
 * Inject a factory that returns a GCS bucket client for each bucket name.
 *
 * @example
 * ```ts
 * const gcs = new Storage();
 * const storage = new GcsStorageAdapter(bucket => gcs.bucket(bucket));
 * await storage.upload('my-bucket', 'file.txt', 'hello');
 * ```
 */
export class GcsStorageAdapter implements StoragePort {
  constructor(private readonly getBucket: GcsBucketFactory) {}

  async upload(
    bucket: string,
    key: string,
    body: StorageObjectBody,
    options?: UploadOptions,
  ): Promise<StorageObjectMetadata> {
    const buf = toBuffer(body);
    await this.getBucket(bucket)
      .file(key)
      .save(buf, {
        ...(options?.contentType !== undefined ? { contentType: options.contentType } : {}),
        ...(options?.customMetadata !== undefined ? { metadata: options.customMetadata } : {}),
      });
    return {
      key,
      bucket,
      size: buf.byteLength,
      contentType: options?.contentType ?? 'application/octet-stream',
      lastModified: new Date(),
      ...(options?.customMetadata !== undefined ? { customMetadata: options.customMetadata } : {}),
    };
  }

  async download(bucket: string, key: string, _options?: DownloadOptions): Promise<Buffer> {
    const [buf] = await this.getBucket(bucket).file(key).download();
    return buf;
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.getBucket(bucket).file(key).delete();
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    const [result] = await this.getBucket(bucket).file(key).exists();
    return result;
  }

  async getMetadata(bucket: string, key: string): Promise<StorageObjectMetadata> {
    try {
      const [meta] = await this.getBucket(bucket).file(key).getMetadata();
      return gcsMetaToStorage(bucket, key, meta);
    } catch {
      throw new StorageNotFoundError(bucket, key);
    }
  }

  async listObjects(bucket: string, options?: ListObjectsOptions): Promise<ListObjectsResult> {
    const maxKeys = options?.maxKeys ?? 1000;
    const [files] = await this.getBucket(bucket).getFiles({
      ...(options?.prefix !== undefined ? { prefix: options.prefix } : {}),
    });
    const sliced = files.slice(0, maxKeys);
    return {
      objects: sliced.map((f) => gcsMetaToStorage(bucket, f.name, f.metadata)),
      isTruncated: files.length > maxKeys,
    };
  }

  async getPresignedUrl(
    bucket: string,
    key: string,
    options: PresignedUrlOptions,
  ): Promise<string> {
    const [url] = await this.getBucket(bucket)
      .file(key)
      .getSignedUrl({
        action: options.operation === 'get' ? 'read' : 'write',
        expires: Date.now() + options.expiresInSeconds * 1000,
      });
    return url;
  }

  initiateMultipartUpload(
    bucket: string,
    key: string,
    _options?: UploadOptions,
  ): Promise<MultipartUploadInfo> {
    return Promise.resolve({ uploadId: randomUUID(), key, bucket });
  }

  uploadPart(
    _bucket: string,
    _key: string,
    uploadId: string,
    partNumber: number,
    _body: Buffer,
  ): Promise<MultipartPart> {
    // GCS does not expose a direct multipart upload API equivalent to S3.
    // Parts must be assembled client-side and committed via a single upload.
    return Promise.resolve({ partNumber, etag: `${uploadId}-${String(partNumber)}` });
  }

  completeMultipartUpload(
    bucket: string,
    key: string,
    _uploadId: string,
    _parts: readonly MultipartPart[],
  ): Promise<StorageObjectMetadata> {
    // Return current metadata; caller is responsible for having uploaded the data.
    return this.getMetadata(bucket, key);
  }

  abortMultipartUpload(_bucket: string, _key: string, _uploadId: string): Promise<void> {
    return Promise.resolve();
  }

  checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
