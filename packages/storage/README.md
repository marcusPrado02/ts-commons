# @acme/storage

Object storage abstraction — a port interface with thin adapters for AWS S3, Azure Blob Storage, Google Cloud Storage, a local filesystem adapter, and an in-memory adapter for tests. Supports streaming, pre-signed URLs, and multipart upload.

## Installation

```bash
npm install @acme/storage
```

Adapters are thin wrappers — you supply the cloud SDK client. Install the relevant SDK separately:

```bash
# AWS S3
npm install @aws-sdk/client-s3

# Azure Blob Storage
npm install @azure/storage-blob

# Google Cloud Storage
npm install @google-cloud/storage
```

## Key Exports

### Port

- `StoragePort` — abstract interface all adapters implement (put, get, delete, list, presign, etc.)

### Adapter Types

| Export                                     | Description                               |
| ------------------------------------------ | ----------------------------------------- |
| `S3ClientLike` (and related S3 types)      | Shape expected from an AWS S3 client      |
| `AzureBlobItem` (and related Azure types)  | Azure Blob Storage item and client shapes |
| `GcsBucketFactory` (and related GCS types) | Google Cloud Storage bucket factory shape |

### Built-in Adapters

- `InMemoryStorageAdapter` — in-process, no external dependency; suitable for tests
- `LocalStorageAdapter` — persists to the local filesystem

## Usage

```typescript
import { InMemoryStorageAdapter } from '@acme/storage';

const storage = new InMemoryStorageAdapter();

await storage.put('avatars/user-1.png', imageBuffer, { contentType: 'image/png' });
const file = await storage.get('avatars/user-1.png');
const url = await storage.presign('avatars/user-1.png', { expiresIn: 3600 });
```

With S3 — you provide the client, the adapter handles the rest:

```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { S3StorageAdapter } from '@acme/storage';

const client = new S3Client({ region: 'us-east-1' });
const storage = new S3StorageAdapter(client, { bucket: 'my-bucket' });
```

## Dependencies

No runtime dependencies. Peer dependencies (optional, adapter-specific):

- `@aws-sdk/client-s3` — for the S3 adapter
- `@azure/storage-blob` — for the Azure Blob adapter
- `@google-cloud/storage` — for the GCS adapter
