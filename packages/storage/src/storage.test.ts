import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AzureBlobStorageAdapter } from './AzureBlobStorageAdapter';
import type {
  AzureBlobClientLike,
  AzureBlobProperties,
  AzureContainerClientLike,
} from './AzureBlobStorageAdapter';
import { GcsStorageAdapter } from './GcsStorageAdapter';
import type { GcsBucketLike, GcsFileLike, GcsFileLikeWithName } from './GcsStorageAdapter';
import { InMemoryStorageAdapter } from './InMemoryStorageAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { S3StorageAdapter } from './S3StorageAdapter';
import type { S3ClientLike, S3GetObjectResult, S3HeadObjectResult } from './S3StorageAdapter';
import {
  StorageDownloadError,
  StorageMultipartError,
  StorageNotFoundError,
  StoragePermissionError,
  StorageQuotaError,
  StorageUploadError,
} from './StorageErrors';

// ---------------------------------------------------------------------------
// StorageErrors
// ---------------------------------------------------------------------------

describe('StorageErrors', () => {
  it('StorageNotFoundError has correct name and message', () => {
    const err = new StorageNotFoundError('bucket', 'key/file.txt');
    expect(err.name).toBe('StorageNotFoundError');
    expect(err.message).toContain('bucket/key/file.txt');
    expect(err).toBeInstanceOf(Error);
  });

  it('StorageUploadError captures optional cause', () => {
    const cause = new Error('network');
    const err = new StorageUploadError('b', 'k', cause);
    expect(err.name).toBe('StorageUploadError');
    expect(err.cause).toBe(cause);
  });

  it('StorageDownloadError captures optional cause', () => {
    const cause = new Error('timeout');
    const err = new StorageDownloadError('b', 'k', cause);
    expect(err.name).toBe('StorageDownloadError');
    expect(err.cause).toBe(cause);
  });

  it('StoragePermissionError contains operation and location', () => {
    const err = new StoragePermissionError('delete', 'archive', 'private.txt');
    expect(err.name).toBe('StoragePermissionError');
    expect(err.message).toContain('delete');
  });

  it('StorageMultipartError captures uploadId and cause', () => {
    const cause = new Error('aborted');
    const err = new StorageMultipartError('upload-abc', cause);
    expect(err.name).toBe('StorageMultipartError');
    expect(err.message).toContain('upload-abc');
    expect(err.cause).toBe(cause);
  });

  it('StorageQuotaError includes bucket name', () => {
    const err = new StorageQuotaError('my-bucket');
    expect(err.name).toBe('StorageQuotaError');
    expect(err.message).toContain('my-bucket');
  });
});

// ---------------------------------------------------------------------------
// InMemoryStorageAdapter
// ---------------------------------------------------------------------------

