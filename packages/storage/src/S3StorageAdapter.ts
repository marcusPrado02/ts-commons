import { randomUUID } from 'node:crypto';
import { StorageDownloadError, StorageNotFoundError } from './StorageErrors';
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
// Client interface  (mirrors @aws-sdk/client-s3 shapes)
// ---------------------------------------------------------------------------

export interface S3PutObjectParams {
  readonly Bucket: string;
  readonly Key: string;
  readonly Body: Buffer | string;
  readonly ContentType?: string;
  readonly Metadata?: Record<string, string>;
}

export interface S3GetObjectParams {
  readonly Bucket: string;
  readonly Key: string;
  readonly Range?: string;
}

export interface S3GetObjectResult {
  readonly Body?: { transformToByteArray(): Promise<Uint8Array> };
  readonly ContentType?: string;
  readonly ContentLength?: number;
  readonly LastModified?: Date;
  readonly ETag?: string;
}

export interface S3HeadObjectResult {
  readonly ContentType?: string;
  readonly ContentLength?: number;
  readonly LastModified?: Date;
  readonly ETag?: string;
  readonly Metadata?: Record<string, string>;
}

export interface S3ListObjectsParams {
  readonly Bucket: string;
  readonly Prefix?: string;
  readonly MaxKeys?: number;
  readonly ContinuationToken?: string;
}

export interface S3ListItem {
  readonly Key?: string;
  readonly Size?: number;
  readonly LastModified?: Date;
  readonly ETag?: string;
}

export interface S3ListObjectsResult {
  readonly Contents?: readonly S3ListItem[];
  readonly IsTruncated?: boolean;
  readonly NextContinuationToken?: string;
}

export interface S3CreateMultipartUploadResult {
  readonly UploadId?: string;
}

export interface S3UploadPartParams {
  readonly Bucket: string;
  readonly Key: string;
  readonly UploadId: string;
  readonly PartNumber: number;
  readonly Body: Buffer;
}

export interface S3UploadPartResult {
  readonly ETag?: string;
}

export interface S3CompletePart {
  readonly PartNumber: number;
  readonly ETag: string;
}

