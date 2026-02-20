/**
 * Body types accepted for upload operations.
 * Use a {@link Buffer} or a plain string; encoding defaults to UTF-8.
 */
export type StorageObjectBody = Buffer | string;

/** Metadata describing a stored object returned after upload or head operations. */
export interface StorageObjectMetadata {
  readonly key: string;
  readonly bucket: string;
  readonly size: number;
  readonly contentType: string;
  readonly lastModified: Date;
  readonly etag?: string;
  readonly customMetadata?: Record<string, string>;
}

/** Options for an upload operation. */
export interface UploadOptions {
  readonly contentType?: string;
  readonly customMetadata?: Record<string, string>;
  readonly contentEncoding?: string;
  readonly cacheControl?: string;
}

/** Options for a download operation. */
export interface DownloadOptions {
  /** Inclusive byte range `[start, end]`. */
  readonly range?: { readonly start: number; readonly end: number };
}

/** Options for listing objects within a bucket. */
export interface ListObjectsOptions {
  readonly prefix?: string;
  readonly maxKeys?: number;
  readonly continuationToken?: string;
}

/** Result of listing objects within a bucket. */
export interface ListObjectsResult {
  readonly objects: readonly StorageObjectMetadata[];
  readonly isTruncated: boolean;
  readonly nextContinuationToken?: string;
}

/** Configuration for generating a pre-signed URL. */
export interface PresignedUrlOptions {
  /** How many seconds until the URL expires. */
  readonly expiresInSeconds: number;
  readonly operation: 'get' | 'put';
}

/** Handle for an in-progress multipart upload. */
export interface MultipartUploadInfo {
  readonly uploadId: string;
  readonly key: string;
  readonly bucket: string;
}

/** A successfully uploaded part in a multipart upload. */
export interface MultipartPart {
  readonly partNumber: number;
  readonly etag: string;
}
