from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def load_jsonl(path: Path) -> list[dict]:
    records = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            records.append(json.loads(stripped))
    return records


def normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def celebrity_matches_title(celebrity_name: str, title: str) -> bool:
    normalized_name = normalize_text(celebrity_name)
    normalized_title = normalize_text(title)
    if not normalized_name or not normalized_title:
        return False

    if normalized_name in normalized_title:
        return True

    name_parts = [part for part in normalized_name.split() if part]
    if len(name_parts) >= 2 and all(part in normalized_title for part in name_parts):
        return True

    # Allow partial matches when at least one meaningful name token appears in the title.
    title_parts = set(normalized_title.split())
    meaningful_name_parts = [part for part in name_parts if len(part) >= 3]
    if any(part in title_parts for part in meaningful_name_parts):
        return True

    return False


def extract_title_subject(title: str) -> str:
    parts = re.split(r"\s+in\s+", title, maxsplit=1, flags=re.IGNORECASE)
    if not parts:
        return ""
    return parts[0].strip()


def curate_record(record: dict, min_confidence: float) -> dict:
    source = record.get("source", {})
    title = source.get("title", "") or ""
    title_subject = extract_title_subject(title)
    raw = record.get("rekognition_raw", {})
    celebrity_faces = raw.get("CelebrityFaces", []) or []

    identified_celebs = []
    curated_matches = []
    discarded_matches = []
    confident_rekognition_only = []

    for celebrity in celebrity_faces:
        name = celebrity.get("Name", "")
        confidence = celebrity.get("MatchConfidence") or 0
        title_match = celebrity_matches_title(name, title)

        curated_celebrity = {
            "name": name,
            "id": celebrity.get("Id"),
            "match_confidence": confidence,
            "title_match": title_match,
            "urls": celebrity.get("Urls", []),
        }

        if confidence >= min_confidence and title_match:
            curated_celebrity["identification_source"] = "rekognition + title"
            identified_celebs.append(curated_celebrity)
            curated_matches.append(curated_celebrity)
        elif confidence >= min_confidence:
            confident_rekognition_only.append(curated_celebrity)
            discarded_matches.append(curated_celebrity)
        else:
            discarded_matches.append(curated_celebrity)

    if not identified_celebs and title_subject:
        identified_celebs.append(
            {
                "name": title_subject,
                "id": None,
                "match_confidence": None,
                "title_match": True,
                "urls": [],
                "identification_source": "title only",
            }
        )
    elif not identified_celebs and not title_subject and len(confident_rekognition_only) == 1:
        rekognition_only_match = dict(confident_rekognition_only[0])
        rekognition_only_match["identification_source"] = "rekognition only"
        identified_celebs.append(rekognition_only_match)

    return {
        "status": record.get("status"),
        "processed_at": record.get("processed_at"),
        "source_key": record.get("source_key"),
        "source": source,
        "local_image_path": record.get("local_image_path"),
        "curation": {
            "min_confidence": min_confidence,
            "title_used": title,
            "title_subject": title_subject,
            "identified_celebs": identified_celebs,
            "identification_count": len(identified_celebs),
            "matched_celebs": curated_matches,
            "discarded_celebs": discarded_matches,
            "matched_count": len(curated_matches),
            "discarded_count": len(discarded_matches),
        },
        "error": record.get("error"),
    }


def summarize(curated_records: list[dict]) -> dict:
    success_records = [record for record in curated_records if record.get("status") == "success"]
    matched_records = [
        record for record in success_records if record.get("curation", {}).get("identification_count", 0) > 0
    ]
    return {
        "total_records": len(curated_records),
        "successful_records": len(success_records),
        "records_with_identification": len(matched_records),
        "records_without_identification": len(success_records) - len(matched_records),
        "records_with_verified_matches": len(
            [record for record in success_records if record.get("curation", {}).get("matched_count", 0) > 0]
        ),
        "records_with_title_only_identification": len(
            [
                record
                for record in success_records
                if any(
                    celeb.get("identification_source") == "title only"
                    for celeb in record.get("curation", {}).get("identified_celebs", [])
                )
            ]
        ),
        "error_records": len([record for record in curated_records if record.get("status") != "success"]),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Curate saved Rekognition output with confidence and title-matching rules."
    )
    parser.add_argument("results_file", help="Path to recognition_results.jsonl")
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=70.0,
        help="Minimum Rekognition match confidence. Defaults to 70.",
    )
    parser.add_argument(
        "--output-file",
        help="Optional path for curated JSON output. Defaults to curated_recognition_results.json",
    )
    args = parser.parse_args()

    results_file = Path(args.results_file).expanduser().resolve()
    if not results_file.exists():
        raise SystemExit(f"Results file not found: {results_file}")

    if args.output_file:
        output_file = Path(args.output_file).expanduser().resolve()
    else:
        output_file = results_file.with_name("curated_recognition_results.json")

    records = load_jsonl(results_file)
    curated_records = [curate_record(record, args.min_confidence) for record in records]
    output = {
        "summary": summarize(curated_records),
        "records": curated_records,
    }

    output_file.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"Saved curated results to {output_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
