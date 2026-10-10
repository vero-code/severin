"""
Curated Dataset Downloader and Verifier for Track 2A.
Downloads a diverse, nationwide sample of Swiss parliamentary PDFs
across all 26 cantons and the Federal Assembly (27 jurisdictions).
Enforces the strict 100 MB size limit constraint on track_2a/data/.
"""

import json
import logging
from pathlib import Path
from typing import List, Dict, Any

from .api_client import OpenParlDataClient
from .enums import SearchMode

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("dataset_downloader")

MAX_DATA_DIR_BYTES = 100 * 1024 * 1024  # 100 MB limit

# All 26 Swiss cantons + Federal Assembly (27 jurisdictions nationwide)
TARGET_BODIES = [
    # Federal
    {"body_key": "CHE", "level": "federal", "lang": "de", "desc": "Federal Assembly (Bund)"},
    # German Cantons
    {"body_key": "ZH", "level": "cantonal", "lang": "de", "desc": "Zürich"},
    {"body_key": "BE", "level": "cantonal", "lang": "de", "desc": "Bern (Bilingual DE/FR)"},
    {"body_key": "LU", "level": "cantonal", "lang": "de", "desc": "Luzern"},
    {"body_key": "UR", "level": "cantonal", "lang": "de", "desc": "Uri"},
    {"body_key": "SZ", "level": "cantonal", "lang": "de", "desc": "Schwyz"},
    {"body_key": "OW", "level": "cantonal", "lang": "de", "desc": "Obwalden"},
    {"body_key": "NW", "level": "cantonal", "lang": "de", "desc": "Nidwalden"},
    {"body_key": "GL", "level": "cantonal", "lang": "de", "desc": "Glarus"},
    {"body_key": "ZG", "level": "cantonal", "lang": "de", "desc": "Zug"},
    {"body_key": "SO", "level": "cantonal", "lang": "de", "desc": "Solothurn"},
    {"body_key": "BS", "level": "cantonal", "lang": "de", "desc": "Basel-Stadt"},
    {"body_key": "BL", "level": "cantonal", "lang": "de", "desc": "Basel-Landschaft"},
    {"body_key": "SH", "level": "cantonal", "lang": "de", "desc": "Schaffhausen"},
    {"body_key": "AR", "level": "cantonal", "lang": "de", "desc": "Appenzell Ausserrhoden"},
    {"body_key": "AI", "level": "cantonal", "lang": "de", "desc": "Appenzell Innerrhoden"},
    {"body_key": "SG", "level": "cantonal", "lang": "de", "desc": "St. Gallen"},
    {"body_key": "AG", "level": "cantonal", "lang": "de", "desc": "Aargau"},
    {"body_key": "TG", "level": "cantonal", "lang": "de", "desc": "Thurgau"},
    # Trilingual & Bilingual Cantons
    {"body_key": "GR", "level": "cantonal", "lang": "de", "desc": "Graubünden (DE/IT/RM)"},
    {"body_key": "VS", "level": "cantonal", "lang": "fr", "desc": "Valais / Wallis (FR/DE)"},
    {"body_key": "FR", "level": "cantonal", "lang": "fr", "desc": "Fribourg / Freiburg (FR/DE)"},
    # French Cantons (Romandie)
    {"body_key": "GE", "level": "cantonal", "lang": "fr", "desc": "Genève"},
    {"body_key": "VD", "level": "cantonal", "lang": "fr", "desc": "Vaud"},
    {"body_key": "NE", "level": "cantonal", "lang": "fr", "desc": "Neuchâtel"},
    {"body_key": "JU", "level": "cantonal", "lang": "fr", "desc": "Jura"},
    # Italian Canton
    {"body_key": "TI", "level": "cantonal", "lang": "it", "desc": "Ticino"},
]


def get_data_dir_size_bytes(directory: Path) -> int:
    """Calculate total size in bytes of all files in directory."""
    if not directory.exists():
        return 0
    total = 0
    for entry in directory.rglob("*"):
        if entry.is_file():
            total += entry.stat().st_size
    return total


def download_curated_sample(
    output_dir: Path,
    client: OpenParlDataClient,
    docs_per_body: int = 1
) -> List[Dict[str, Any]]:
    """
    Download representative PDFs from all target bodies and generate manifest.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_items: List[Dict[str, Any]] = []

    for target in TARGET_BODIES:
        body_key = target["body_key"]
        logger.info(f"Searching sample affair for {target['desc']} [{body_key}]...")

        # Search affairs with attached documents (limit=35 for bodies with sparse doc links)
        res = client.get_affairs(
            body_key=body_key,
            limit=35,
            expand="docs",
            search_mode=SearchMode.PARTIAL
        )

        data = res.get("data", [])
        downloaded_count = 0

        for affair in data:
            raw_docs = affair.get("docs")
            docs_list = []
            if isinstance(raw_docs, dict) and "data" in raw_docs:
                docs_list = raw_docs["data"]
            elif isinstance(raw_docs, list):
                docs_list = raw_docs

            if not docs_list:
                continue

            for doc in docs_list:
                doc_url = doc.get("url_oparl") or doc.get("url")
                if not doc_url:
                    continue

                doc_id = doc.get("id")
                safe_name = f"{body_key}_{affair.get('id')}_{doc_id}.pdf"
                dest_path = output_dir / safe_name

                # Check 100 MB limit before downloading
                current_size = get_data_dir_size_bytes(output_dir)
                if current_size >= MAX_DATA_DIR_BYTES:
                    logger.warning("Approaching 100 MB directory limit. Halting downloads.")
                    break

                # If already downloaded, reuse existing file
                if not dest_path.exists() or dest_path.stat().st_size == 0:
                    logger.info(f"Downloading {safe_name} from {doc_url}...")
                    success = client.download_pdf(doc_url, dest_path)
                    if not (success and dest_path.exists()):
                        continue
                else:
                    logger.info(f"Reusing existing {safe_name}")

                file_size = dest_path.stat().st_size
                manifest_items.append({
                    "file_name": safe_name,
                    "affair_id": affair.get("id"),
                    "short_id": affair.get("short_id"),
                    "title": affair.get("title"),
                    "body_key": body_key,
                    "level": target["level"],
                    "language": target["lang"],
                    "doc_id": doc_id,
                    "doc_name": doc.get("name") or doc.get("title"),
                    "url": doc_url,
                    "size_bytes": file_size
                })
                downloaded_count += 1
                break  # Pick one clean document per affair

            if downloaded_count >= docs_per_body:
                break

    # Save manifest.json
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_items, f, indent=2, ensure_ascii=False)

    total_mb = get_data_dir_size_bytes(output_dir) / (1024 * 1024)
    logger.info(f"Downloaded {len(manifest_items)} sample PDFs. Total size: {total_mb:.2f} MB (Limit: 100 MB)")
    return manifest_items


def main():
    base_data_dir = Path(__file__).resolve().parent.parent / "data" / "sample_pdfs"
    client = OpenParlDataClient(timeout=30)
    print("=" * 60)
    print("Downloading Curated Sample PDFs for ALL 26 Swiss Cantons + Confederation...")
    print("=" * 60)
    manifest = download_curated_sample(base_data_dir, client, docs_per_body=1)
    print(f"\nManifest saved: {base_data_dir / 'manifest.json'}")
    total_bytes = get_data_dir_size_bytes(base_data_dir)
    print(f"Total directory size: {total_bytes / (1024 * 1024):.2f} MB / 100 MB limit")
    print(f"Downloaded {len(manifest)} representative documents across Switzerland.")


if __name__ == "__main__":
    main()