describe('InMemoryStorageAdapter', () => {
  let adapter: InMemoryStorageAdapter;

  beforeAll(() => {
    adapter = new InMemoryStorageAdapter();
  });

  it('upload returns metadata with key, bucket, contentType', async () => {
    const meta = await adapter.upload('bkt', 'file.txt', 'hello', { contentType: 'text/plain' });
    expect(meta.key).toBe('file.txt');
    expect(meta.bucket).toBe('bkt');
    expect(meta.contentType).toBe('text/plain');
    expect(meta.size).toBe(5);
  });

  it('upload stores data retrievable by download', async () => {
    await adapter.upload('bkt', 'data.bin', Buffer.from([1, 2, 3]));
    const buf = await adapter.download('bkt', 'data.bin');
    expect(buf).toEqual(Buffer.from([1, 2, 3]));
  });

  it('upload stores customMetadata in returned metadata', async () => {
    const meta = await adapter.upload('bkt', 'tagged.txt', 'x', {
      customMetadata: { owner: 'alice' },
    });
    expect(meta.customMetadata?.['owner']).toBe('alice');
  });

  it('download supports byte range', async () => {
    await adapter.upload('bkt', 'range.bin', Buffer.from([10, 20, 30, 40, 50]));
    const slice = await adapter.download('bkt', 'range.bin', { range: { start: 1, end: 3 } });
    expect(slice).toEqual(Buffer.from([20, 30, 40]));
  });

  it('download returns full buffer when no range specified', async () => {
    await adapter.upload('bkt', 'full.txt', 'hello world');
    const buf = await adapter.download('bkt', 'full.txt');
    expect(buf.toString()).toBe('hello world');
  });

  it('download throws StorageNotFoundError for missing object', async () => {
    await expect(adapter.download('bkt', 'does-not-exist.txt')).rejects.toBeInstanceOf(
      StorageNotFoundError,
    );
  });

  it('delete removes the object', async () => {
    await adapter.upload('bkt', 'temp.txt', 'tmp');
    await adapter.delete('bkt', 'temp.txt');
    expect(await adapter.exists('bkt', 'temp.txt')).toBe(false);
  });

  it('exists returns true for a stored object', async () => {
    await adapter.upload('bkt', 'present.txt', 'yes');
    expect(await adapter.exists('bkt', 'present.txt')).toBe(true);
  });

  it('exists returns false for a missing object', async () => {
    expect(await adapter.exists('bkt', 'ghost.txt')).toBe(false);
  });

  it('getMetadata returns metadata for stored object', async () => {
    await adapter.upload('bkt', 'meta-test.txt', 'hello', { contentType: 'text/html' });
    const meta = await adapter.getMetadata('bkt', 'meta-test.txt');
    expect(meta.contentType).toBe('text/html');
    expect(meta.size).toBe(5);
  });

  it('getMetadata throws StorageNotFoundError for missing object', async () => {
    await expect(adapter.getMetadata('bkt', 'missing.txt')).rejects.toBeInstanceOf(
      StorageNotFoundError,
    );
  });

  it('listObjects returns all objects in bucket', async () => {
    adapter.clear();
    await adapter.upload('lst', 'a.txt', '1');
    await adapter.upload('lst', 'b.txt', '2');
    await adapter.upload('other', 'c.txt', '3');
    const result = await adapter.listObjects('lst');
    expect(result.objects).toHaveLength(2);
    expect(result.isTruncated).toBe(false);
  });

  it('listObjects filters by prefix', async () => {
    adapter.clear();
    await adapter.upload('pref', 'images/logo.png', '1');
    await adapter.upload('pref', 'images/bg.jpg', '2');
    await adapter.upload('pref', 'docs/readme.md', '3');
    const result = await adapter.listObjects('pref', { prefix: 'images/' });
    expect(result.objects).toHaveLength(2);
  });

  it('listObjects respects maxKeys and sets isTruncated', async () => {
    adapter.clear();
    for (let i = 0; i < 5; i++) await adapter.upload('trunc', `f${String(i)}.txt`, 'x');
    const result = await adapter.listObjects('trunc', { maxKeys: 3 });
    expect(result.objects).toHaveLength(3);
    expect(result.isTruncated).toBe(true);
  });

  it('getPresignedUrl returns URL containing bucket, key, and operation', async () => {
    const url = await adapter.getPresignedUrl('bkt', 'report.pdf', {
      operation: 'get',
      expiresInSeconds: 600,
    });
    expect(url).toContain('bkt');
    expect(url).toContain('report.pdf');
    expect(url).toContain('get');
  });

  it('checkHealth returns true', async () => {
    expect(await adapter.checkHealth()).toBe(true);
  });

  it('multipart upload: initiate → uploadPart → complete merges data', async () => {
    adapter.clear();
    const info = await adapter.initiateMultipartUpload('mp', 'merged.bin');
    const p1 = await adapter.uploadPart('mp', 'merged.bin', info.uploadId, 1, Buffer.from([1, 2]));
    const p2 = await adapter.uploadPart('mp', 'merged.bin', info.uploadId, 2, Buffer.from([3, 4]));
    const meta = await adapter.completeMultipartUpload('mp', 'merged.bin', info.uploadId, [p2, p1]);
    expect(meta.size).toBe(4);
    const result = await adapter.download('mp', 'merged.bin');
    expect(result).toEqual(Buffer.from([1, 2, 3, 4]));
  });
});

// ---------------------------------------------------------------------------
// LocalStorageAdapter
// ---------------------------------------------------------------------------

