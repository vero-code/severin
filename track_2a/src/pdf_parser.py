"""
Page-Level PDF Text Parser with Strict Provenance Tracking.
Extracts text page by page preserving 1-indexed physical page numbers
and character offsets for conservative human verification.
Track 2A - Hack Apertus 2026.
"""

import logging
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional, Union
from pypdf import PdfReader

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pdf_parser")


def clean_page_text(text: str) -> str:
    """Normalize excessive whitespace and PDF glyph artifacts while preserving structure."""
    if not text:
        return ""
    # Normalize non-breaking spaces, form feeds, soft hyphens, and replacement glyphs
    cleaned = (
        text.replace("\xa0", " ")
        .replace("\x0c", "\n")
        .replace("\xad", "")
        .replace("\u200b", "")
        .replace("\ufffd", "")
    )
    # Collapse 3+ consecutive newlines to double newline
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    # Strip trailing/leading spaces on lines
    cleaned = "\n".join(line.rstrip() for line in cleaned.splitlines())
    return cleaned.strip()


def extract_pdf_pages(pdf_path: Union[str, Path]) -> List[Dict[str, Any]]:
    """
    Extract text from a PDF file page by page.

    :param pdf_path: Path to the binary PDF file.
    :return: List of dictionaries with structure:
             [
                 {
                     "page_number": int (1-indexed physical PDF page),
                     "text": str (extracted and normalized text),
                     "char_count": int (number of characters)
                 },
                 ...
             ]
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file does not exist: {path}")

    pages_data: List[Dict[str, Any]] = []

    try:
        reader = PdfReader(str(path))
        num_pages = len(reader.pages)
        logger.info(f"Extracting {num_pages} pages from {path.name}...")

        for idx, page in enumerate(reader.pages):
            phys_page_num = idx + 1  # Strictly 1-indexed
            try:
                raw_text = page.extract_text() or ""
                cleaned = clean_page_text(raw_text)
                pages_data.append({
                    "page_number": phys_page_num,
                    "text": cleaned,
                    "char_count": len(cleaned)
                })
            except Exception as e:
                logger.warning(f"Error extracting page {phys_page_num} of {path.name}: {e}")
                pages_data.append({
                    "page_number": phys_page_num,
                    "text": "",
                    "char_count": 0
                })

        logger.info(f"Successfully parsed {len(pages_data)} pages from {path.name}")
        return pages_data

    except Exception as e:
        logger.error(f"Failed to read PDF {path}: {e}")
        raise


def format_pages_for_llm(pages: List[Dict[str, Any]]) -> str:
    """
    Format extracted pages into demarcated text for Apertus LLM prompt.
    Includes explicit page boundaries so the model can cite exact page numbers.
    """
    demarcated_blocks = []
    for p in pages:
        page_num = p["page_number"]
        text = p["text"]
        demarcated_blocks.append(f"--- [PAGE {page_num}] ---\n{text}")

    return "\n\n".join(demarcated_blocks)


def normalize_for_matching(text: str) -> str:
    """Normalize text for resilient quote matching across PDF extraction artifacts."""
    if not text:
        return ""
    # Strip soft hyphens, zero-width spaces, replacement glyphs, and control characters
    cleaned = re.sub(r"[\xad\u200b\ufffd\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    # Normalize typographic dashes and quotes
    cleaned = (
        cleaned.replace("–", "-")
        .replace("—", "-")
        .replace("«", '"')
        .replace("»", '"')
        .replace("“", '"')
        .replace("”", '"')
        .replace("„", '"')
    )
    # De-hyphenate words broken across line wraps: e.g. "Opferhil-\nfeverordnung" -> "Opferhilfeverordnung"
    cleaned = re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1\2", cleaned)
    # Collapse all whitespace sequences into single space
    return " ".join(cleaned.split())


def find_snippet_offsets(snippet: str, page_text: str) -> Tuple[Optional[int], Optional[int]]:
    """
    Locate character offsets (char_start, char_end) of a verbatim snippet within page text.
    Resilient to whitespace variances, PDF soft-hyphens, line wraps, and typographic quotes.
    """
    if not snippet or not page_text:
        return None, None

    # 1. Exact match
    idx = page_text.find(snippet)
    if idx != -1:
        return idx, idx + len(snippet)

    # 2. Case-insensitive match
    idx = page_text.lower().find(snippet.lower())
    if idx != -1:
        return idx, idx + len(snippet)

    # 3. Normalized whitespace match
    def normalize_ws(s: str) -> str:
        return " ".join(s.split())

    norm_snippet = normalize_ws(snippet)
    norm_page = normalize_ws(page_text)
    idx = norm_page.lower().find(norm_snippet.lower())
    if idx != -1:
        # Approximate offset back to page_text using anchor prefix
        anchor = norm_snippet[:min(25, len(norm_snippet))].strip()
        anchor_idx = page_text.lower().find(anchor.lower())
        if anchor_idx != -1:
            return anchor_idx, min(len(page_text), anchor_idx + len(snippet))
        return 0, min(len(page_text), len(snippet))

    # 4. Deep artifact normalization (soft-hyphens, de-hyphenation, quotes)
    clean_s = normalize_for_matching(snippet)
    clean_p = normalize_for_matching(page_text)
    idx = clean_p.lower().find(clean_s.lower())
    if idx != -1:
        anchor = clean_s[:min(25, len(clean_s))].strip()
        anchor_idx = page_text.lower().find(anchor.lower())
        if anchor_idx != -1:
            return anchor_idx, min(len(page_text), anchor_idx + len(snippet))
        return 0, min(len(page_text), len(snippet))

    # 5. Long prefix anchor match (if LLM truncated or slightly appended punctuation)
    if len(clean_s) > 30:
        prefix = clean_s[:30]
        idx = clean_p.lower().find(prefix.lower())
        if idx != -1:
            anchor = prefix[:20]
            anchor_idx = page_text.lower().find(anchor.lower())
            if anchor_idx != -1:
                return anchor_idx, min(len(page_text), anchor_idx + len(snippet))
            return 0, min(len(page_text), len(snippet))

    return None, None
