# Celebrity Image Discovery

A full-stack celebrity image workflow with two connected experiences:

- **Copilot** lets editors upload images, review recognition results, edit metadata, control search visibility, and publish images to an event.
- **Verso** provides the public discovery and celebrity search experience using data from the same backend.

## What the app supports

- Uploading JPEG and PNG images from Copilot.
- Asynchronous celebrity recognition with AWS Rekognition or a fake local provider.
- Editorial metadata: title, caption, alt text, and backstory.
- A `Hide from search` control for excluding an asset from Verso.
- Publishing an approved image to a supported event and year.
- API-backed discovery, search, filtering, and cursor pagination.
- Celebrity overlays that use backend backstory data while retaining the current static `Featured In` links.

## Architecture

The project runs as one application:

```text
React + Vite (Copilot and Verso)
              |
        Express /api/*
          |         |
       MongoDB   Local uploads
          |
   AWS Rekognition or fake provider
```

Express owns all `/api/*` routes. In development it mounts Vite middleware; in production it serves the built frontend. MongoDB stores asset metadata, recognition jobs, search decisions, and gallery usage. Uploaded files are stored locally under `data/uploads` by default.

## Requirements

- Node.js 20.14 or newer
- npm 10 or newer
- MongoDB running locally, or a reachable MongoDB URI
- AWS credentials only when using the AWS recognition provider

## Quick start

```bash
npm install
cp .env.example .env
```

For local development without AWS, set this in `.env`:

```dotenv
RECOGNITION_PROVIDER=fake
```

Start MongoDB, then run:

```bash
npm run dev
```

Open:

- Verso discovery: <http://localhost:3000/discover>
- Copilot upload: <http://localhost:3000/admin/photos/new>
- API health: <http://localhost:3000/api/health>
- Dependency readiness: <http://localhost:3000/api/ready>

Use `npm run dev` for the complete application. `npm run dev:client` starts only Vite and requires an API server to be available separately.

## Main workflow

1. Upload 1–10 JPEG or PNG files from `/admin/photos/new`.
2. The server stores each asset and queues celebrity recognition.
3. Open `/admin/photos/:assetId` to review the result, edit metadata, and control `Hide from search`.
4. Add the image to event content and use the page-level **Save** action to persist the event publication.
5. Eligible assets appear in Verso at `/discover` and in `/api/search` results.

The cards shown immediately after upload are temporary page state. Refreshing the upload page clears those cards, but it does **not** delete uploaded assets. Until the photo-library page is implemented, assets can be listed through `GET /api/assets?limit=20` and opened at `/admin/photos/:assetId`.

### Upload limits

- JPEG or PNG only
- Maximum 10 files per request
- Maximum 5 MiB per file
- Maximum 10,000 pixels on either edge
- Maximum 50 megapixels

## Search eligibility

An image is searchable only when all of these conditions are satisfied:

- Recognition completed successfully.
- Enrichment and decision records use the current engine revisions.
- The celebrity association has `searchDecision: APPROVED`.
- The asset has a published gallery usage for a supported event and year.
- `enrichment.hideFromSearch` is not `true`.
- The recognized celebrity exists in the celebrity catalog.

The product concept may refer to this field as `enrichment_state.hide_from_search`; the implemented API and MongoDB property is `enrichment.hideFromSearch`. Setting it to `true` excludes the asset from discovery and search. Setting it to `false` only permits search when every other eligibility condition also passes.

After an editor saves changes to visibility, metadata, or publication, the frontend invalidates the Verso discovery and search caches so the next visit or refresh uses current server data.

Search currently matches normalized celebrity names and aliases exactly. It is not semantic or fuzzy search.

## Important routes

### Frontend

| Route | Purpose | Status |
| --- | --- | --- |
| `/` | Ready | Redirects to the sample gallery |
| `/galleries/met-gala-2026` | Ready | Vogue-inspired gallery and discovery CTA |
| `/discover` | Placeholder | Search hub and image results |
| `/celebrities/:celebritySlug` | Placeholder | Celebrity archive |
| `/bookmarks` | Placeholder | Saved photographs |
| `/admin` | Placeholder | Internal dashboard |
| `/admin/photos` | Placeholder | Photo library |
| `/admin/photos/new` | Ready | Select and upload JPEG or PNG assets to the server |
| `/admin/photos/:assetId` | Ready | Load and edit server-backed photo metadata, including backstory |
| `/api/health` | Ready | API and provider health check |
| `/api/ready` | Ready | MongoDB-backed application readiness check |
| `GET /api/assets` | Ready | Paginated photo-library assets |
| `POST /api/assets` | Ready | Single or batch image ingestion |
| `GET /api/assets/:assetId` | Ready | Asset metadata and recognition state |
| `GET /api/assets/:assetId/image` | Ready | Stored image bytes |
| `POST /api/assets/:assetId/recognition/retry` | Ready | Explicitly retry failed or indeterminate recognition |
| `PATCH /api/assets/:assetId/metadata` | Ready | Save editorial metadata and recalculate celebrity decisions |
| `PUT /api/galleries/:galleryId/context` | Ready | Synchronize gallery tags, publication state, and assets |
| `DELETE /api/galleries/:galleryId/assets/:assetId` | Ready | Remove an asset from a gallery |
| `GET /api/search` | Ready | Resolve a celebrity name or alias and return matching images |
| `GET /api/celebrities/:celebritySlug` | Ready | Return a filtered celebrity archive |

### API

| Method and route | Purpose |
| --- | --- |
| `GET /api/health` | Process health |
| `GET /api/ready` | MongoDB and storage readiness |
| `POST /api/assets` | Upload assets |
| `GET /api/assets` | List assets |
| `GET /api/assets/:id` | Get asset details |
| `PATCH /api/assets/:id/editorial` | Save editorial metadata, visibility, and event usage |
| `GET /api/discovery` | Get ranked discovery people and representative images |
| `GET /api/search` | Search celebrities with event and year filters |
| `GET /api/celebrities/:slug` | Get a celebrity search archive response |

See [server/API.md](server/API.md) for request schemas, response schemas, and error behavior.

## Recognition decisions

| Condition | Search decision |
| --- | --- |
| Recognition confidence meets the configured threshold | Approved |
| Lower confidence is corroborated by title or caption | Approved |
| Lower confidence has no supporting editorial evidence | Needs review |
| Catalog-backed metadata identifies a supported person and event | Can be approved by inference |

Backstory and alt text are editorial content and are not used as identity evidence.

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```dotenv
NODE_ENV=development
PORT=3000
RECOGNITION_PROVIDER=fake
AWS_REGION=us-east-1
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=celeb_face_match
UPLOAD_DIR=data/uploads
RECOGNITION_APPROVAL_THRESHOLD=99
```

When `RECOGNITION_PROVIDER=aws-rekognition`, provide AWS credentials through your normal AWS credential chain. Do not commit credentials or `.env` files.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run Express and Vite together with file watching |
| `npm run dev:client` | Run only the Vite frontend |
| `npm run dev:server` | Run the combined server entry point with file watching |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run the Vitest suite |
| `npm run build` | Type-check and create production client/server builds |
| `npm start` | Run the production server from `dist-server` |

Before opening a pull request, run:

```bash
npm run typecheck
npm test
npm run build
```

MongoDB integration tests are optional and require a configured test database.

## Project layout

```text
src/                    React application
  pages/                Copilot and Verso route pages
  features/             API clients, hooks, schemas, and feature UI
server/                 Express API and backend services
  repositories/         MongoDB data access
shared/                 Contracts shared by client and server
data/uploads/           Local uploaded image storage
server/API.md           Detailed API documentation
```