/** Minimal S3-compatible client. Mirrors `@aws-sdk/client-s3`. */
export interface S3ClientLike {
  putObject(params: S3PutObjectParams): Promise<void>;
  getObject(params: S3GetObjectParams): Promise<S3GetObjectResult>;
  headObject(params: { Bucket: string; Key: string }): Promise<S3HeadObjectResult>;
  deleteObject(params: { Bucket: string; Key: string }): Promise<void>;
  listObjectsV2(params: S3ListObjectsParams): Promise<S3ListObjectsResult>;
  getPresignedUrl(
    bucket: string,
    key: string,
    expiresIn: number,
    operation: 'get' | 'put',
  ): Promise<string>;
  createMultipartUpload(params: S3PutObjectParams): Promise<S3CreateMultipartUploadResult>;
  uploadPart(params: S3UploadPartParams): Promise<S3UploadPartResult>;
  completeMultipartUpload(params: {
    Bucket: string;
    Key: string;
    UploadId: string;
    MultipartUpload: { Parts: readonly S3CompletePart[] };
  }): Promise<void>;
  abortMultipartUpload(params: { Bucket: string; Key: string; UploadId: string }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBuffer(body: StorageObjectBody): Buffer {
  return Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf-8');
}

function buildPutParams(
  bucket: string,
  key: string,
  body: StorageObjectBody,
  options?: UploadOptions,
): S3PutObjectParams {
  return {
    Bucket: bucket,
    Key: key,
    Body: body,
    ...(options?.contentType !== undefined ? { ContentType: options.contentType } : {}),
    ...(options?.customMetadata !== undefined ? { Metadata: options.customMetadata } : {}),
  };
}

function buildListParams(bucket: string, options?: ListObjectsOptions): S3ListObjectsParams {
  return {
    Bucket: bucket,
    ...(options?.prefix !== undefined ? { Prefix: options.prefix } : {}),
    ...(options?.maxKeys !== undefined ? { MaxKeys: options.maxKeys } : {}),
    ...(options?.continuationToken !== undefined
      ? { ContinuationToken: options.continuationToken }
      : {}),
  };
}

function s3ItemToMeta(bucket: string, item: S3ListItem): StorageObjectMetadata {
  return {
    key: item.Key ?? '',
    bucket,
    size: item.Size ?? 0,
    contentType: 'application/octet-stream',
    lastModified: item.LastModified ?? new Date(),
    ...(item.ETag !== undefined ? { etag: item.ETag } : {}),
  };
}

function buildListResult(
  objects: readonly StorageObjectMetadata[],
  result: S3ListObjectsResult,
): ListObjectsResult {
  return {
    objects,
    isTruncated: result.IsTruncated ?? false,
    ...(result.NextContinuationToken !== undefined
      ? { nextContinuationToken: result.NextContinuationToken }
      : {}),
  };
}

function headToMetadata(
  bucket: string,
  key: string,
  head: S3HeadObjectResult,
): StorageObjectMetadata {
  return {
    key,
    bucket,
    size: head.ContentLength ?? 0,
    contentType: head.ContentType ?? 'application/octet-stream',
    lastModified: head.LastModified ?? new Date(),
    ...(head.ETag !== undefined ? { etag: head.ETag } : {}),
    ...(head.Metadata !== undefined ? { customMetadata: head.Metadata } : {}),
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Storage adapter backed by AWS S3.
 *
 * Inject a client implementing {@link S3ClientLike}
 * (e.g. a wrapper around `@aws-sdk/client-s3`).
 *
 * @example
 * ```ts
 * const storage = new S3StorageAdapter(s3ClientWrapper);
 * const meta = await storage.upload('my-bucket', 'key.txt', 'hello');
 * ```
 */
export class S3StorageAdapter implements StoragePort {
  constructor(private readonly client: S3ClientLike) {}

  async upload(
    bucket: string,
    key: string,
    body: StorageObjectBody,
    options?: UploadOptions,
  ): Promise<StorageObjectMetadata> {
    await this.client.putObject(buildPutParams(bucket, key, body, options));
    return {
      key,
      bucket,
      size: toBuffer(body).byteLength,
      contentType: options?.contentType ?? 'application/octet-stream',
      lastModified: new Date(),
      ...(options?.customMetadata !== undefined ? { customMetadata: options.customMetadata } : {}),
    };
  }

  async download(bucket: string, key: string, options?: DownloadOptions): Promise<Buffer> {
    const range =
      options?.range !== undefined
        ? `bytes=${options.range.start}-${options.range.end}`
        : undefined;
    const result = await this.client.getObject({
      Bucket: bucket,
      Key: key,
      ...(range !== undefined ? { Range: range } : {}),
    });
    if (result.Body === undefined) throw new StorageDownloadError(bucket, key);
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.client.deleteObject({ Bucket: bucket, Key: key });
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.client.headObject({ Bucket: bucket, Key: key });
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(bucket: string, key: string): Promise<StorageObjectMetadata> {
    try {
      const head = await this.client.headObject({ Bucket: bucket, Key: key });
      return headToMetadata(bucket, key, head);
    } catch {
      throw new StorageNotFoundError(bucket, key);
    }
  }

  async listObjects(bucket: string, options?: ListObjectsOptions): Promise<ListObjectsResult> {
    const result = await this.client.listObjectsV2(buildListParams(bucket, options));
    const objects = (result.Contents ?? []).map((item) => s3ItemToMeta(bucket, item));
    return buildListResult(objects, result);
  }

  getPresignedUrl(bucket: string, key: string, options: PresignedUrlOptions): Promise<string> {
    return this.client.getPresignedUrl(bucket, key, options.expiresInSeconds, options.operation);
  }

  async initiateMultipartUpload(
    bucket: string,
    key: string,
    options?: UploadOptions,
  ): Promise<MultipartUploadInfo> {
    const result = await this.client.createMultipartUpload(
      buildPutParams(bucket, key, Buffer.alloc(0), options),
    );
    return { uploadId: result.UploadId ?? randomUUID(), key, bucket };
  }

  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<MultipartPart> {
    const result = await this.client.uploadPart({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
    });
    return { partNumber, etag: result.ETag ?? '' };
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: readonly MultipartPart[],
  ): Promise<StorageObjectMetadata> {
    await this.client.completeMultipartUpload({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    });
    return this.getMetadata(bucket, key);
  }

  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    await this.client.abortMultipartUpload({ Bucket: bucket, Key: key, UploadId: uploadId });
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.client.listObjectsV2({ Bucket: '__health__', MaxKeys: 1 });
      return true;
    } catch {
      return false;
    }
  }
}
