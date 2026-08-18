from __future__ import annotations

import argparse
import re
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path, PurePosixPath
from zipfile import ZipFile


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "office": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "package": "http://schemas.openxmlformats.org/package/2006/relationships",
}

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return cleaned or "image"


def read_shared_strings(zip_file: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zip_file.namelist():
        return []

    root = ET.fromstring(zip_file.read("xl/sharedStrings.xml"))
    shared_strings = []
    for item in root.findall("main:si", NS):
        text = "".join(node.text or "" for node in item.iterfind(".//main:t", NS))
        shared_strings.append(text)
    return shared_strings


def resolve_first_sheet_path(zip_file: ZipFile) -> str:
    workbook = ET.fromstring(zip_file.read("xl/workbook.xml"))
    relationships = ET.fromstring(zip_file.read("xl/_rels/workbook.xml.rels"))
    rel_map = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in relationships.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")
    }

    first_sheet = workbook.find("main:sheets", NS).findall("main:sheet", NS)[0]
    rel_id = first_sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
    target = rel_map[rel_id]

    if target.startswith("/"):
        path = str(PurePosixPath(target).relative_to("/"))
    else:
        path = str(PurePosixPath("xl") / target)

    return path.replace("xl/xl/", "xl/")


def extract_cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    inline = cell.find("main:is", NS)
    if inline is not None:
        return "".join(node.text or "" for node in inline.iterfind(".//main:t", NS))

    value = cell.find("main:v", NS)
    if value is None:
        return ""

    raw = value.text or ""
    if cell.attrib.get("t") == "s":
        return shared_strings[int(raw)]
    return raw


def load_rows(xlsx_path: Path) -> list[dict[str, str]]:
    with ZipFile(xlsx_path) as zip_file:
        shared_strings = read_shared_strings(zip_file)
        sheet_path = resolve_first_sheet_path(zip_file)
        sheet = ET.fromstring(zip_file.read(sheet_path))

    rows = sheet.find("main:sheetData", NS).findall("main:row", NS)
    parsed_rows: list[list[str]] = []
    for row in rows:
        parsed_rows.append(
            [extract_cell_value(cell, shared_strings) for cell in row.findall("main:c", NS)]
        )

    if not parsed_rows:
        return []

    headers = parsed_rows[0]
    data_rows = []
    for values in parsed_rows[1:]:
        row_data = {header: values[index] if index < len(values) else "" for index, header in enumerate(headers)}
        data_rows.append(row_data)
    return data_rows


def infer_extension(url: str) -> str:
    path = urllib.request.urlparse(url).path
    suffix = Path(path).suffix.lower()
    if suffix in SUPPORTED_EXTENSIONS:
        return suffix
    return ".jpg"


def download_file(url: str, destination: Path, timeout_seconds: int = 30) -> None:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        destination.write_bytes(response.read())


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download image URLs from the first sheet in an .xlsx file."
    )
    parser.add_argument("xlsx_path", help="Path to the spreadsheet.")
    parser.add_argument(
        "--url-column",
        default="image_url",
        help="Column containing image URLs. Defaults to image_url.",
    )
    parser.add_argument(
        "--name-column",
        default="title",
        help="Column used to build filenames. Defaults to title.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Optional number of data rows to process from the sheet.",
    )
    parser.add_argument(
        "--output-dir",
        help='Optional folder where images should be saved. Defaults to a sibling folder named "Gallery Images".',
    )
    args = parser.parse_args()

    xlsx_path = Path(args.xlsx_path).expanduser().resolve()
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be greater than 0")

    if args.output_dir:
        output_dir = Path(args.output_dir).expanduser().resolve()
    else:
        output_dir = xlsx_path.parent.parent / "Gallery Images"
    output_dir.mkdir(parents=True, exist_ok=True)

    rows = load_rows(xlsx_path)
    if not rows:
        raise SystemExit(f"No rows found in {xlsx_path}")

    if args.limit is not None:
        rows = rows[: args.limit]

    for index, row in enumerate(rows, start=1):
        url = row.get(args.url_column, "").strip()
        if not url:
            continue

        name_source = row.get(args.name_column, "").strip() or f"image-{index}"
        filename = f"{index:03d}-{slugify(name_source)}{infer_extension(url)}"
        destination = output_dir / filename

        try:
            download_file(url, destination)
            print(f"Downloaded {destination}")
        except urllib.error.URLError as error:
            print(f"Failed to download {url}: {error}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
