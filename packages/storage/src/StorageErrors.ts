/** Thrown when the requested object does not exist in the bucket. */
export class StorageNotFoundError extends Error {
  constructor(bucket: string, key: string) {
    super(`Object not found: ${bucket}/${key}`);
    this.name = 'StorageNotFoundError';
  }
}

/** Thrown when an upload operation fails. */
export class StorageUploadError extends Error {
  constructor(bucket: string, key: string, cause?: unknown) {
    super(`Failed to upload: ${bucket}/${key}`);
    this.name = 'StorageUploadError';
    if (cause instanceof Error) this.cause = cause;
  }
}

/** Thrown when a download operation fails. */
export class StorageDownloadError extends Error {
  constructor(bucket: string, key: string, cause?: unknown) {
    super(`Failed to download: ${bucket}/${key}`);
    this.name = 'StorageDownloadError';
    if (cause instanceof Error) this.cause = cause;
  }
}

/** Thrown when the caller lacks permission for the requested operation. */
export class StoragePermissionError extends Error {
  constructor(operation: string, bucket: string, key: string) {
    super(`Permission denied: ${operation} on ${bucket}/${key}`);
    this.name = 'StoragePermissionError';
  }
}

/** Thrown when the bucket's storage quota is exceeded. */
export class StorageQuotaError extends Error {
  constructor(bucket: string) {
    super(`Storage quota exceeded for bucket: ${bucket}`);
    this.name = 'StorageQuotaError';
  }
}

/** Thrown when a multipart upload operation fails. */
export class StorageMultipartError extends Error {
  constructor(uploadId: string, cause?: unknown) {
    super(`Multipart upload failed for uploadId: ${uploadId}`);
    this.name = 'StorageMultipartError';
    if (cause instanceof Error) this.cause = cause;
  }
}
