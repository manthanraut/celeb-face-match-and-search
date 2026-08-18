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
- Preserved Python utilities for offline Rekognition experiments and benchmarking

## Current User Flow

```text
Open application
    → Met Gala 2026 gallery
    → Explore Celebrity Photos CTA
    → Discover page placeholder
```

The upload workflow, AWS API endpoint, database, search results, and celebrity archive
are planned next; they are not implemented yet.

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
- Vitest

## Requirements

- Node.js 20.14 or newer
- npm 10 or newer
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

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Express with Vite development middleware |
| `npm run typecheck` | Validate browser, shared, and server TypeScript |
| `npm test` | Run the Vitest suite |
| `npm run build` | Type-check and build the client and server |
| `NODE_ENV=production npm start` | Serve an existing production build |

To verify the production build locally:

```bash
npm run build
NODE_ENV=production npm start
```

## Environment Configuration

Copy `.env.example` to `.env`. The initial configuration is:

```env
NODE_ENV=development
PORT=3000
RECOGNITION_PROVIDER=aws-rekognition
AWS_REGION=us-east-1
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
│   ├── config/                   # Environment validation
│   ├── recognition/              # Recognition provider boundary
│   └── routes/                   # API routes
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
- Local SQLite databases
- Files under `data/uploads/`
- Raw recognition-result files
- Unapproved or unlicensed photographs
- Python virtual environments
- `node_modules/` or build output

This repository is an internal hackathon prototype and does not currently include a
license for external distribution.
