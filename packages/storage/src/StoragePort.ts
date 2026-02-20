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

/**
 * Port abstraction for object / blob storage.
 *
 * Implementations: {@link InMemoryStorageAdapter} (testing), {@link LocalStorageAdapter}
 * (filesystem), plus cloud adapters for S3, Azure Blob, and GCS.
 *
 * @example
 * ```ts
 * const storage: StoragePort = new S3StorageAdapter(s3Client);
 * const meta = await storage.upload('my-bucket', 'reports/q1.pdf', pdfBuffer, { contentType: 'application/pdf' });
 * const url  = await storage.getPresignedUrl('my-bucket', 'reports/q1.pdf', { operation: 'get', expiresInSeconds: 3600 });
 * ```
 */
export interface StoragePort {
  upload(
    bucket: string,
    key: string,
    body: StorageObjectBody,
    options?: UploadOptions,
  ): Promise<StorageObjectMetadata>;

  download(bucket: string, key: string, options?: DownloadOptions): Promise<Buffer>;

  delete(bucket: string, key: string): Promise<void>;

  exists(bucket: string, key: string): Promise<boolean>;

  getMetadata(bucket: string, key: string): Promise<StorageObjectMetadata>;

  listObjects(bucket: string, options?: ListObjectsOptions): Promise<ListObjectsResult>;

  getPresignedUrl(bucket: string, key: string, options: PresignedUrlOptions): Promise<string>;

  initiateMultipartUpload(
    bucket: string,
    key: string,
    options?: UploadOptions,
  ): Promise<MultipartUploadInfo>;

  uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<MultipartPart>;

  completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: readonly MultipartPart[],
  ): Promise<StorageObjectMetadata>;

  abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void>;

  checkHealth(): Promise<boolean>;
}