describe('LocalStorageAdapter', () => {
  let tmpDir: string;
  let adapter: LocalStorageAdapter;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'acme-storage-test-'));
    adapter = new LocalStorageAdapter(tmpDir);
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('upload writes file to disk and returns metadata', async () => {
    const meta = await adapter.upload('bucket', 'hello.txt', 'world', {
      contentType: 'text/plain',
    });
    expect(meta.key).toBe('hello.txt');
    expect(meta.size).toBe(5);
    expect(meta.contentType).toBe('text/plain');
  });

  it('download reads the file back from disk', async () => {
    await adapter.upload('bucket', 'greet.txt', 'hello');
    const buf = await adapter.download('bucket', 'greet.txt');
    expect(buf.toString()).toBe('hello');
  });

  it('delete removes the file', async () => {
    await adapter.upload('bucket', 'del.txt', 'bye');
    await adapter.delete('bucket', 'del.txt');
    expect(await adapter.exists('bucket', 'del.txt')).toBe(false);
  });

  it('exists returns true for an uploaded file', async () => {
    await adapter.upload('bucket', 'yes.txt', 'y');
    expect(await adapter.exists('bucket', 'yes.txt')).toBe(true);
  });

  it('exists returns false for a non-existent file', async () => {
    expect(await adapter.exists('bucket', 'no-such-file.txt')).toBe(false);
  });

  it('getMetadata returns size from disk', async () => {
    await adapter.upload('bucket', 'stat.txt', 'four');
    const meta = await adapter.getMetadata('bucket', 'stat.txt');
    expect(meta.size).toBe(4);
    expect(meta.bucket).toBe('bucket');
  });
});

// ---------------------------------------------------------------------------
// S3StorageAdapter
// ---------------------------------------------------------------------------

