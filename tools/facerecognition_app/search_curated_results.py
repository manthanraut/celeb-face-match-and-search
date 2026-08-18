from __future__ import annotations

import argparse
import difflib
import json
import re
from pathlib import Path


def normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def load_curated_results(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def alias_variants(value: str) -> set[str]:
    normalized = normalize_text(value)
    variants = {normalized}

    replacements = {
        "a ap": "asap",
        "a sap": "asap",
        "beyonce": "beyonce",
        "jay z": "jay z",
    }
    for old, new in replacements.items():
        if old in normalized:
            variants.add(normalized.replace(old, new))

    return {variant.strip() for variant in variants if variant.strip()}


def fuzzy_score(query: str, candidate: str) -> float:
    return difflib.SequenceMatcher(None, query, candidate).ratio() * 100


def matches_query(query: str, celeb_name: str, min_fuzzy_score: float) -> tuple[bool, str, float]:
    normalized_name = normalize_text(celeb_name)
    if not normalized_name:
        return False, "", 0.0

    query_variants = alias_variants(query)
    name_variants = alias_variants(celeb_name)

    for query_variant in query_variants:
        query_parts = [part for part in query_variant.split() if part]
        for name_variant in name_variants:
            if query_variant == name_variant:
                return True, "exact", 100.0
            if query_variant in name_variant:
                return True, "partial", 100.0
            if query_parts and all(part in name_variant for part in query_parts):
                return True, "token", 100.0

            score = fuzzy_score(query_variant, name_variant)
            if score >= min_fuzzy_score:
                return True, "fuzzy", score

    best_score = 0.0
    for query_variant in query_variants:
        for name_variant in name_variants:
            best_score = max(best_score, fuzzy_score(query_variant, name_variant))
    return False, "", best_score


def search_records(records: list[dict], query: str, min_fuzzy_score: float) -> list[dict]:
    matches = []

    for record in records:
        identified_celebs = record.get("curation", {}).get("identified_celebs", [])
        for celeb in identified_celebs:
            celeb_name = celeb.get("name", "")
            is_match, match_type, score = matches_query(query, celeb_name, min_fuzzy_score)
            if not is_match:
                continue

            matches.append(
                {
                    "celebrity_name": celeb_name,
                    "search_match_type": match_type,
                    "search_score": round(score, 2),
                    "identification_source": celeb.get("identification_source"),
                    "match_confidence": celeb.get("match_confidence"),
                    "image_url": record.get("source", {}).get("image_url"),
                    "title": record.get("source", {}).get("title"),
                    "local_image_path": record.get("local_image_path"),
                    "processed_at": record.get("processed_at"),
                }
            )
            break

    return matches


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Search curated celebrity results and return matching image URLs."
    )
    parser.add_argument("curated_results_file", help="Path to curated_recognition_results.json")
    parser.add_argument("query", help="Celebrity name to search for")
    parser.add_argument(
        "--limit",
        type=int,
        help="Optional max number of matches to return.",
    )
    parser.add_argument(
        "--min-fuzzy-score",
        type=float,
        default=85.0,
        help="Minimum fuzzy-match score for typo-tolerant matches. Defaults to 85.",
    )
    args = parser.parse_args()

    curated_results_file = Path(args.curated_results_file).expanduser().resolve()
    if not curated_results_file.exists():
        raise SystemExit(f"Curated results file not found: {curated_results_file}")

    data = load_curated_results(curated_results_file)
    matches = search_records(data.get("records", []), args.query, args.min_fuzzy_score)
    if args.limit is not None:
        matches = matches[: args.limit]

    print(
        json.dumps(
            {
                "query": args.query,
                "count": len(matches),
                "min_fuzzy_score": args.min_fuzzy_score,
                "matches": matches,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
