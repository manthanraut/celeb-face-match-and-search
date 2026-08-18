# Celebrity Image Discovery

A hackathon prototype that demonstrates how celebrity recognition can turn editorial
photography into a searchable discovery experience.

The application currently presents a Vogue-inspired Met Gala gallery with a call to
action that leads into the planned celebrity image search. It runs the React frontend
and Express API from one TypeScript project and is configured for AWS Rekognition.

## Current Features

- Responsive Met Gala 2026 editorial gallery
- CTA from the gallery to celebrity image discovery
- Placeholder routes for search, bookmarks, celebrity archives, and editor tools
- React and Express served by one development process
- Shared, validated recognition-result contract
- AWS Rekognition SDK and server-side provider configuration
- MongoDB connection lifecycle, readiness check, and idempotent index initialization
- Idempotent single and batch image ingestion with local file storage
- Asset list, detail, and image-serving APIs for the Copilot mock
- Preserved Python utilities for offline Rekognition experiments and benchmarking

## Current User Flow

```text
Open application
    → Met Gala 2026 gallery
    → Explore Celebrity Photos CTA
    → Discover page placeholder
```

The backend upload workflow and persisted asset model are ready. The editor UI, AWS
recognition worker, search results, and celebrity archive are planned next.

## Technology

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- Node.js and Express
- Zod
- AWS SDK for Rekognition
- MongoDB
- Multer
- Vitest

## Requirements

- Node.js 20.14 or newer
- npm 10 or newer
- A local MongoDB instance for backend development
- Internet access for the sample gallery image
- AWS credentials only when working on Rekognition features

## Quick Start

Clone your fork and enter the project:

```bash
git clone https://github.com/<your-username>/celeb-face-match-and-search.git
cd celeb-face-match-and-search
```

Install dependencies and create a local environment file:

```bash
npm install
cp .env.example .env
```

Make sure MongoDB is running before starting the application. The default configuration
connects to `mongodb://127.0.0.1:27017` and uses the `celeb_face_match` database.

Start the application:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The root URL redirects to the Met Gala gallery. Verify the API process at:

```text
http://localhost:3000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "recognitionProvider": "aws-rekognition"
}
```

Verify that MongoDB is ready at:

```text
http://localhost:3000/api/ready
```

Expected response:

```json
{
  "status": "ready",
  "checks": {
    "database": "up"
  }
}
```

Stop the development server with `Ctrl+C`.

## Available Routes

| Route | Status | Purpose |
| --- | --- | --- |
| `/` | Ready | Redirects to the sample gallery |
| `/galleries/met-gala-2026` | Ready | Vogue-inspired gallery and discovery CTA |
| `/discover` | Placeholder | Search hub and image results |
| `/celebrities/:celebritySlug` | Placeholder | Celebrity archive |
| `/bookmarks` | Placeholder | Saved photographs |
| `/admin` | Placeholder | Internal dashboard |
| `/admin/photos` | Placeholder | Photo library |
| `/admin/photos/new` | Placeholder | Photo upload and analysis form |
| `/admin/photos/:assetId` | Placeholder | Photo and recognition details |
| `/api/health` | Ready | API and provider health check |
| `/api/ready` | Ready | MongoDB-backed application readiness check |
| `GET /api/assets` | Ready | Paginated photo-library assets |
| `POST /api/assets` | Ready | Single or batch image ingestion |
| `GET /api/assets/:assetId` | Ready | Asset metadata and recognition state |
| `GET /api/assets/:assetId/image` | Ready | Stored image bytes |

## Asset Ingestion API

