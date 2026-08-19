# Server and API Developer Guide

This guide describes the Express server, its public HTTP API, background recognition workflow, configuration, persistence, and operational behavior. It is intended for developers integrating the Copilot and Verso mocks, running the project locally, or maintaining the backend.

The documented implementation is the cumulative backend through Phase 6 on `backend-implementation-i`.

## Contents

- [What the server does](#what-the-server-does)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Authentication and API conventions](#authentication-and-api-conventions)
- [Architecture](#architecture)
- [Shared API schemas](#shared-api-schemas)
- [API summary](#api-summary)
- [Health and readiness APIs](#health-and-readiness-apis)
- [Asset APIs](#asset-apis)
- [Gallery APIs](#gallery-apis)
- [Search and celebrity APIs](#search-and-celebrity-apis)
- [Recognition and enrichment behavior](#recognition-and-enrichment-behavior)
- [Database and storage](#database-and-storage)
- [Errors and troubleshooting](#errors-and-troubleshooting)
- [Known constraints](#known-constraints)

## What the server does

The server supports the backend workflow for celebrity image discovery:

1. A CMS client uploads one or more JPEG or PNG assets.
2. The server stores the image locally and creates an asset record in MongoDB.
3. A background worker sends the image to Amazon Rekognition or the deterministic fake provider.
4. The celebrity decision engine combines recognition confidence with editorial title and caption evidence.
5. The CMS can update title, caption, alt text, and backstory without running recognition again.
6. Gallery snapshots associate assets with publication state and canonical event/year context.
7. Verso clients search by an exact celebrity name or alias and retrieve approved images from published galleries.

The same Node.js process also serves the React application. In development it mounts Vite as Express middleware. In production it serves the prebuilt client from `dist/`.

The API base path is:

```text
http://localhost:3000/api
```

There is no API version prefix in the current implementation.

## Quick start

### Prerequisites

- Node.js 20.14 or newer
- npm 10 or newer
- A reachable MongoDB instance
- AWS credentials with permission to call Rekognition `RecognizeCelebrities` when using the AWS provider
- No AWS account or credentials when using the fake provider

The server uses local filesystem storage for uploaded images. Start it from the repository root so relative paths such as `data/uploads` and `dist` resolve correctly.

### Install dependencies

```bash
npm install
```

The repository contains a lockfile, so `npm ci` can be used instead when a clean, reproducible install is preferred.

### Create local configuration

```bash
cp .env.example .env
```

For local development without AWS credentials, use:

```env
NODE_ENV=development
PORT=3000
RECOGNITION_PROVIDER=fake
AWS_REGION=us-east-1
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=celeb_face_match
UPLOAD_DIR=data/uploads
RECOGNITION_APPROVAL_THRESHOLD=99
```

Start MongoDB before starting the application.

### Start in development

```bash
npm run dev
```

The command runs `server/index.ts` with `tsx watch`. Express serves the API and mounts Vite for the frontend.

Verify the process:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
```

### Build and run in production mode

```bash
npm run build
NODE_ENV=production npm start
```

`npm run build` performs all TypeScript checks, builds the browser application into `dist/`, and compiles the server into `dist-server/`. `npm start` runs the compiled server.

Set `NODE_ENV=production` when starting the production build. Any value other than `production` causes the server to initialize Vite middleware.

### Run tests

```bash
npm test
```

MongoDB integration tests are opt-in:

```bash
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 \
  npm test -- tests/database/mongo.integration.test.ts
```

The integration suite creates a uniquely named database and removes it after the run.

### Local celebrity catalog prerequisite

Search and metadata-only celebrity inference depend on the `celebrities` MongoDB collection. During development, startup idempotently inserts a small demo catalog without overwriting existing records. The server does not expose a catalog-management API.

For local development with `RECOGNITION_PROVIDER=fake`, the following is an idempotent example for one of the fake provider's identities:

```javascript
db.celebrities.updateOne(
  { slug: "rihanna" },
  {
    $set: {
      displayName: "Rihanna",
      normalizedName: "rihanna",
      normalizedAliases: ["robyn rihanna fenty"],
      providerIdentities: [
        {
          provider: "fake",
          personId: "fake-rihanna"
        }
      ],
      slug: "rihanna"
    }
  },
  { upsert: true }
)
```

Run custom entries against the configured `MONGODB_DATABASE`, for example through `mongosh`. The built-in development bootstrap is not a production catalog-management workflow. Catalog documents are not validated by an API, so malformed records can cause incorrect matching.

## Configuration

The server loads `.env` through `dotenv` and validates server-owned variables with Zod during process startup. Invalid values prevent startup. All listed variables have defaults, but AWS credentials are conditionally required when the AWS provider processes an asset.

| Variable | Required | Type and allowed values | Default | Purpose and missing behavior |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | No | `development`, `test`, or `production` | `development` | Selects production static serving only when exactly `production`; otherwise Vite middleware is used. |
| `PORT` | No | Integer from `1` to `65535` | `3000` | HTTP listen port. Invalid or out-of-range values prevent startup. |
| `RECOGNITION_PROVIDER` | No | `aws-rekognition` or `fake` | `aws-rekognition` | Selects the recognition implementation. New uploads and manual retries are queued for the active provider. |
| `AWS_REGION` | No | Non-empty string | `us-east-1` | Passed to the AWS Rekognition client. It is unused by the fake provider. |
| `MONGODB_URI` | No | URI beginning with `mongodb://` or `mongodb+srv://` | `mongodb://127.0.0.1:27017` | MongoDB connection URI. The server does not begin listening if it cannot connect and ping MongoDB. |
| `MONGODB_DATABASE` | No | 1–63 letters, numbers, underscores, or hyphens | `celeb_face_match` | Database containing assets, celebrities, and gallery usages. |
| `UPLOAD_DIR` | No | Non-empty path string | `data/uploads` | Local image directory. Relative paths resolve from `process.cwd()`. The directory is created automatically. |
| `RECOGNITION_APPROVAL_THRESHOLD` | No | Number from `0` through `100` | `99` | Minimum recognition confidence that automatically produces an `APPROVED` association. Decimals are accepted. An empty value uses the default. |

### AWS credential variables

AWS credentials are resolved by the AWS SDK's standard credential chain rather than the server's Zod configuration. Common options include:

```bash
export AWS_PROFILE="<profile-name>"
export AWS_REGION="us-east-1"
```

or temporary credentials:

```bash
export AWS_ACCESS_KEY_ID="<access-key-id>"
export AWS_SECRET_ACCESS_KEY="<secret-access-key>"
export AWS_SESSION_TOKEN="<session-token>"
export AWS_REGION="us-east-1"
```

Do not commit credentials or `.env` files. Do not place secrets in variables beginning with `VITE_`, because Vite exposes those values to browser code.

Missing or invalid AWS credentials do not prevent server startup. They cause queued AWS recognition work to fail later, and the safe failure summary becomes visible through the asset detail API.

### Fixed operational limits

These values are currently constants and cannot be changed through environment variables:

| Limit | Value |
| --- | --- |
| JSON body size | 1 MiB |
| Images per upload request | 10 |
| Size per image | 5 MiB |
| Maximum image edge | 10,000 pixels |
| Maximum total image pixels | 50,000,000 |
| Simultaneous upload requests | 2 per Node.js process |
| Multipart text fields | 1 |
| Multipart field size | 16 KiB |
| Gallery assets per snapshot | 500 |
| Gallery tags per snapshot | 100 |
| Search/list page size | 1–100; default 20 |
| Recognition polling interval | 500 ms |
| Recognition request timeout | 15 seconds |
| Recognition lease | 30 seconds |
| Automatic recognition attempts | 3 |
| Initial recognition retry delay | 1 second, exponential up to 60 seconds |
| MongoDB connection selection timeout | 5 seconds |
| Readiness ping timeout | 5 seconds |

## Authentication and API conventions

### Authentication and authorization

The current implementation has no authentication or authorization middleware.

- No token, cookie, API key, role, or permission header is accepted or checked.
- All read and write APIs are available to any client that can reach the server.
- The server should not be exposed directly to an untrusted network in its current form.
- Authentication behavior for a production integration requires confirmation and implementation.

There is also no CORS middleware. Same-origin requests work because Express serves the frontend and API from one origin. A browser application hosted on another origin will require CORS support or a reverse proxy.

### Required headers

| Situation | Header |
| --- | --- |
| JSON request body | `Content-Type: application/json` |
| Asset upload | `Content-Type: multipart/form-data; boundary=...` — let the HTTP client generate the boundary |
| Conditional image request | Optional `If-None-Match: "<sha256>"` |
| Authentication | None |

No `Accept` header is required. JSON endpoints return `application/json`. Image retrieval returns binary JPEG or PNG data.

The JSON parser is mounted before every `/api` route. A request that declares a JSON content type can therefore return `INVALID_JSON` or `PAYLOAD_TOO_LARGE` even when that endpoint does not define a request body.

### Identifiers and dates

- Asset IDs are 24-character hexadecimal MongoDB ObjectId strings.
- Client asset IDs are UUID strings supplied by the uploader.
- Gallery IDs contain 1–200 characters and must begin with a letter or number. Remaining characters may be letters, numbers, periods, underscores, colons, or hyphens.
- Celebrity slugs contain lowercase letters, numbers, and single hyphen-separated segments.
- Date/time values are UTC ISO 8601 strings, for example `2027-05-04T12:00:00.000Z`.
- Links in responses are relative paths. Clients using another origin must resolve them against the server origin.

### Pagination

Asset listing uses an asset ID cursor. Search and archive retrieval use an opaque base64url cursor.

- Do not construct or modify cursors.
- Pass `nextCursor` unchanged to the next request.
- `null` means there is no next page.
- Search cursors are bound to the canonical celebrity, event filter, and year filter.
- Reusing a search cursor with different filters returns `INVALID_SEARCH_CURSOR`.
- Changing `limit` while retaining the same celebrity and filters is accepted.

### Standard error envelope

Most API failures use:

```typescript
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{
      path: string;
      message: string;
    }>;
  };
}
```

Example validation response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "details": [
      {
        "path": "assetIds.1",
        "message": "Each asset ID must be unique within a gallery."
      }
    ]
  }
}
```

Only Zod validation failures include `details`. Unexpected errors are logged on the server and returned as a sanitized `INTERNAL_SERVER_ERROR`; internal exception messages are not sent to clients.

The `503` readiness response is intentionally not wrapped in the standard error envelope.

## Architecture

### Server folder responsibilities

| Path | Responsibility |
| --- | --- |
| `server/index.ts` | Process entry point and dependency composition. Initializes storage, MongoDB, providers, services, worker, Express, and graceful shutdown. |
| `server/app.ts` | Testable Express application factory. Mounts the API at `/api`. |
| `server/config/` | Environment parsing and validation. |
| `server/database/` | MongoDB lifecycle, collection names, and indexes. |
| `server/frontend.ts` | Vite middleware in non-production modes and static SPA serving in production. |
| `server/lifecycle.ts` | Startup ordering, HTTP listening, cleanup, and shutdown coordination. |
| `server/routes/` | HTTP routing, request parsing, validation, status codes, and response writing. |
| `server/middleware/` | JSON API errors and bounded multipart upload parsing. |
| `server/services/` | Asset, gallery, search, and archive use cases. |
| `server/modules/recognition/` | Provider abstraction, AWS/fake providers, queue worker, retries, and lease recovery. |
| `server/modules/enrichment/` | Celebrity decision engine and revision-safe metadata/enrichment updates. |
| `server/modules/gallery/` | Canonical event/year extraction from gallery tags. |
| `server/repositories/` | Persistence interfaces and MongoDB implementations. |
| `server/storage/` | Image storage abstraction and local filesystem implementation. |
| `shared/` | Zod contracts and TypeScript types shared by server and browser code. |

### Request flow

```text
HTTP request
  -> Express /api router
  -> JSON or multipart parsing
  -> Zod validation
  -> route handler
  -> service/domain logic
  -> repository or image storage
  -> response DTO
  -> centralized error handler when an exception is raised
```

Routes do not access MongoDB directly. Services coordinate domain behavior, repository interfaces isolate persistence, and shared Zod schemas define public input and output contracts.

### Asset recognition flow

```text
POST /api/assets
  -> validate all image bytes and manifest entries
  -> write each new image to local storage
  -> insert asset with recognition.status = QUEUED
  -> return immediately

Background recognition worker
  -> recover expired leases
  -> atomically claim one eligible QUEUED asset
  -> read and verify stored image size
  -> call configured provider with a 15-second timeout
  -> store normalized and raw provider results
  -> set recognition.status = SUCCEEDED
  -> evaluate celebrity decisions
  -> reconcile any completed result whose enrichment is stale
```

MongoDB is the recognition queue. There is no external message broker.

### Startup and shutdown

Startup order is:

1. Validate environment values.
2. Create the upload directory.
3. Connect to and ping MongoDB.
4. Create required indexes.
5. Compose the application.
6. Initialize Vite or production static serving.
7. Begin listening.
8. Start the recognition worker.

If MongoDB or index creation fails, the HTTP server does not start.

On `SIGINT` or `SIGTERM`, the process stops the worker, aborts and releases active recognition work, closes the HTTP server and frontend middleware, closes MongoDB, and destroys the AWS client.

## Shared API schemas

The following schemas are reused by multiple endpoints.

### `Asset`

| Field | Type | Description |
| --- | --- | --- |
| `assetId` | string | 24-character hexadecimal asset ID. |
| `originalFilename` | string | Sanitized display filename recorded at ingestion. |
| `mimeType` | `"image/jpeg"` or `"image/png"` | Type determined from validated image bytes, not trusted upload metadata. |
| `sizeBytes` | positive integer | Stored image size. |
| `sourceText.title` | string or `null`, max 500 | Editorial title. A title is initially derived from the filename. |
| `sourceText.caption` | string or `null`, max 5,000 | Editorial caption. |
| `sourceText.altText` | string or `null`, max 2,000 | Editorial alt text. It is not celebrity identity evidence. |
| `sourceText.backstory` | string or `null`, max 5,000 | Editorial context or story behind the image. It is not celebrity identity evidence. |
| `sourceText.revision` | positive integer | Incremented on every successful metadata update. |
| `recognitionStatus` | recognition status | Current asynchronous recognition state. |
| `createdAt` | ISO date/time | Asset creation time. |
| `updatedAt` | ISO date/time | Most recent stored asset change. |
| `links.self` | string | Relative asset detail URL. |
| `links.image` | string | Relative image URL. |
| `links.admin` | string | Relative Copilot mock URL. |

Recognition status values:

| Value | Meaning |
| --- | --- |
| `QUEUED` | Waiting for an eligible worker attempt. |
| `PROCESSING` | Claimed by a worker under a lease. |
| `SUCCEEDED` | A normalized provider result was stored. |
| `FAILED` | Recognition ended in a known terminal failure. |
| `INDETERMINATE` | The final outcome could not be established safely. |

### `AssetDetail`

`AssetDetail` contains every `Asset` field plus `recognition` and `enrichment`.

#### Recognition object

| Field | Type | Description |
| --- | --- | --- |
| `status` | recognition status | Same value as top-level `recognitionStatus`. |
| `provider` | `"aws-rekognition"` or `"fake"` | Provider assigned to the current recognition revision. |
| `attemptNumber` | non-negative integer | Number of claimed attempts in the current retry cycle. |
| `revision` | positive integer | Changes when recognition is completed or manually requeued. |
| `completedAt` | ISO date/time or `null` | Terminal completion time. |
| `lastError` | recognition error or `null` | Safe summary of the most recent failed/interrupted attempt. |
| `result` | recognition result or `null` | Normalized provider result. Raw provider data is never returned. |

Recognition error fields:

| Field | Type | Description |
| --- | --- | --- |
| `code` | string | Stable internal/provider error classification. |
| `message` | string | Safe message. |
| `retryable` | boolean | Whether the provider considered the condition temporary. |
| `recordedAt` | ISO date/time | Time the error was persisted. |

Normalized recognition result:

```typescript
interface RecognitionResult {
  schemaVersion: "1.0";
  provider: "aws-rekognition" | "fake";
  model: string;
  faces: RecognizedFace[];
  unrecognizedFaceCount: number;
  warnings: string[];
}

interface RecognizedFace {
  candidateName: string | null;
  providerPersonId: string | null;
  confidence: number | null; // 0 through 100
  confidenceKind: "provider-score" | "model-estimate";
  recognitionStatus: "recognized" | "uncertain" | "unknown";
  boundingBox: {
    left: number;   // 0 through 1
    top: number;    // 0 through 1
    width: number;  // 0 through 1
    height: number; // 0 through 1
  } | null;
}
```

#### Enrichment object

| Field | Type | Description |
| --- | --- | --- |
| `associations` | celebrity association array | Approved and review-only candidates. |
| `decisionEngineVersion` | positive integer or `null` | Current implementation writes version `2`. |
| `evaluatedAt` | ISO date/time or `null` | Last decision evaluation time. |
| `hideFromSearch` | boolean | Editorial search override corresponding to `enrichment_state.hide_from_search` in the project schema. New and legacy assets default to `false`. When `true`, the asset is excluded from public search even if it otherwise qualifies. |
| `recognitionRevision` | positive integer or `null` | Recognition revision used by the decision. |
| `sourceTextRevision` | positive integer or `null` | Metadata revision used by the decision. |

Celebrity association:

| Field | Type | Allowed values or meaning |
| --- | --- | --- |
| `confidence` | number from 0–100 or `null` | Provider confidence; metadata-only inference uses `null`. |
| `decision` | string | `APPROVED` or `NEEDS_REVIEW`. |
| `displayName` | non-empty string | Display identity. |
| `evidenceFields` | string array | Zero or more of `title`, `caption`. |
| `identityKey` | non-empty string | Canonical catalog slug or normalized generated key. |
| `providerPersonId` | string or `null` | Provider identity when available. |
| `searchDecision` | string | Celebrity-level search decision: `APPROVED` or `NEEDS_REVIEW`. Public search includes only an association whose value is `APPROVED`. |
| `source` | string | `recognition` or `metadata-inference`. |

Legacy MongoDB associations that predate `searchDecision` are interpreted using their equivalent `decision` value. API responses normalize those records and always include `searchDecision`.

### `SearchAsset`

| Field | Type | Description |
| --- | --- | --- |
| `assetId` | asset ID | Matching asset. |
| `celebrities` | non-empty celebrity array | All approved celebrity associations on the asset, sorted by display name and slug. |
| `event` | event object or `null` | Canonical event context from this gallery usage. |
| `links.image` | string | Relative image URL. |
| `links.self` | string | Relative asset detail URL. |
| `mimeType` | `"image/jpeg"` or `"image/png"` | Stored image type. |
| `originalFilename` | string | Sanitized original filename. |
| `sourceGallery.addedAt` | ISO date/time | When this asset/gallery association was first created. |
| `sourceGallery.galleryId` | gallery ID | Source gallery. |
| `sourceText.title` | string or `null` | Current title. |
| `sourceText.caption` | string or `null` | Current caption. |
| `sourceText.altText` | string or `null` | Current alt text. |

Backstory is private editorial context on the asset detail and is intentionally not included in search results.

Celebrity object:

```typescript
interface Celebrity {
  displayName: string;
  slug: string;
}
```

Event object:

```typescript
interface GalleryEvent {
  id: "met-gala" | "grammys" | "oscars" | "golden-globes" | "vogue-world";
  name: string;
  year: number; // 1900 through 2199
}
```

## API summary

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Process liveness and active recognition provider. |
| `GET` | `/api/ready` | MongoDB readiness. |
| `POST` | `/api/assets` | Upload one to ten images. |
| `GET` | `/api/assets` | List assets newest first. |
| `GET` | `/api/assets/:assetId` | Retrieve asset, recognition, and enrichment detail. |
| `GET` | `/api/assets/:assetId/image` | Retrieve stored image bytes. |
| `POST` | `/api/assets/:assetId/recognition/retry` | Requeue failed or indeterminate recognition. |
| `PATCH` | `/api/assets/:assetId/metadata` | Update editorial metadata and recalculate decisions. |
| `GET` | `/api/galleries/assets/:assetId/event-metadata` | Retrieve the image's latest persisted content event. |
| `PUT` | `/api/galleries/:galleryId/context` | Synchronize the complete gallery snapshot. |
| `DELETE` | `/api/galleries/:galleryId/assets/:assetId` | Remove one asset/gallery association. |
| `GET` | `/api/search` | Resolve a celebrity name or alias and search published images. |
| `GET` | `/api/celebrities/:celebritySlug` | Retrieve a canonical celebrity archive. |

## Health and readiness APIs

### Get process health

Returns process liveness and the selected recognition provider. It does not query MongoDB, local storage, AWS, or the recognition worker.

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/health` |
| Authentication | None |
| Required headers | None |
| Path/query/body | None |

Example request:

```bash
curl http://localhost:3000/api/health
```

Success response — `200 OK`:

```typescript
{
  status: "ok";
  recognitionProvider: "aws-rekognition" | "fake";
}
```

```json
{
  "status": "ok",
  "recognitionProvider": "fake"
}
```

Errors:

| Status | Code | Cause |
| --- | --- | --- |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected route/server failure. |

### Get application readiness

Pings the configured MongoDB database. This endpoint does not check AWS, image storage, recognition queue progress, or frontend availability.

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/ready` |
| Authentication | None |
| Required headers | None |
| Path/query/body | None |

Example request:

```bash
curl http://localhost:3000/api/ready
```

Success response — `200 OK`:

```typescript
{
  status: "ready";
  checks: {
    database: "up";
  };
}
```

```json
{
  "status": "ready",
  "checks": {
    "database": "up"
  }
}
```

Unavailable response — `503 Service Unavailable`:

```typescript
{
  status: "not-ready";
  checks: {
    database: "down";
  };
}
```

```json
{
  "status": "not-ready",
  "checks": {
    "database": "down"
  }
}
```

MongoDB connection details and credentials are not included in the failure response.

## Asset APIs

### Upload assets

Uploads one to ten images, persists each new image and asset record, and queues recognition. The response does not wait for recognition.

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/assets` |
| Authentication | None |
| Required headers | `Content-Type: multipart/form-data` with a generated boundary |
| Path/query parameters | None |

#### Multipart request schema

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `images` | repeated file field | Yes | 1–10 files. Each must be a structurally valid JPEG or PNG, no larger than 5 MiB, no edge above 10,000 pixels, and no more than 50 million pixels. |
| `manifest` | string containing JSON | Yes | One text field, maximum 16 KiB. JSON array length must equal the number of files and preserve file order. |

Manifest schema:

```typescript
Array<{
  clientAssetId: string; // UUID
}>
```

Each UUID must be unique within the request. Extra fields inside a manifest entry are not part of the public contract and should not be sent.

Example request:

```bash
curl -X POST http://localhost:3000/api/assets \
  -F 'images=@/path/to/rihanna-met-gala.jpg' \
  -F 'images=@/path/to/zendaya-met-gala.png' \
  -F 'manifest=[
    {"clientAssetId":"f167c99c-9ad0-4f3d-aad4-bf19cbe15a90"},
    {"clientAssetId":"16dc75d4-0167-45dc-b533-14e43f1a5767"}
  ]'
```

Do not set the multipart boundary manually when using `curl`, `fetch`, or `FormData`.

#### Success response

```typescript
interface AssetUploadResponse {
  assets: Array<Asset & {
    created: boolean;
  }>;
}
```

- `201 Created` is returned when at least one asset was newly created.
- `200 OK` is returned when every upload was an idempotent replay.
- Results preserve manifest/file order.
- A mixed request containing existing and new assets returns `201`.

Example — `201 Created`:

```json
{
  "assets": [
    {
      "assetId": "64b000000000000000000001",
      "originalFilename": "rihanna-met-gala.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 248731,
      "sourceText": {
        "title": "rihanna met gala",
        "caption": null,
        "altText": null,
        "backstory": null,
        "revision": 1
      },
      "recognitionStatus": "QUEUED",
      "createdAt": "2027-05-04T12:00:00.000Z",
      "updatedAt": "2027-05-04T12:00:00.000Z",
      "links": {
        "self": "/api/assets/64b000000000000000000001",
        "image": "/api/assets/64b000000000000000000001/image",
        "admin": "/admin/photos/64b000000000000000000001"
      },
      "created": true
    }
  ]
}
```

#### Idempotency and persistence behavior

`clientAssetId` is the idempotency key; there is no idempotency header.

- Reusing a client asset ID with identical bytes returns the original asset with `created: false`.
- Reusing it with different bytes returns `409 CLIENT_ASSET_ID_CONFLICT`.
- Uploading identical bytes with a different client asset ID creates a separate asset.
- Filenames do not participate in idempotency. A replay returns the filename stored on the first upload.
- UUIDs are stored in lowercase.
- The server determines MIME type from the bytes and does not trust the multipart MIME header or filename extension.
- The filename is reduced to a safe basename, control/format characters are removed, whitespace is normalized, and display length is capped at 255 characters.
- The initial title is derived from the sanitized filename.
- The complete batch is image-validated and checked for known client-ID conflicts before new writes begin.
- New assets are then written sequentially without a MongoDB transaction. If a later persistence operation fails unexpectedly, earlier successful items can remain. Retrying the full batch with the same IDs is safe.

#### Error responses

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `UPLOAD_FILES_REQUIRED` | No `images` file was supplied. |
| `400` | `UPLOAD_MANIFEST_REQUIRED` | The `manifest` text field was missing or was not a string. |
| `400` | `INVALID_UPLOAD_MANIFEST` | `manifest` was not valid JSON. |
| `400` | `UPLOAD_MANIFEST_MISMATCH` | File and manifest-entry counts differ. |
| `400` | `VALIDATION_ERROR` | Invalid UUID, duplicate manifest ID, invalid manifest length, or other schema failure. |
| `400` | `INVALID_ASSET_UPLOAD` | Empty, corrupt, unsupported, oversized-dimension, or otherwise invalid image data. |
| `400` | `UPLOAD_FILE_LIMIT_EXCEEDED` | More than ten files, the wrong file field, or too many multipart parts. |
| `400` | `INVALID_MULTIPART_REQUEST` | Missing boundary, truncated form, extra fields, field-size failure, or another Multer parsing error. |
| `409` | `CLIENT_ASSET_ID_CONFLICT` | A client asset ID already belongs to different bytes. |
| `413` | `UPLOAD_FILE_TOO_LARGE` | An individual image exceeds 5 MiB. |
| `429` | `UPLOAD_CONCURRENCY_LIMIT_EXCEEDED` | Two uploads are already being parsed/ingested by this process. |
| `500` | `ASSET_INGESTION_FAILED` | A storage cleanup operation failed during ingestion. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected storage or database failure. |

Example conflict:

```json
{
  "error": {
    "code": "CLIENT_ASSET_ID_CONFLICT",
    "message": "The client asset ID is already associated with a different image."
  }
}
```

Example concurrency response:

```json
{
  "error": {
    "code": "UPLOAD_CONCURRENCY_LIMIT_EXCEEDED",
    "message": "Too many image uploads are in progress. Try again shortly."
  }
}
```

Clients should retry `429` responses with a short backoff. The upload slot remains occupied until ingestion settles, even if the client disconnects after multipart parsing.

### List assets

Returns assets newest first. This is the summary representation and does not include normalized recognition results or enrichment associations.

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/assets` |
| Authentication | None |
| Required headers | None |
| Body | None |

Query parameters:

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| `limit` | integer | No | `20` | 1–100. Numeric strings are coerced. |
| `cursor` | asset ID | No | — | Use the previous page's `nextCursor`. |

Example request:

```bash
curl 'http://localhost:3000/api/assets?limit=20'
```

Success response — `200 OK`:

```typescript
{
  assets: Asset[];
  nextCursor: string | null;
}
```

```json
{
  "assets": [
    {
      "assetId": "64b000000000000000000001",
      "originalFilename": "rihanna-met-gala.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 248731,
      "sourceText": {
        "title": "Rihanna in Marc Jacobs",
        "caption": "Rihanna arrives at the Met Gala.",
        "altText": "Rihanna on the red carpet.",
        "backstory": "Photographed shortly before the Met Gala arrival.",
        "revision": 2
      },
      "recognitionStatus": "SUCCEEDED",
      "createdAt": "2027-05-04T12:00:00.000Z",
      "updatedAt": "2027-05-04T12:01:00.000Z",
      "links": {
        "self": "/api/assets/64b000000000000000000001",
        "image": "/api/assets/64b000000000000000000001/image",
        "admin": "/admin/photos/64b000000000000000000001"
      }
    }
  ],
  "nextCursor": null
}
```

Errors and edge behavior:

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid `limit` or malformed cursor. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected database failure. |

A syntactically valid cursor whose asset no longer exists returns an empty page with `nextCursor: null`; it does not return an error. Unknown query fields are currently ignored by this endpoint.

### Get asset detail

Returns asset metadata, safe recognition state/result, and celebrity enrichment.

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/assets/:assetId` |
| Authentication | None |
| Required headers | None |
| Query/body | None |

Path parameters:

| Name | Type | Required | Constraints |
| --- | --- | --- | --- |
| `assetId` | string | Yes | 24 hexadecimal characters. |

Example request:

```bash
curl http://localhost:3000/api/assets/64b000000000000000000001
```

Success response — `200 OK`: `AssetDetail`

```json
{
  "assetId": "64b000000000000000000001",
  "originalFilename": "rihanna-met-gala.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 248731,
  "sourceText": {
    "title": "Rihanna in Marc Jacobs",
    "caption": "Rihanna arrives at the Met Gala.",
    "altText": "Rihanna on the red carpet.",
    "backstory": "Photographed shortly before the Met Gala arrival.",
    "revision": 2
  },
  "recognitionStatus": "SUCCEEDED",
  "createdAt": "2027-05-04T12:00:00.000Z",
  "updatedAt": "2027-05-04T12:01:00.000Z",
  "links": {
    "self": "/api/assets/64b000000000000000000001",
    "image": "/api/assets/64b000000000000000000001/image",
    "admin": "/admin/photos/64b000000000000000000001"
  },
  "enrichment": {
    "associations": [
      {
        "confidence": 96.42,
        "decision": "APPROVED",
        "displayName": "Rihanna",
        "evidenceFields": [
          "title",
          "caption"
        ],
        "identityKey": "rihanna",
        "providerPersonId": "fake-rihanna",
        "searchDecision": "APPROVED",
        "source": "recognition"
      }
    ],
    "decisionEngineVersion": 2,
    "evaluatedAt": "2027-05-04T12:01:00.000Z",
    "hideFromSearch": false,
    "recognitionRevision": 2,
    "sourceTextRevision": 2
  },
  "recognition": {
    "status": "SUCCEEDED",
    "provider": "fake",
    "attemptNumber": 1,
    "revision": 2,
    "completedAt": "2027-05-04T12:00:02.000Z",
    "lastError": null,
    "result": {
      "schemaVersion": "1.0",
      "provider": "fake",
      "model": "deterministic-fake-v1",
      "faces": [
        {
          "candidateName": "Rihanna",
          "providerPersonId": "fake-rihanna",
          "confidence": 96.42,
          "confidenceKind": "provider-score",
          "recognitionStatus": "recognized",
          "boundingBox": {
            "left": 0.1,
            "top": 0.15,
            "width": 0.25,
            "height": 0.3
          }
        }
      ],
      "unrecognizedFaceCount": 0,
      "warnings": []
    }
  }
}
```

The exact fake-provider celebrity, confidence, face count, and unrecognized count are deterministic functions of the uploaded bytes and can differ from this example.

Errors:

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Malformed asset ID. |
| `404` | `ASSET_NOT_FOUND` | Valid asset ID, but no record exists. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected database failure. |

Example not found:

```json
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "The asset was not found."
  }
}
```

Raw AWS/fake responses, storage keys, checksums, recognition leases, and worker ownership are intentionally not returned.

### Get asset image

Streams the stored image bytes.

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/assets/:assetId/image` |
| Authentication | None |
| Required headers | None |
| Optional headers | `If-None-Match` |
| Query/body | None |

Path parameters:

| Name | Type | Required | Constraints |
| --- | --- | --- | --- |
| `assetId` | string | Yes | 24 hexadecimal characters. |

Example:

```bash
curl --output asset.jpg \
  http://localhost:3000/api/assets/64b000000000000000000001/image
```

Success response — `200 OK`:

- Body: raw JPEG or PNG bytes.
- There is no JSON success body.

Response headers:

| Header | Value |
| --- | --- |
| `Content-Type` | `image/jpeg` or `image/png` |
| `Content-Length` | Stored byte count |
| `Content-Disposition` | `inline` |
| `Cache-Control` | `private, max-age=3600` |
| `ETag` | Quoted SHA-256 checksum |
| `X-Content-Type-Options` | `nosniff` |

Conditional example:

```bash
curl -i \
  -H 'If-None-Match: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"' \
  http://localhost:3000/api/assets/64b000000000000000000001/image
```

If `If-None-Match` exactly equals the current ETag, the server returns `304 Not Modified` without a body or `Content-Length`.

Errors:

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Malformed asset ID. |
| `404` | `ASSET_NOT_FOUND` | Asset record does not exist. |
| `500` | `ASSET_IMAGE_UNAVAILABLE` | File is missing, unreadable, has a size mismatch, or stored checksum metadata is invalid. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected failure before streaming begins. If a stream fails after headers are sent, the connection can terminate without a JSON error body. |

Example unavailable image:

```json
{
  "error": {
    "code": "ASSET_IMAGE_UNAVAILABLE",
    "message": "The asset image is unavailable."
  }
}
```

### Retry recognition

Requeues recognition only after a terminal `FAILED` or `INDETERMINATE` state.

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/assets/:assetId/recognition/retry` |
| Authentication | None |
| Required headers | None |
| Query/body | None; any body has no defined meaning |

Path parameters:

| Name | Type | Required | Constraints |
| --- | --- | --- | --- |
| `assetId` | string | Yes | 24 hexadecimal characters. |

Example request:

```bash
curl -X POST \
  http://localhost:3000/api/assets/64b000000000000000000001/recognition/retry
```

Success response — `202 Accepted`:

```typescript
{
  assetId: string;
  recognitionStatus: "QUEUED";
}
```

```json
{
  "assetId": "64b000000000000000000001",
  "recognitionStatus": "QUEUED"
}
```

Requeueing:

- Increments the recognition revision.
- Resets the attempt count to zero.
- Assigns the server's currently configured recognition provider.
- Clears the previous result, error, lease, timestamps, and enrichment decisions.
- Does not process recognition synchronously.

Errors:

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Malformed asset ID. |
| `404` | `ASSET_NOT_FOUND` | Asset does not exist. |
| `409` | `RECOGNITION_RETRY_NOT_ALLOWED` | State is `QUEUED`, `PROCESSING`, or `SUCCEEDED`. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected database failure. |

Example conflict:

```json
{
  "error": {
    "code": "RECOGNITION_RETRY_NOT_ALLOWED",
    "message": "Recognition can be retried only after a failed or indeterminate attempt."
  }
}
```

### Update asset metadata

Saves editorial metadata and the search-visibility override, then recalculates celebrity decisions from the stored recognition result. It does not call the recognition provider again.

| Property | Value |
| --- | --- |
| Method | `PATCH` |
| Path | `/api/assets/:assetId/metadata` |
| Authentication | None |
| Required headers | `Content-Type: application/json` |
| Query | None |

Path parameters:

| Name | Type | Required | Constraints |
| --- | --- | --- | --- |
| `assetId` | string | Yes | 24 hexadecimal characters. |

Request body:

| Field | Type | Required | Constraints and behavior |
| --- | --- | --- | --- |
| `title` | string or `null` | At least one metadata field is required | Maximum 500 characters. |
| `caption` | string or `null` | At least one metadata field is required | Maximum 5,000 characters. |
| `altText` | string or `null` | At least one metadata field is required | Maximum 2,000 characters. |
| `backstory` | string or `null` | At least one metadata field is required | Maximum 5,000 characters. |
| `hideFromSearch` | boolean | At least one metadata field is required | `true` excludes the asset from public search; `false` allows it to appear when all other search requirements are met. Defaults to `false` for new assets. |

The body is strict: unknown fields return a validation error.

- Omitted fields retain their current values.
- Omitting `hideFromSearch` retains the current visibility setting.
- `null` clears a field.
- Strings are trimmed.
- Empty/whitespace-only strings are stored as `null`.
- Windows CRLF line endings are normalized to LF.
- Every successful request increments `sourceText.revision`, even if the normalized content is unchanged.
- Alt text and backstory are stored but do not count as celebrity corroboration.

Example request:

```bash
curl -X PATCH \
  http://localhost:3000/api/assets/64b000000000000000000001/metadata \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Rihanna in Marc Jacobs",
    "caption": "Rihanna arrives at the Met Gala.",
    "altText": "Rihanna on the red carpet.",
    "backstory": "Photographed shortly before the Met Gala arrival.",
    "hideFromSearch": false
  }'
```

Success response — `200 OK`: the complete updated `AssetDetail`.

```json
{
  "assetId": "64b000000000000000000001",
  "originalFilename": "rihanna-met-gala.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 248731,
  "sourceText": {
    "title": "Rihanna in Marc Jacobs",
    "caption": "Rihanna arrives at the Met Gala.",
    "altText": "Rihanna on the red carpet.",
    "backstory": "Photographed shortly before the Met Gala arrival.",
    "revision": 2
  },
  "recognitionStatus": "SUCCEEDED",
  "createdAt": "2027-05-04T12:00:00.000Z",
  "updatedAt": "2027-05-04T12:01:00.000Z",
  "links": {
    "self": "/api/assets/64b000000000000000000001",
    "image": "/api/assets/64b000000000000000000001/image",
    "admin": "/admin/photos/64b000000000000000000001"
  },
  "enrichment": {
    "associations": [
      {
        "confidence": 50.4,
        "decision": "APPROVED",
        "displayName": "Rihanna",
        "evidenceFields": [
          "title",
          "caption"
        ],
        "identityKey": "rihanna",
        "providerPersonId": "aws-celebrity-id",
        "searchDecision": "APPROVED",
        "source": "recognition"
      }
    ],
    "decisionEngineVersion": 2,
    "evaluatedAt": "2027-05-04T12:01:00.000Z",
    "hideFromSearch": false,
    "recognitionRevision": 2,
    "sourceTextRevision": 2
  },
  "recognition": {
    "status": "SUCCEEDED",
    "provider": "aws-rekognition",
    "attemptNumber": 1,
    "revision": 2,
    "completedAt": "2027-05-04T12:00:02.000Z",
    "lastError": null,
    "result": {
      "schemaVersion": "1.0",
      "provider": "aws-rekognition",
      "model": "RecognizeCelebrities",
      "faces": [
        {
          "candidateName": "Rihanna",
          "providerPersonId": "aws-celebrity-id",
          "confidence": 50.4,
          "confidenceKind": "provider-score",
          "recognitionStatus": "recognized",
          "boundingBox": {
            "left": 0.1,
            "top": 0.15,
            "width": 0.25,
            "height": 0.3
          }
        }
      ],
      "unrecognizedFaceCount": 0,
      "warnings": []
    }
  }
}
```

Errors:

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `INVALID_JSON` | Malformed JSON. |
| `400` | `VALIDATION_ERROR` | Empty body, unknown field, wrong type, or field too long. |
| `404` | `ASSET_NOT_FOUND` | Asset does not exist. |
| `409` | `ASSET_UPDATE_CONFLICT` | Recognition or metadata changed repeatedly during the update. The service makes up to five optimistic attempts first. |
| `413` | `PAYLOAD_TOO_LARGE` | JSON body exceeds 1 MiB. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected database failure. |

Example empty update:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "details": [
      {
        "path": "",
        "message": "Provide at least one metadata field."
      }
    ]
  }
}
```

Metadata can be updated while recognition is still queued or processing, but celebrity inference is not performed until recognition has succeeded.

## Gallery APIs

### Get asset event metadata

Returns the most recently updated event context associated with an image through a content usage. This is the persisted value displayed by the Copilot **Event Metadata** section after a page refresh.

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/galleries/assets/:assetId/event-metadata` |
| Authentication | None |
| Required headers | None |
| Query/body | None |

Path parameters:

| Name | Type | Required | Constraints |
| --- | --- | --- | --- |
| `assetId` | string | Yes | 24 hexadecimal characters. |

Example:

```bash
curl http://localhost:3000/api/galleries/assets/64b000000000000000000001/event-metadata
```

Success response — `200 OK`:

```json
{
  "event": {
    "id": "met-gala",
    "name": "Met Gala",
    "year": 2026
  }
}
```

`event` is `null` when the asset exists but has no usage with resolved event metadata. If multiple content usages contain events, the usage with the latest `updatedAt` value is returned; gallery ID provides a deterministic tie-breaker.

Errors:

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid asset ID. |
| `404` | `ASSET_NOT_FOUND` | Asset does not exist. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected MongoDB failure. |

### Synchronize gallery context

Replaces the server's complete view of a gallery's current assets, publication state, and tags.

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/api/galleries/:galleryId/context` |
| Authentication | None |
| Required headers | `Content-Type: application/json` |
| Query | None |

Path parameters:

| Name | Type | Required | Constraints |
| --- | --- | --- | --- |
| `galleryId` | string | Yes | 1–200 characters; starts alphanumeric; remaining characters may include `.`, `_`, `:`, and `-`. |

Request body:

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `assetIds` | asset ID array | Yes | Maximum 500; every ID must be unique and refer to an existing asset. Empty is allowed. |
| `published` | boolean | Yes | Only exact JSON booleans are accepted. |
| `tags` | string array | Yes | Maximum 100; each trimmed tag must be 1–200 characters. Empty is allowed. |

The body is strict; unknown fields return `VALIDATION_ERROR`.

Example:

```bash
curl -X PUT \
  http://localhost:3000/api/galleries/met-gala-2027/context \
  -H 'Content-Type: application/json' \
  -d '{
    "assetIds": [
      "64b000000000000000000001",
      "64b000000000000000000002"
    ],
    "published": true,
    "tags": [
      "fashion",
      "Met Gala 2027",
      "storytype:news-and-trending"
    ]
  }'
```

Success response — `200 OK`:

```typescript
{
  assetCount: number;
  event: GalleryEvent | null;
  galleryId: string;
  published: boolean;
}
```

```json
{
  "assetCount": 2,
  "event": {
    "id": "met-gala",
    "name": "Met Gala",
    "year": 2027
  },
  "galleryId": "met-gala-2027",
  "published": true
}
```

#### Event resolution

A canonical event is resolved only when one tag contains both a supported event name and a four-digit year from 1900 through 2199.

| Recognized text | Canonical ID | Response name |
| --- | --- | --- |
| `Met Gala` | `met-gala` | `Met Gala` |
| `Grammy`, `Grammys`, or `Grammy Awards` | `grammys` | `Grammys` |
| `Oscar`, `Oscars`, or `Academy Awards` | `oscars` | `Oscars` |
| `Golden Globe` or `Golden Globes` | `golden-globes` | `Golden Globe` |
| `Vogue World` | `vogue-world` | `Vogue World` |

Matching is case-insensitive, accent-insensitive, and tolerant of punctuation separators.

- No matching event/year returns `event: null`; the gallery relationships are still stored.
- More than one distinct event/year candidate returns `AMBIGUOUS_GALLERY_EVENT`.
- Repeated tags resolving to the same event/year are not ambiguous.

#### Snapshot behavior

- The request is a complete snapshot, not a partial update.
- Existing asset/gallery pairs are updated.
- New pairs are inserted with `addedAt` equal to the current server time.
- Resending a pair preserves its original `addedAt`.
- Previously stored assets omitted from `assetIds` are removed.
- An empty `assetIds` array removes all usages for the gallery.
- Asset existence is checked before any gallery changes.
- Context updates do not run or requeue recognition.
- Requests for the same gallery are serialized within one server process.

The Copilot prototype's **Image gets added in content** button waits two seconds, randomly chooses one of `Met Gala`, `Oscars`, `Vogue World`, or `Golden Globe` and one of `2026`, `2025`, `2024`, or `2023`, then synchronizes a published gallery named `copilot-photo-<assetId>`. The resulting usage is immediately eligible for the existing `event` and `year` search filters when the celebrity association is otherwise searchable.

Errors:

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `INVALID_JSON` | Malformed JSON. |
| `400` | `VALIDATION_ERROR` | Invalid gallery ID/body, duplicate asset IDs, oversized arrays, or unknown fields. |
| `400` | `AMBIGUOUS_GALLERY_EVENT` | Tags resolve to multiple event/year candidates. |
| `404` | `GALLERY_ASSET_NOT_FOUND` | One or more asset IDs do not exist. The response does not identify which IDs are missing. |
| `413` | `PAYLOAD_TOO_LARGE` | JSON body exceeds 1 MiB. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected MongoDB failure. |

Example ambiguous event:

```json
{
  "error": {
    "code": "AMBIGUOUS_GALLERY_EVENT",
    "message": "Gallery tags resolve to more than one event or year."
  }
}
```

Example missing asset:

```json
{
  "error": {
    "code": "GALLERY_ASSET_NOT_FOUND",
    "message": "One or more gallery assets do not exist."
  }
}
```

### Remove an asset from a gallery

Removes one asset/gallery association. The operation is idempotent.

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/api/galleries/:galleryId/assets/:assetId` |
| Authentication | None |
| Required headers | None |
| Query/body | None |

Path parameters:

| Name | Type | Required | Constraints |
| --- | --- | --- | --- |
| `galleryId` | string | Yes | Same format as gallery context. |
| `assetId` | string | Yes | 24 hexadecimal characters. |

Example:

```bash
curl -X DELETE \
  http://localhost:3000/api/galleries/met-gala-2027/assets/64b000000000000000000001
```

Success response — `200 OK`:

```typescript
{
  assetId: string;
  galleryId: string;
  removed: boolean;
}
```

```json
{
  "assetId": "64b000000000000000000001",
  "galleryId": "met-gala-2027",
  "removed": true
}
```

`removed` is `false` when the association did not exist or was already removed. A missing gallery, missing asset record, and missing pair are not distinguished and do not return `404`.

Errors:

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid gallery or asset ID. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected MongoDB failure. |

## Search and celebrity APIs

Both retrieval endpoints return one result per published gallery usage, not one result per unique asset. If one asset belongs to multiple matching published galleries, it can appear more than once with different `sourceGallery` values.

Only records satisfying all of the following are returned:

- The gallery usage is published.
- The asset recognition status is `SUCCEEDED`.
- `enrichment.hideFromSearch` is not `true` (missing legacy values are treated as `false`).
- The requested celebrity association has `searchDecision` set to `APPROVED`.
- The decision-engine version is the server's current version (`2`).
- The stored recognition and source-text revisions used by enrichment still match the asset.
- Optional event and year filters match the gallery usage.

Results are ordered by `sourceGallery.addedAt` descending, then asset ID descending, then gallery ID descending.

### Search by celebrity name or alias

Normalizes the query and resolves it against exact catalog `normalizedName` and `normalizedAliases` fields. This is not fuzzy, semantic, prefix, or designer search.

Query normalization:

- Trims whitespace.
- Converts to lowercase.
- Removes diacritics.
- Replaces non-alphanumeric runs with spaces.
- Collapses whitespace.

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/search` |
| Authentication | None |
| Required headers | None |
| Body | None |

Query parameters:

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| `query` | string | Yes | — | Trimmed length 1–200. Exact normalized celebrity name or alias. |
| `event` | canonical event ID | No | — | `met-gala`, `grammys`, `oscars`, `golden-globes`, or `vogue-world`. |
| `year` | integer | No | — | 1900–2199. |
| `limit` | integer | No | `20` | 1–100. |
| `cursor` | string | No | — | Opaque value from `nextCursor`, maximum 1,000 characters. |

Unknown query parameters are rejected.

Example:

```bash
curl 'http://localhost:3000/api/search?query=Robyn%20Rihanna%20Fenty&event=met-gala&year=2027&limit=20'
```

Success response — `200 OK`:

```typescript
{
  query: string;
  celebrity: Celebrity | null;
  items: SearchAsset[];
  nextCursor: string | null;
}
```

```json
{
  "query": "Robyn Rihanna Fenty",
  "celebrity": {
    "displayName": "Rihanna",
    "slug": "rihanna"
  },
  "items": [
    {
      "assetId": "64b000000000000000000001",
      "celebrities": [
        {
          "displayName": "Rihanna",
          "slug": "rihanna"
        }
      ],
      "event": {
        "id": "met-gala",
        "name": "Met Gala",
        "year": 2027
      },
      "links": {
        "image": "/api/assets/64b000000000000000000001/image",
        "self": "/api/assets/64b000000000000000000001"
      },
      "mimeType": "image/jpeg",
      "originalFilename": "rihanna-met-gala.jpg",
      "sourceGallery": {
        "addedAt": "2027-05-04T12:05:00.000Z",
        "galleryId": "met-gala-2027"
      },
      "sourceText": {
        "altText": "Rihanna on the red carpet.",
        "caption": "Rihanna arrives at the Met Gala.",
        "title": "Rihanna in Marc Jacobs"
      }
    }
  ],
  "nextCursor": null
}
```

Unknown queries are successful empty results:

```json
{
  "query": "Unknown Person",
  "celebrity": null,
  "items": [],
  "nextCursor": null
}
```

Errors:

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Missing/empty query, unsupported event, invalid year/limit, cursor too long, repeated/unknown query field, or another schema failure. |
| `400` | `INVALID_SEARCH_CURSOR` | Cursor is malformed or bound to a different celebrity/event/year. |
| `409` | `AMBIGUOUS_CELEBRITY_QUERY` | The normalized name/alias belongs to more than one catalog record. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected MongoDB failure or malformed persisted data. |

Example ambiguity:

```json
{
  "error": {
    "code": "AMBIGUOUS_CELEBRITY_QUERY",
    "message": "The search query matches more than one celebrity."
  }
}
```

The original, trimmed `query` is echoed in the response; it is not replaced with the normalized query.

### Get celebrity archive

Retrieves the reusable archive for a canonical celebrity slug. Unlike `/api/search`, an unknown slug returns `404`.

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/celebrities/:celebritySlug` |
| Authentication | None |
| Required headers | None |
| Body | None |

Path parameters:

| Name | Type | Required | Constraints |
| --- | --- | --- | --- |
| `celebritySlug` | string | Yes | Lowercase letters/numbers in hyphen-separated segments; maximum 200 characters. |

Query parameters:

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| `event` | canonical event ID | No | — | Same values as `/api/search`. |
| `year` | integer | No | — | 1900–2199. |
| `limit` | integer | No | `20` | 1–100. |
| `cursor` | string | No | — | Opaque next-page cursor, maximum 1,000 characters. |

Unknown query parameters are rejected.

Example:

```bash
curl 'http://localhost:3000/api/celebrities/rihanna?event=oscars&year=2026'
```

Success response — `200 OK`:

```typescript
{
  celebrity: Celebrity;
  items: SearchAsset[];
  nextCursor: string | null;
}
```

```json
{
  "celebrity": {
    "displayName": "Rihanna",
    "slug": "rihanna"
  },
  "items": [
    {
      "assetId": "64b000000000000000000003",
      "celebrities": [
        {
          "displayName": "Rihanna",
          "slug": "rihanna"
        }
      ],
      "event": {
        "id": "oscars",
        "name": "Oscars",
        "year": 2026
      },
      "links": {
        "image": "/api/assets/64b000000000000000000003/image",
        "self": "/api/assets/64b000000000000000000003"
      },
      "mimeType": "image/png",
      "originalFilename": "rihanna-oscars.png",
      "sourceGallery": {
        "addedAt": "2026-03-03T10:30:00.000Z",
        "galleryId": "oscars-2026-arrivals"
      },
      "sourceText": {
        "altText": null,
        "caption": "Rihanna at the Oscars.",
        "title": "Rihanna in custom couture"
      }
    }
  ],
  "nextCursor": null
}
```

Errors:

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid slug, event, year, limit, cursor length, or unknown query field. |
| `400` | `INVALID_SEARCH_CURSOR` | Cursor is malformed or belongs to another celebrity/filter context. |
| `404` | `CELEBRITY_NOT_FOUND` | No catalog record has the requested slug. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected MongoDB failure or malformed persisted data. |

Example not found:

```json
{
  "error": {
    "code": "CELEBRITY_NOT_FOUND",
    "message": "The celebrity could not be found."
  }
}
```

## Recognition and enrichment behavior

### Recognition providers

#### Fake provider

The fake provider is intended for local development and tests.

- It hashes the image bytes.
- It deterministically returns one or two faces.
- Candidates are selected from Rihanna, Zendaya, A$AP Rocky, and Anya Taylor-Joy.
- Confidence is between 90 and 99.99.
- Results are stable for identical bytes.
- It does not make network requests.

#### AWS Rekognition provider

The AWS provider sends validated JPEG/PNG bytes to `RecognizeCelebrities`.

The normalized response:

- Omits AWS response metadata.
- Preserves recognized candidate name, provider ID, match confidence, and face bounds.
- Clamps out-of-range bounding-box coordinates and records a warning.
- Records warnings for missing name, provider ID, confidence, or bounds.
- Stores the raw provider result internally in MongoDB.
- Returns only the normalized result through the API.

Known provider failures are converted into safe error codes, including:

| Recognition error code | Meaning |
| --- | --- |
| `INVALID_IMAGE` | Provider could not decode the image. |
| `IMAGE_TOO_LARGE` | Provider rejected the image size. |
| `RECOGNITION_ACCESS_DENIED` | AWS credentials or permissions are invalid. |
| `RECOGNITION_PROVIDER_UNAVAILABLE` | Retryable throttling, network, timeout, HTTP 429, or server-side provider failure. |
| `RECOGNITION_PROVIDER_REJECTED` | Non-retryable provider rejection not covered above. |
| `RECOGNITION_REQUEST_ABORTED` | Request was interrupted or timed out. |
| `ASSET_IMAGE_UNAVAILABLE` | Worker could not open/read the stored image. |
| `ASSET_IMAGE_SIZE_MISMATCH` | File size differs from MongoDB metadata. |
| `RECOGNITION_OUTCOME_UNKNOWN` | Unexpected failure where the final outcome cannot be trusted. |
| `RECOGNITION_LEASE_EXPIRED` | Interrupted work was recovered and requeued. |
| `RECOGNITION_LEASE_EXHAUSTED` | Final leased attempt expired and became indeterminate. |

These are recognition-state errors stored on the asset, not direct HTTP errors from upload. Inspect them through `GET /api/assets/:assetId`.

### Automatic retries and leases

- A worker claim is atomic and changes `QUEUED` to `PROCESSING`.
- Each claim has a 30-second lease.
- Each provider request is aborted after 15 seconds.
- Retryable failures are requeued up to three total attempts.
- Backoff begins at one second and doubles per attempt, capped at 60 seconds.
- Non-retryable failures become `FAILED` immediately.
- An unexpected outcome becomes `INDETERMINATE`.
- An expired lease is requeued when attempts remain.
- An expired final lease becomes `INDETERMINATE`.
- A clean process shutdown aborts and releases active work without consuming the attempt.

### Decision engine version 2

The threshold defaults to 99 and is configurable through `RECOGNITION_APPROVAL_THRESHOLD`.

| Scenario | Persisted result |
| --- | --- |
| Recognition confidence is at or above threshold | `APPROVED` |
| Confidence is below threshold, but exact identity/alias appears as a whole phrase in title or caption | `APPROVED` |
| Confidence is below threshold without title/caption evidence | `NEEDS_REVIEW` |
| Provider missed the catalog identity named at the start of title/caption followed by ` in `, including when unrelated candidates were returned | `APPROVED` metadata inference |
| Metadata `X in Y` identity is absent from catalog | No association |
| Recognition has not succeeded | No association |

Additional behavior:

- Alt text and backstory never count as evidence.
- Multiple faces are evaluated independently.
- Repeated matches for one identity are merged.
- The highest confidence is retained.
- Any approved duplicate makes the merged association approved.
- Every celebrity association owns its `searchDecision`; there is no image-level search decision.
- `hideFromSearch` is an independent image-level editorial override. When true, public retrieval excludes the asset without changing any celebrity decisions.
- `NEEDS_REVIEW` records are persisted but excluded from public retrieval.
- Metadata updates recalculate decisions without another provider call.
- Revision-bound writes prevent stale recognition or metadata decisions from becoming searchable.
- The worker scans for succeeded assets whose enrichment is missing or stale and reevaluates them.

The current API does not provide an endpoint for manually overriding an association decision.

## Database and storage

### MongoDB collections

| Collection | Purpose |
| --- | --- |
| `assets` | Asset metadata, local storage metadata, recognition queue/state/results, and enrichment decisions. |
| `celebrities` | Canonical names, aliases, slugs, and provider identities. |
| `gallery_usages` | One record per asset/gallery pair with publication and event/year context. |

Indexes are created idempotently during startup.

Important uniqueness rules:

- `assets.ingest.clientAssetId` is unique.
- `assets.storage.key` is unique.
- `celebrities.normalizedName` is unique when present as a string.
- `celebrities.slug` is unique when present as a string.
- `(gallery_usages.assetId, gallery_usages.galleryId)` is unique.

Queue, pagination, alias, event/year, and published-recency indexes are also created.

### Local image storage

Images are stored under `UPLOAD_DIR` with random UUID keys ending in `.jpg` or `.png`.

- Directory mode is created as `0700`.
- Files are written through a temporary file with mode `0600` and atomically renamed.
- API clients never receive the storage key or filesystem path.
- The image API validates the database checksum format and stored size before serving.
- There is no object-storage implementation in the current composition.
- Asset records are not automatically deleted when a local file is manually removed.

### Multi-instance deployment

The current composition uses local filesystem storage and a MongoDB-backed worker queue. Multiple server instances can claim each other's jobs while only one instance has the local image. Therefore, either:

1. run one server instance, or
2. mount the same durable `UPLOAD_DIR` on every instance, or
3. implement and configure shared object storage.

This deployment decision is not represented by an environment switch today.

## Errors and troubleshooting

### Common HTTP errors

| Status | Typical code | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Request shape, parameter, enum, or field constraint failed. |
| `400` | `INVALID_JSON` | JSON parser could not parse the body. |
| `400` | `BAD_REQUEST` | Another parser rejected the request. |
| `404` | `API_ROUTE_NOT_FOUND` | No API route matches the HTTP method and path. |
| `409` | Endpoint-specific code | Request conflicts with current persisted state. |
| `413` | `PAYLOAD_TOO_LARGE` or `UPLOAD_FILE_TOO_LARGE` | JSON or image body exceeded its limit. |
| `429` | `UPLOAD_CONCURRENCY_LIMIT_EXCEEDED` | Upload capacity is temporarily occupied. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected failure; inspect server logs. |
| `503` | readiness body | MongoDB did not answer the readiness ping. |

Unknown API route example:

```json
{
  "error": {
    "code": "API_ROUTE_NOT_FOUND",
    "message": "No API route matches GET /api/unknown."
  }
}
```

Malformed JSON example:

```json
{
  "error": {
    "code": "INVALID_JSON",
    "message": "The request body must contain valid JSON."
  }
}
```

Oversized JSON example:

```json
{
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "The request body exceeds the allowed size."
  }
}
```

Unexpected failure example:

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "The server could not complete the request."
  }
}
```

### Server will not start

Check:

1. Environment values conform to the configuration table.
2. MongoDB is running and reachable from `MONGODB_URI`.
3. `MONGODB_DATABASE` contains only supported characters.
4. The process can create and write `UPLOAD_DIR`.
5. The listen port is free.
6. Existing MongoDB data does not violate a unique index being created at startup.

Startup intentionally logs only `Unable to start the application.` from the top-level catch. Run in a development environment and inspect the preceding process error output when available. Do not add credentials to logs or issue reports.

### `/api/ready` returns 503

- Confirm MongoDB is running.
- Verify host, port, TLS, authentication, and network access in `MONGODB_URI`.
- Verify the configured database user can run `ping`.
- The readiness check has a five-second timeout.
- `/api/health` can still return 200 because it is a liveness check only.

### Recognition stays queued

- Confirm the same server process remains running; the worker starts only after HTTP startup.
- Confirm the asset's assigned provider matches the running worker's provider.
- Inspect `GET /api/assets/:assetId` for status and `lastError`.
- With AWS, verify credentials, region, and `RecognizeCelebrities` permission.
- For local work, use `RECOGNITION_PROVIDER=fake`.
- Recognition is asynchronous; upload success does not imply recognition success.

A queued asset originally assigned to a different provider is not claimed by the current provider's worker. A manual retry is available only after `FAILED` or `INDETERMINATE`; it then assigns the current provider.

### Search returns no items

Check all of the following:

1. The celebrity exists in `celebrities`.
2. The query exactly matches `normalizedName` or one value in `normalizedAliases` after normalization.
3. Recognition is `SUCCEEDED`.
4. The relevant association has `searchDecision: APPROVED`.
5. `hideFromSearch` is false.
6. Metadata and recognition revisions match the enrichment revisions.
7. The gallery snapshot includes the asset.
8. The gallery snapshot has `published: true`.
9. Event/year filters match the same usage.
10. The catalog slug matches the association `identityKey`.

A recognized and approved candidate can still be undiscoverable by `/api/search` if the celebrity catalog has not been seeded.

### Image API returns `ASSET_IMAGE_UNAVAILABLE`

- Confirm the file exists under `UPLOAD_DIR`.
- Confirm all instances share the same upload storage.
- Check filesystem permissions.
- Do not rename or edit stored files manually.
- Confirm the server is running from the expected working directory.

### Upload is rejected

- Let the client generate the multipart boundary.
- Use the file field name `images`.
- Supply exactly one `manifest` field.
- Keep file and manifest order aligned.
- Use one unique UUID per image.
- Verify the actual bytes are a complete JPEG or PNG.
- Keep each file at or below 5 MiB.
- Retry `429` with backoff.

### Logs and diagnostics

Current logging is intentionally limited:

- Successful startup logs the application URL.
- Signals and shutdown failures are logged.
- Unexpected API failures are logged as `Unhandled API error.` with the server-side error.
- Worker failures use generic messages so provider/storage details are not leaked through logs by default.
- There is no request ID, structured logger, metrics endpoint, tracing, or queue administration endpoint.

Use asset detail, health/readiness responses, MongoDB inspection, and local process logs together when diagnosing a failure.

## Known constraints

- No authentication or authorization.
- No CORS configuration.
- No API versioning.
- No celebrity catalog CRUD or production catalog import command; development startup provides only a small demo bootstrap.
- No manual approval/rejection API for `NEEDS_REVIEW` associations.
- No asset deletion API.
- No external queue; recognition work is stored in MongoDB.
- Local storage is not independently durable or multi-instance safe.
- Upload batches are not transactional across all images.
- Search is exact normalized name/alias lookup only.
- Designer lookup and semantic/fuzzy search are not implemented.
- Search results are gallery usages, so the same asset can appear more than once.
- Search recency uses the original gallery-association `addedAt`; publishing an older draft does not reset that timestamp.
- Readiness checks MongoDB only.
- A live AWS request requires external credentials and permissions and is not implied by a successful local fake-provider run.
- Non-API GET routes are handled by the React SPA; unknown `/api` routes always use the JSON error format.
