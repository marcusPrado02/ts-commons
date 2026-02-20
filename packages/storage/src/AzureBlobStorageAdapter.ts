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
// Client interfaces  (mirrors @azure/storage-blob shapes)
// ---------------------------------------------------------------------------

export interface AzureBlobUploadOptions {
  readonly blobHTTPHeaders?: { readonly blobContentType?: string };
  readonly metadata?: Record<string, string>;
}

export interface AzureBlobProperties {
  readonly contentLength?: number;
  readonly contentType?: string;
  readonly lastModified?: Date;
  readonly etag?: string;
  readonly metadata?: Record<string, string>;
}

export interface AzureBlobItem {
  readonly name: string;
  readonly properties: {
    readonly contentLength?: number;
    readonly contentType?: string;
    readonly lastModified?: Date;
    readonly etag?: string;
  };
}

export interface AzureSasOptions {
  readonly expiresOn: Date;
  readonly permissions: string;
}

/** Per-blob client for a specific object. */
export interface AzureBlobClientLike {
  upload(body: Buffer | string, size: number, options?: AzureBlobUploadOptions): Promise<void>;
  downloadToBuffer(offset?: number, count?: number): Promise<Buffer>;
  delete(): Promise<void>;
  exists(): Promise<boolean>;
  getProperties(): Promise<AzureBlobProperties>;
  generateSasUrl(options: AzureSasOptions): Promise<string>;
  /** Stage a block for block-blob multipart upload. */
  stageBlock(blockId: string, body: Buffer, size: number): Promise<void>;
  /** Commit staged blocks as the blob's content. */
  commitBlockList(blockIds: readonly string[], options?: AzureBlobUploadOptions): Promise<void>;
}

/** Per-container client. */
export interface AzureContainerClientLike {
  getBlobClient(key: string): AzureBlobClientLike;
  listBlobsFlat(options?: { readonly prefix?: string }): Promise<readonly AzureBlobItem[]>;
}

/** Factory that returns a container client for the given bucket name. */
export type AzureContainerFactory = (bucket: string) => AzureContainerClientLike;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBuffer(body: StorageObjectBody): Buffer {
  return Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf-8');
}

function buildUploadOptions(options?: UploadOptions): AzureBlobUploadOptions {
  return {
    ...(options?.contentType !== undefined
      ? { blobHTTPHeaders: { blobContentType: options.contentType } }
      : {}),
    ...(options?.customMetadata !== undefined ? { metadata: options.customMetadata } : {}),
  };
}

function blobPropsToMeta(
  bucket: string,
  key: string,
  props: AzureBlobProperties,
): StorageObjectMetadata {
  return {
    key,
    bucket,
    size: props.contentLength ?? 0,
    contentType: props.contentType ?? 'application/octet-stream',
    lastModified: props.lastModified ?? new Date(),
    ...(props.etag !== undefined ? { etag: props.etag } : {}),
    ...(props.metadata !== undefined ? { customMetadata: props.metadata } : {}),
  };
}

function blobItemToMeta(bucket: string, item: AzureBlobItem): StorageObjectMetadata {
  return {
    key: item.name,
    bucket,
    size: item.properties.contentLength ?? 0,
    contentType: item.properties.contentType ?? 'application/octet-stream',
    lastModified: item.properties.lastModified ?? new Date(),
    ...(item.properties.etag !== undefined ? { etag: item.properties.etag } : {}),
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Storage adapter backed by Azure Blob Storage.
 *
 * Inject a factory that returns an Azure container client for each bucket.
 *
 * @example
 * ```ts
 * const factory = (bucket: string) => new ContainerClient(connString, bucket);
 * const storage = new AzureBlobStorageAdapter(factory);
 * await storage.upload('images', 'logo.png', pngBuffer, { contentType: 'image/png' });
 * ```
 */
export class AzureBlobStorageAdapter implements StoragePort {
  constructor(private readonly getContainer: AzureContainerFactory) {}

  async upload(
    bucket: string,
    key: string,
    body: StorageObjectBody,
    options?: UploadOptions,
  ): Promise<StorageObjectMetadata> {
    const buf = toBuffer(body);
    await this.getContainer(bucket)
      .getBlobClient(key)
      .upload(buf, buf.byteLength, buildUploadOptions(options));
    return {
      key,
      bucket,
      size: buf.byteLength,
      contentType: options?.contentType ?? 'application/octet-stream',
      lastModified: new Date(),
      ...(options?.customMetadata !== undefined ? { customMetadata: options.customMetadata } : {}),
    };
  }

  async download(bucket: string, key: string, options?: DownloadOptions): Promise<Buffer> {
    const blob = this.getContainer(bucket).getBlobClient(key);
    if (options?.range !== undefined) {
      const { start, end } = options.range;
      return blob.downloadToBuffer(start, end - start + 1);
    }
    return blob.downloadToBuffer();
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.getContainer(bucket).getBlobClient(key).delete();
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    return this.getContainer(bucket).getBlobClient(key).exists();
  }

  async getMetadata(bucket: string, key: string): Promise<StorageObjectMetadata> {
    try {
      const props = await this.getContainer(bucket).getBlobClient(key).getProperties();
      return blobPropsToMeta(bucket, key, props);
    } catch {
      throw new StorageNotFoundError(bucket, key);
    }
  }

  async listObjects(bucket: string, options?: ListObjectsOptions): Promise<ListObjectsResult> {
    const items = await this.getContainer(bucket).listBlobsFlat({
      ...(options?.prefix !== undefined ? { prefix: options.prefix } : {}),
    });
    const maxKeys = options?.maxKeys ?? 1000;
    const sliced = items.slice(0, maxKeys);
    return {
      objects: sliced.map((item) => blobItemToMeta(bucket, item)),
      isTruncated: items.length > maxKeys,
    };
  }

  getPresignedUrl(bucket: string, key: string, options: PresignedUrlOptions): Promise<string> {
    const expiresOn = new Date(Date.now() + options.expiresInSeconds * 1000);
    return this.getContainer(bucket)
      .getBlobClient(key)
      .generateSasUrl({
        expiresOn,
        permissions: options.operation === 'get' ? 'r' : 'w',
      });
  }

  initiateMultipartUpload(
    bucket: string,
    key: string,
    _options?: UploadOptions,
  ): Promise<MultipartUploadInfo> {
    return Promise.resolve({ uploadId: randomUUID(), key, bucket });
  }

  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<MultipartPart> {
    const blockId = `${uploadId}-${String(partNumber).padStart(5, '0')}`;
    await this.getContainer(bucket).getBlobClient(key).stageBlock(blockId, body, body.byteLength);
    return { partNumber, etag: blockId };
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    _uploadId: string,
    parts: readonly MultipartPart[],
  ): Promise<StorageObjectMetadata> {
    const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const blockIds = sorted.map((p) => p.etag);
    await this.getContainer(bucket).getBlobClient(key).commitBlockList(blockIds);
    return this.getMetadata(bucket, key);
  }

  async abortMultipartUpload(bucket: string, key: string, _uploadId: string): Promise<void> {
    try {
      await this.getContainer(bucket).getBlobClient(key).delete();
    } catch {
      // Blob may not exist yet; ignore
    }
  }

  checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
