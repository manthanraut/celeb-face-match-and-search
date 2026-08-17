from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Iterable

import boto3
from botocore.exceptions import BotoCoreError, ClientError


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def iter_image_paths(image_dir: Path) -> Iterable[Path]:
    for path in sorted(image_dir.iterdir()):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            yield path


def build_client(region: str):
    return boto3.client("rekognition", region_name=region)


def recognize_image(client, image_path: Path) -> dict:
    with image_path.open("rb") as image_file:
        return client.recognize_celebrities(Image={"Bytes": image_file.read()})


def simplify_result(image_path: Path, response: dict) -> dict:
    celebrities = []
    for celebrity in response.get("CelebrityFaces", []):
        celebrities.append(
            {
                "name": celebrity.get("Name"),
                "id": celebrity.get("Id"),
                "match_confidence": celebrity.get("MatchConfidence"),
                "urls": celebrity.get("Urls", []),
            }
        )

    return {
        "file": str(image_path),
        "recognized_count": len(celebrities),
        "celebrities": celebrities,
        "unrecognized_face_count": len(response.get("UnrecognizedFaces", [])),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Recognize celebrities in local image files with Amazon Rekognition."
    )
    parser.add_argument(
        "image_dir",
        help="Folder containing .jpg, .jpeg, or .png images.",
    )
    parser.add_argument(
        "--region",
        default=os.getenv("AWS_REGION", "us-east-1"),
        help="AWS region for Rekognition. Defaults to AWS_REGION or us-east-1.",
    )
    parser.add_argument(
        "--output",
        help="Optional path to save JSON results.",
    )
    args = parser.parse_args()

    image_dir = Path(args.image_dir).expanduser().resolve()
    if not image_dir.exists() or not image_dir.is_dir():
        raise SystemExit(f"Image folder not found: {image_dir}")

    image_paths = list(iter_image_paths(image_dir))
    if not image_paths:
        raise SystemExit(
            f"No supported images found in {image_dir}. Use .jpg, .jpeg, or .png files."
        )

    client = build_client(args.region)
    results = []

    for image_path in image_paths:
        try:
            response = recognize_image(client, image_path)
            result = simplify_result(image_path, response)
            results.append(result)
            print(json.dumps(result, indent=2))
        except (BotoCoreError, ClientError) as error:
            failure = {
                "file": str(image_path),
                "error": str(error),
            }
            results.append(failure)
            print(json.dumps(failure, indent=2))

    if args.output:
        output_path = Path(args.output).expanduser().resolve()
        output_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
        print(f"Saved results to {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
