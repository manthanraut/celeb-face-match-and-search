# Face Recognition App

Minimal starter for running Amazon Rekognition celebrity recognition against images in a local folder on your Mac.

## 1. Install the Python dependency

```bash
python3 -m pip install -r requirements.txt
```

## 2. Configure AWS credentials

You do not need the AWS CLI for the first version. `boto3` can read credentials from environment variables or from the standard AWS credentials file.

### Option A: Environment variables

```bash
export AWS_ACCESS_KEY_ID="your-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
export AWS_REGION="us-east-1"
```

If you use temporary credentials, also set:

```bash
export AWS_SESSION_TOKEN="your-session-token"
```

### Option B: `~/.aws/credentials`

Create this file on your Mac:

```ini
[default]
aws_access_key_id = your-access-key-id
aws_secret_access_key = your-secret-access-key
```

Then create `~/.aws/config`:

```ini
[default]
region = us-east-1
```

Your IAM user needs permission to call Rekognition. A starter policy is often `AmazonRekognitionFullAccess`.

## 3. Put your images in a folder

Example:

```text
~/Desktop/celeb-images
```

Supported formats:

- `.jpg`
- `.jpeg`
- `.png`

## 4. Run the script

```bash
python3 src/facerecognition_app/recognize_celebrities.py ~/Desktop/celeb-images
```

To also save all results to JSON:

```bash
python3 src/facerecognition_app/recognize_celebrities.py ~/Desktop/celeb-images --output results.json
```

## Output

For each image, the script prints JSON with:

- detected celebrity names
- Rekognition celebrity IDs
- match confidence
- related URLs when available
- count of unrecognized faces

## Notes

- This uses Amazon Rekognition's `RecognizeCelebrities` API for known public figures.
- Rekognition does not identify non-celebrities by name with this API.
- The image bytes are sent directly from your Mac to AWS; S3 is not required for this image workflow.

## Download images from your spreadsheet

Your spreadsheet can live anywhere on your Mac. For the file:

```text
~/Desktop/celeb-images/Input Files/vogue_metgala_redcarpet.xlsx
```

and an output folder like:

```text
~/Desktop/celeb-images/downloaded-images
```

run:

```bash
.venv/bin/python src/facerecognition_app/download_images_from_xlsx.py \
  "~/Desktop/celeb-images/Input Files/vogue_metgala_redcarpet.xlsx"
```

This reads the first sheet, uses the `image_url` column for URLs, uses the `title` column to build readable filenames, and saves everything into:

```text
~/Desktop/celeb-images/Gallery Images
```

To only process the first `10` data rows:

```bash
.venv/bin/python src/facerecognition_app/download_images_from_xlsx.py \
  "~/Desktop/celeb-images/Input Files/vogue_metgala_redcarpet.xlsx" \
  --limit 10
```

After the download finishes, run celebrity recognition on the downloaded folder:

```bash
.venv/bin/python src/facerecognition_app/recognize_celebrities.py \
  "~/Desktop/celeb-images/Gallery Images"
```

## Incremental capture with saved raw Rekognition output

If you want to call the Rekognition API only once per new spreadsheet row and reuse the saved output later, run:

```bash
PYTHONPATH=src .venv/bin/python src/facerecognition_app/capture_recognition_from_xlsx.py \
  "~/Desktop/celeb-images/Input Files/vogue_metgala_redcarpet.xlsx"
```

To only capture the first `10` rows:

```bash
PYTHONPATH=src .venv/bin/python src/facerecognition_app/capture_recognition_from_xlsx.py \
  "~/Desktop/celeb-images/Input Files/vogue_metgala_redcarpet.xlsx" \
  --limit 10
```

This creates:

- `Gallery Images`: downloaded image files
- `processing_state.json`: compact index of rows already processed
- `recognition_results.jsonl`: append-only raw Rekognition results, one JSON record per image

`recognition_results.jsonl` is the best primary storage format here because each image can have multiple celebrities and the raw Rekognition payload is naturally nested JSON. You can then do downstream filtering and title-based validation without calling the API again.

## Curate saved results without re-calling Rekognition

To apply downstream rules offline:

- keep only celebrities with `match_confidence >= 70`
- keep only celebrities whose name appears to match the image `title`

run:

```bash
.venv/bin/python src/facerecognition_app/curate_recognition_results.py \
  "~/Desktop/celeb-images/recognition_results.jsonl"
```

This writes:

```text
~/Desktop/celeb-images/curated_recognition_results.json
```

You can override the confidence threshold:

```bash
.venv/bin/python src/facerecognition_app/curate_recognition_results.py \
  "~/Desktop/celeb-images/recognition_results.jsonl" \
  --min-confidence 75
```

The curated output includes:

- image metadata
- processing time
- verified celebrity matches
- discarded celebrity matches
- errors, if any