Upload one to ten JPEG or PNG images using repeated `images` fields. Each image must
be no larger than 5 MiB, matching
[Amazon Rekognition's raw-byte input constraints](https://docs.aws.amazon.com/rekognition/latest/dg/limits.html),
with neither edge above 10,000 pixels and no more than 50 megapixels. The `manifest` must
contain one client-generated UUID per image in the same order:

```bash
curl -X POST http://localhost:3000/api/assets \
  -F 'images=@/path/to/rihanna.jpg' \
  -F 'manifest=[{"clientAssetId":"f167c99c-9ad0-4f3d-aad4-bf19cbe15a90"}]'
```

The response is immediate after the image and MongoDB record are saved. Recognition is
initialized as `QUEUED`; Phase 3 will process it asynchronously. Reusing a client asset
ID with the same bytes returns the original asset, while reusing it for different bytes
returns `409`.

Upload results preserve manifest order and include a `created` flag plus relative asset,
image, and admin links. The endpoint returns `201` when at least one asset is created and
`200` when the whole request is an idempotent replay. Idempotency is scoped to the client
asset ID, so the same image bytes uploaded with different IDs create separate assets.

Batches are persisted one asset at a time. If a later image fails, earlier successful
assets remain; safely retry the full batch with the same client asset IDs. Under concurrent
upload load, the endpoint can return `429`; clients should retry with a short backoff.

List assets newest first with an optional cursor:

```text
GET /api/assets?limit=20&cursor=<asset-id>
```

`limit` defaults to `20` and accepts values from `1` through `100`. When `nextCursor` is
not `null`, pass it as the next request's `cursor` to continue listing.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Express with Vite development middleware |
| `npm run typecheck` | Validate browser, shared, server, and test TypeScript |
| `npm test` | Run the Vitest suite; MongoDB integration tests are skipped unless configured |
| `npm run build` | Type-check and build the client and server |
| `NODE_ENV=production npm start` | Serve an existing production build |

To verify the production build locally:

```bash
npm run build
NODE_ENV=production npm start
```

Run the MongoDB integration tests against the local instance explicitly:

```bash
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 \
  npm test -- tests/database/mongo.integration.test.ts
```

The integration suite creates a uniquely named test database and drops it when the run finishes.

## Environment Configuration

Copy `.env.example` to `.env`. The initial configuration is:

```env
NODE_ENV=development
PORT=3000
RECOGNITION_PROVIDER=aws-rekognition
AWS_REGION=us-east-1
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=celeb_face_match
UPLOAD_DIR=data/uploads
RECOGNITION_APPROVAL_THRESHOLD=90
```

The web application currently accepts only:

```env
RECOGNITION_PROVIDER=aws-rekognition
```

### AWS Credentials

AWS credentials are not needed to view the gallery or work on frontend pages. They
will be required when the Rekognition endpoint is implemented.

Prefer an AWS profile or temporary credentials configured outside the repository:

```bash
export AWS_PROFILE="your-profile"
export AWS_REGION="us-east-1"
```

When temporary environment credentials are required:

```bash
export AWS_ACCESS_KEY_ID="your-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
export AWS_SESSION_TOKEN="your-session-token"
export AWS_REGION="us-east-1"
```

Never put secrets in variables beginning with `VITE_`; Vite exposes those variables
to browser code. Never commit `.env` files or AWS credentials.

## Application Architecture

The project is one application, not separately deployed frontend and backend services.

```text
Browser
   ↓
Express server
   ├── /api/*  → API routes and future AWS/database services
   ├── MongoDB  → metadata, recognition state and gallery usage
   ├── data/uploads → ignored local image storage
   └── /*       → React application through Vite or the production build
```

In development, Express mounts Vite as middleware. In production, Express serves the
built React files from `dist/`.

## Project Structure

```text
celeb-face-match-and-search/
├── src/                          # React application
│   ├── app/                      # Providers, router, and application shell
│   ├── pages/                    # Gallery and future feature pages
│   └── styles/                   # Tailwind and global styles
├── server/                       # Express API
│   ├── app.ts                    # Testable Express application factory
│   ├── config/                   # Environment validation
│   ├── database/                 # MongoDB lifecycle and indexes
│   ├── middleware/               # Consistent API errors
│   ├── recognition/              # Recognition provider boundary
│   ├── repositories/             # Asset persistence boundary and Mongo implementation
│   ├── routes/                   # API routes
│   ├── services/                 # Asset ingestion orchestration
│   └── storage/                  # Local image-storage boundary
├── shared/                       # Browser/server contracts and schemas
├── data/
│   ├── uploads/                  # Ignored local uploads
│   └── recognition-results/      # Ignored local AI responses
├── tools/
│   ├── facerecognition_app/      # Existing Python proof of concept
│   └── requirements.txt          # Python-only dependencies
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── tsconfig.test.json
├── vitest.config.ts
├── BACKEND_IMPLEMENTATION_CHECKLIST.md
└── vite.config.ts
```

## Gallery Asset

The current prototype loads its sample image remotely from `assets.vogue.com`; the
image is not stored in this repository. Keep photo credits visible and confirm content
usage rights before introducing additional assets.

## Offline Python Rekognition Tools

The scripts under `tools/facerecognition_app/` are preserved as offline experimentation
and benchmark utilities. The Express server does not execute them.

### Python Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r tools/requirements.txt
```

The scripts support `.jpg`, `.jpeg`, and `.png` images. The spreadsheet downloader also
accepts `.webp` image URLs.

### Recognize Images in a Folder

```bash
python3 tools/facerecognition_app/recognize_celebrities.py \
  ~/Desktop/celeb-images
```

Save simplified results to JSON:

```bash
python3 tools/facerecognition_app/recognize_celebrities.py \
  ~/Desktop/celeb-images \
  --output results.json
```

### Download Spreadsheet Images

The first worksheet must contain an `image_url` column. The optional `title` column is
used to generate readable filenames.

```bash
.venv/bin/python tools/facerecognition_app/download_images_from_xlsx.py \
  "~/Desktop/celeb-images/Input Files/vogue_metgala_redcarpet.xlsx"
```

Process only the first 10 rows:

```bash
.venv/bin/python tools/facerecognition_app/download_images_from_xlsx.py \
  "~/Desktop/celeb-images/Input Files/vogue_metgala_redcarpet.xlsx" \
  --limit 10
```

### Capture Raw Rekognition Results Incrementally

This command downloads new spreadsheet images, skips previously processed rows, and
appends one raw Rekognition record per image to `recognition_results.jsonl`:

```bash
PYTHONPATH=tools .venv/bin/python \
  tools/facerecognition_app/capture_recognition_from_xlsx.py \
  "~/Desktop/celeb-images/Input Files/vogue_metgala_redcarpet.xlsx"
```

Add `--limit 10` to restrict the run.

### Curate Saved Results

The curation script filters by Rekognition confidence and checks recognized names
against image titles without calling AWS again:

```bash
.venv/bin/python tools/facerecognition_app/curate_recognition_results.py \
  "~/Desktop/celeb-images/recognition_results.jsonl"
```

Override the default confidence threshold:

```bash
.venv/bin/python tools/facerecognition_app/curate_recognition_results.py \
  "~/Desktop/celeb-images/recognition_results.jsonl" \
  --min-confidence 75
```

### Search Curated Results

```bash
.venv/bin/python tools/facerecognition_app/search_curated_results.py \
  "~/Desktop/celeb-images/curated_recognition_results.json" \
  "Rihanna" \
  --limit 5
```

## Collaboration Workflow

1. Sync your fork with the upstream `main` branch.
2. Create a branch such as `feat/gallery-page` or `feat/aws-rekognition`.
3. Make focused changes and run `npm run typecheck`, `npm test`, and `npm run build`.
4. Push the feature branch to your fork.
5. Open a pull request against the upstream `main` branch.

Do not push directly to `main`.

## Security and Repository Hygiene

Do not commit:

- `.env` files or AWS credentials
- Local database exports
- Files under `data/uploads/`
- Raw recognition-result files
- Unapproved or unlicensed photographs
- Python virtual environments
- `node_modules/` or build output

This repository is an internal hackathon prototype and does not currently include a
license for external distribution.
