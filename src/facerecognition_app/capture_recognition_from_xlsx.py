from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from botocore.exceptions import BotoCoreError, ClientError

from facerecognition_app.download_images_from_xlsx import (
    download_file,
    infer_extension,
    load_rows,
    slugify,
)
from facerecognition_app.recognize_celebrities import build_client, recognize_image


def default_paths(xlsx_path: Path) -> tuple[Path, Path, Path]:
    base_dir = xlsx_path.parent.parent
    gallery_dir = base_dir / "Gallery Images"
    state_file = base_dir / "processing_state.json"
    results_file = base_dir / "recognition_results.jsonl"
    return gallery_dir, state_file, results_file


def load_state(state_file: Path) -> dict:
    if not state_file.exists():
        return {"processed": {}}
    return json.loads(state_file.read_text(encoding="utf-8"))


def save_state(state_file: Path, state: dict) -> None:
    state_file.write_text(json.dumps(state, indent=2), encoding="utf-8")


def append_jsonl(results_file: Path, record: dict) -> None:
    with results_file.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")


def build_source_key(row: dict[str, str], fallback_index: int) -> str:
    return row.get("rel_id") or row.get("image_url") or f"row-{fallback_index}"


def build_destination(row: dict[str, str], index: int, gallery_dir: Path) -> Path:
    name_source = row.get("title", "").strip() or f"image-{index}"
    extension = infer_extension(row.get("image_url", ""))
    filename = f"{index:03d}-{slugify(name_source)}{extension}"
    return gallery_dir / filename


def capture_new_rows(
    rows: list[dict[str, str]],
    gallery_dir: Path,
    results_file: Path,
    state_file: Path,
    state: dict,
    region: str,
    download_timeout_seconds: int,
) -> None:
    client = build_client(region)
    processed = state.setdefault("processed", {})
    total_rows = len(rows)
    pending_rows: list[tuple[int, dict[str, str], str, str, Path]] = []

    for index, row in enumerate(rows, start=1):
        source_key = build_source_key(row, index)
        if source_key in processed:
            print(f"Skipping already processed row: {source_key}")
            continue

        image_url = row.get("image_url", "").strip()
        if not image_url:
            print(f"Skipping row {index}: missing image_url")
            continue

        destination = build_destination(row, index, gallery_dir)
        print(f"Queueing row {index}/{total_rows} for download: {source_key}")

        try:
            if not destination.exists():
                print(f"Downloading image to {destination}")
                download_file(image_url, destination, timeout_seconds=download_timeout_seconds)
            else:
                print(f"Using existing image at {destination}")
            pending_rows.append((index, row, source_key, image_url, destination))
        except OSError as error:
            timestamp = datetime.now(timezone.utc).isoformat()
            record = {
                "status": "error",
                "processed_at": timestamp,
                "source_key": source_key,
                "source": {
                    "position": row.get("position"),
                    "rel_id": row.get("rel_id"),
                    "image_url": image_url,
                    "title": row.get("title"),
                },
                "local_image_path": str(destination),
                "error": str(error),
            }
            append_jsonl(results_file, record)
            print(f"Failed download for {source_key}: {error}")

    if pending_rows:
        print(f"Finished downloads. Starting Rekognition for {len(pending_rows)} new images.")

    for recognize_index, (index, row, source_key, image_url, destination) in enumerate(pending_rows, start=1):
        timestamp = datetime.now(timezone.utc).isoformat()
        print(f"Calling Rekognition for {source_key} ({recognize_index}/{len(pending_rows)})")
        try:
            print(f"Calling Rekognition for {source_key}")
            response = recognize_image(client, destination)
            record = {
                "status": "success",
                "processed_at": timestamp,
                "source_key": source_key,
                "source": {
                    "position": row.get("position"),
                    "rel_id": row.get("rel_id"),
                    "image_url": image_url,
                    "title": row.get("title"),
                },
                "local_image_path": str(destination),
                "rekognition_raw": response,
            }
            append_jsonl(results_file, record)
            processed[source_key] = {
                "processed_at": timestamp,
                "local_image_path": str(destination),
                "results_file": str(results_file),
            }
            save_state(state_file, state)
            print(f"Captured recognition for {source_key}")
        except (BotoCoreError, ClientError) as error:
            record = {
                "status": "error",
                "processed_at": timestamp,
                "source_key": source_key,
                "source": {
                    "position": row.get("position"),
                    "rel_id": row.get("rel_id"),
                    "image_url": image_url,
                    "title": row.get("title"),
                },
                "local_image_path": str(destination),
                "error": str(error),
            }
            append_jsonl(results_file, record)
            print(f"Failed for {source_key}: {error}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Capture raw Rekognition results for only new spreadsheet rows."
    )
    parser.add_argument("xlsx_path", help="Path to the spreadsheet.")
    parser.add_argument(
        "--limit",
        type=int,
        help="Optional number of data rows to process from the sheet.",
    )
    parser.add_argument(
        "--region",
        default=os.getenv("AWS_REGION", "us-east-1"),
        help="AWS region for Rekognition. Defaults to AWS_REGION or us-east-1.",
    )
    parser.add_argument(
        "--download-timeout",
        type=int,
        default=30,
        help="Timeout in seconds for each image download. Defaults to 30.",
    )
    parser.add_argument("--gallery-dir", help='Folder for downloaded images.')
    parser.add_argument("--state-file", help="JSON file tracking rows already processed.")
    parser.add_argument("--results-file", help="JSONL file for raw recognition output.")
    args = parser.parse_args()

    xlsx_path = Path(args.xlsx_path).expanduser().resolve()
    if not xlsx_path.exists():
        raise SystemExit(f"Spreadsheet not found: {xlsx_path}")
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be greater than 0")

    default_gallery_dir, default_state_file, default_results_file = default_paths(xlsx_path)
    gallery_dir = Path(args.gallery_dir).expanduser().resolve() if args.gallery_dir else default_gallery_dir
    state_file = Path(args.state_file).expanduser().resolve() if args.state_file else default_state_file
    results_file = Path(args.results_file).expanduser().resolve() if args.results_file else default_results_file

    gallery_dir.mkdir(parents=True, exist_ok=True)
    results_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.parent.mkdir(parents=True, exist_ok=True)

    rows = load_rows(xlsx_path)
    if args.limit is not None:
        rows = rows[: args.limit]

    state = load_state(state_file)
    capture_new_rows(
        rows,
        gallery_dir,
        results_file,
        state_file,
        state,
        args.region,
        args.download_timeout,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