describe('S3StorageAdapter', () => {
  function buildClient(overrides: Partial<S3ClientLike> = {}): S3ClientLike {
    const base: S3ClientLike = {
      putObject: () => Promise.resolve(),
      getObject: () =>
        Promise.resolve<S3GetObjectResult>({
          Body: {
            transformToByteArray: () => Promise.resolve(new Uint8Array(Buffer.from('s3-content'))),
          },
          ContentLength: 10,
          ContentType: 'text/plain',
          LastModified: new Date('2025-01-01'),
        }),
      headObject: () =>
        Promise.resolve<S3HeadObjectResult>({
          ContentType: 'text/plain',
          ContentLength: 10,
          LastModified: new Date('2025-01-01'),
          ETag: '"abc123"',
        }),
      deleteObject: () => Promise.resolve(),
      listObjectsV2: () => Promise.resolve({ Contents: [], IsTruncated: false }),
      getPresignedUrl: () => Promise.resolve('https://pre.signed/url'),
      createMultipartUpload: () => Promise.resolve({ UploadId: 'mp-001' }),
      uploadPart: () => Promise.resolve({ ETag: 'part-etag' }),
      completeMultipartUpload: () => Promise.resolve(),
      abortMultipartUpload: () => Promise.resolve(),
    };
    return { ...base, ...overrides };
  }

  it('upload calls putObject with correct bucket and key', async () => {
    let capturedBucket = '';
    let capturedKey = '';
    const client = buildClient({
      putObject: (p) => {
        capturedBucket = p.Bucket;
        capturedKey = p.Key;
        return Promise.resolve();
      },
    });
    const adapter = new S3StorageAdapter(client);
    await adapter.upload('my-bucket', 'path/to/file.txt', 'hello');
    expect(capturedBucket).toBe('my-bucket');
    expect(capturedKey).toBe('path/to/file.txt');
  });

  it('download calls getObject and returns Buffer', async () => {
    const adapter = new S3StorageAdapter(buildClient());
    const buf = await adapter.download('b', 'k');
    expect(buf.toString()).toBe('s3-content');
  });

  it('delete calls deleteObject', async () => {
    let deleted = false;
    const client = buildClient({
      deleteObject: () => {
        deleted = true;
        return Promise.resolve();
      },
    });
    await new S3StorageAdapter(client).delete('b', 'k');
    expect(deleted).toBe(true);
  });

  it('exists returns true when headObject succeeds', async () => {
    const result = await new S3StorageAdapter(buildClient()).exists('b', 'k');
    expect(result).toBe(true);
  });

  it('exists returns false when headObject throws', async () => {
    const client = buildClient({ headObject: () => Promise.reject(new Error('NoSuchKey')) });
    const result = await new S3StorageAdapter(client).exists('b', 'k');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AzureBlobStorageAdapter
// ---------------------------------------------------------------------------

describe('AzureBlobStorageAdapter', () => {
  function buildBlobClient(overrides: Partial<AzureBlobClientLike> = {}): AzureBlobClientLike {
    const base: AzureBlobClientLike = {
      upload: () => Promise.resolve(),
      downloadToBuffer: () => Promise.resolve(Buffer.from('azure-data')),
      delete: () => Promise.resolve(),
      exists: () => Promise.resolve(true),
      getProperties: () =>
        Promise.resolve<AzureBlobProperties>({
          contentLength: 10,
          contentType: 'application/octet-stream',
          lastModified: new Date(),
        }),
      generateSasUrl: () => Promise.resolve('https://storage.azure.com/sas'),
      stageBlock: () => Promise.resolve(),
      commitBlockList: () => Promise.resolve(),
    };
    return { ...base, ...overrides };
  }

  function buildContainer(blobClient: AzureBlobClientLike): AzureContainerClientLike {
    return {
      getBlobClient: () => blobClient,
      listBlobsFlat: () => Promise.resolve([]),
    };
  }

  it('upload calls blob.upload with the data buffer', async () => {
    let uploadCalled = false;
    const blob = buildBlobClient({
      upload: () => {
        uploadCalled = true;
        return Promise.resolve();
      },
    });
    const adapter = new AzureBlobStorageAdapter(() => buildContainer(blob));
    await adapter.upload('c', 'file.txt', 'hello');
    expect(uploadCalled).toBe(true);
  });

  it('download calls downloadToBuffer and returns content', async () => {
    const blob = buildBlobClient();
    const adapter = new AzureBlobStorageAdapter(() => buildContainer(blob));
    const buf = await adapter.download('c', 'file.txt');
    expect(buf.toString()).toBe('azure-data');
  });

  it('delete calls blob.delete', async () => {
    let deleteCalled = false;
    const blob = buildBlobClient({
      delete: () => {
        deleteCalled = true;
        return Promise.resolve();
      },
    });
    const adapter = new AzureBlobStorageAdapter(() => buildContainer(blob));
    await adapter.delete('c', 'file.txt');
    expect(deleteCalled).toBe(true);
  });

  it('checkHealth returns true', async () => {
    const adapter = new AzureBlobStorageAdapter(() => buildContainer(buildBlobClient()));
    expect(await adapter.checkHealth()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GcsStorageAdapter
// ---------------------------------------------------------------------------

describe('GcsStorageAdapter', () => {
  function buildGcsFile(overrides: Partial<GcsFileLike> = {}): GcsFileLike {
    const base: GcsFileLike = {
      save: () => Promise.resolve(),
      download: () => Promise.resolve([Buffer.from('gcs-data')] as const),
      delete: () => Promise.resolve(),
      exists: () => Promise.resolve([true] as const),
      getMetadata: () =>
        Promise.resolve([
          { size: '8', contentType: 'text/plain', updated: '2025-01-01T00:00:00Z' },
        ] as const),
      getSignedUrl: () => Promise.resolve(['https://storage.googleapis.com/signed'] as const),
    };
    return { ...base, ...overrides };
  }

  function buildBucket(file: GcsFileLike): GcsBucketLike {
    return {
      file: () => file,
      getFiles: () => Promise.resolve([[]] as unknown as readonly [readonly GcsFileLikeWithName[]]),
    };
  }

  it('upload calls file.save with the body', async () => {
    let saveCalled = false;
    const file = buildGcsFile({
      save: () => {
        saveCalled = true;
        return Promise.resolve();
      },
    });
    const adapter = new GcsStorageAdapter(() => buildBucket(file));
    await adapter.upload('bkt', 'obj.txt', 'hello');
    expect(saveCalled).toBe(true);
  });

  it('download calls file.download and returns buffer', async () => {
    const adapter = new GcsStorageAdapter(() => buildBucket(buildGcsFile()));
    const buf = await adapter.download('bkt', 'obj.txt');
    expect(buf.toString()).toBe('gcs-data');
  });

  it('delete calls file.delete', async () => {
    let deleteCalled = false;
    const file = buildGcsFile({
      delete: () => {
        deleteCalled = true;
        return Promise.resolve();
      },
    });
    const adapter = new GcsStorageAdapter(() => buildBucket(file));
    await adapter.delete('bkt', 'obj.txt');
    expect(deleteCalled).toBe(true);
  });

  it('exists returns boolean from file.exists', async () => {
    const adapter = new GcsStorageAdapter(() => buildBucket(buildGcsFile()));
    expect(await adapter.exists('bkt', 'obj.txt')).toBe(true);
  });

  it('checkHealth returns true', async () => {
    const adapter = new GcsStorageAdapter(() => buildBucket(buildGcsFile()));
    expect(await adapter.checkHealth()).toBe(true);
  });
});
