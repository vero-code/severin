"""
Page-Level PDF Text Parser with Strict Provenance Tracking.
Extracts text page by page preserving 1-indexed physical page numbers
and character offsets for conservative human verification.
Track 2A - Hack Apertus 2026.
"""

import os
import json
import logging
import re
import unicodedata
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional, Union
from pypdf import PdfReader

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pdf_parser")


def normalize_swiss_text(text: str) -> str:
    """
    Comprehensive normalization for Swiss multi-lingual parliamentary texts:
    - Normalizes Unicode composition (NFC).
    - Expands typographic ligatures (fi, fl, ff, ffi, ffl, oe, ae).
    - Maps known legacy PDF Type 1 embedded font glyph artifacts (\x11 -> š, \x12 -> č, etc.).
    - Strips unprintable control characters and zero-width spaces.
    - Unifies typographic quotes and dashes.
    """
    if not text:
        return ""

    # 1. Unicode canonical composition
    text = unicodedata.normalize("NFC", text)

    # 2. Ligatures expansion
    ligatures = {
        "ﬁ": "fi",
        "ﬂ": "fl",
        "ﬀ": "ff",
        "ﬃ": "ffi",
        "ﬄ": "ffl",
        "œ": "oe",
        "Œ": "OE",
        "æ": "ae",
        "Æ": "AE",
    }
    for lig, rep in ligatures.items():
        text = text.replace(lig, rep)

    # 3. Known PDF Type 1 and Windows-1252 / CP1252 embedded font glyph artifacts
    glyph_map = {
        "\x11": "š",
        "\x12": "č",
        "\x13": "ć",
        "\x14": "ž",
        "\x15": "đ",
        "\x8a": "Š",
        "\x8c": "Œ",
        "\x8e": "Ž",
        "\x9a": "š",
        "\x9c": "œ",
        "\x9e": "ž",
        "\x9f": "Ÿ",
    }
    for g, rep in glyph_map.items():
        text = text.replace(g, rep)

    # 4. Strip unprintable ASCII C0 control characters, zero-width spaces, and replacement glyphs
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b-\u200f\ufeff\ufffd]", "", text)

    # 5. Typographic dashes & quotes
    text = (
        text.replace("–", "-")
        .replace("—", "-")
        .replace("«", '"')
        .replace("»", '"')
        .replace("“", '"')
        .replace("”", '"')
        .replace("„", '"')
        .replace("’", "'")
        .replace("‘", "'")
    )

    return text


def fold_diacritics(text: str) -> str:
    """Strip all diacritical marks (accents, umlauts, carons) for fallback search matching."""
    if not text:
        return ""
    normalized = normalize_swiss_text(text)
    return "".join(
        c for c in unicodedata.normalize("NFD", normalized)
        if unicodedata.category(c) != "Mn"
    ).lower()


def clean_page_text(text: str) -> str:
    """Normalize excessive whitespace and PDF glyph artifacts while preserving structure."""
    if not text:
        return ""
    cleaned = normalize_swiss_text(text)
    # Normalize non-breaking spaces and form feeds
    cleaned = cleaned.replace("\xa0", " ").replace("\x0c", "\n")
    # Collapse 3+ consecutive newlines to double newline
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    # Strip trailing/leading spaces on lines
    cleaned = "\n".join(line.rstrip() for line in cleaned.splitlines())
    return cleaned.strip()


def ocr_pdf_with_apertus_vision(pdf_path: Path, max_pages: int = 5) -> List[Dict[str, Any]]:
    """
    Transcribe scanned or image-only PDF pages natively using Swiss-AI Apertus 1.5-8B Vision.
    Checks persistent disk cache under data/ocr_cache/{pdf_name}.json first.
    If uncached and CSCS_INFERENCE_API_KEY is available, invokes Apertus Vision on Alps GH200.
    """
    ocr_cache_dir = Path(__file__).resolve().parent.parent / "data" / "ocr_cache"
    cache_file = ocr_cache_dir / f"{pdf_path.name}.json"

    # 1. Return persistent OCR cache if available
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached = json.load(f)
                pages = cached.get("pages", [])
                if pages:
                    logger.info(f"[VISION-OCR] Loaded {len(pages)} transcribed pages from cache for '{pdf_path.name}'")
                    return pages
        except Exception as e:
            logger.warning(f"[VISION-OCR] Error reading OCR cache for {pdf_path.name}: {e}")

    # 2. Check if CSCS API key is available for live vision OCR
    api_key = os.getenv("CSCS_INFERENCE_API_KEY")
    if not api_key:
        logger.info(f"[VISION-OCR] No CSCS_INFERENCE_API_KEY set; skipping live vision transcription for '{pdf_path.name}'")
        return []

    try:
        from PIL import Image
        import io
        import base64
        import requests

        reader = PdfReader(str(pdf_path))
        transcribed_pages: List[Dict[str, Any]] = []

        pages_to_process = list(enumerate(reader.pages))[:max_pages]
        for idx, page in pages_to_process:
            page_num = idx + 1
            if not page.images:
                continue

            # Extract the primary full-page scanned image
            img_obj = page.images[0]
            im = Image.open(io.BytesIO(img_obj.data))

            # Resize if dimensions exceed 2048 to optimize latency and bandwidth
            max_dim = 2048
            if max(im.size) > max_dim:
                scale = max_dim / max(im.size)
                new_size = (int(im.size[0] * scale), int(im.size[1] * scale))
                im = im.resize(new_size, Image.Resampling.LANCZOS)

            if im.mode != "RGB":
                im = im.convert("RGB")

            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=85)
            b64_data = base64.b64encode(buf.getvalue()).decode("utf-8")

            payload = {
                "model": "swiss-ai/Apertus-v1.5-8B",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Transcribe all readable text from this scanned Swiss parliamentary document page accurately in the original language. Provide a faithful transcription without commentary."
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{b64_data}"}
                            }
                        ]
                    }
                ],
                "max_tokens": 1500,
                "temperature": 0.0
            }

            resp = requests.post(
                "https://api.inference.cscs.ch/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=60
            )
            if resp.status_code == 200:
                data = resp.json()
                text = clean_page_text(data["choices"][0]["message"]["content"])
                transcribed_pages.append({
                    "page_number": page_num,
                    "text": text,
                    "char_count": len(text)
                })
                logger.info(f"[VISION-OCR] Transcribed page {page_num} of '{pdf_path.name}' ({len(text)} chars)")
            else:
                logger.warning(f"[VISION-OCR] CSCS API returned HTTP {resp.status_code} on page {page_num}: {resp.text}")

        if transcribed_pages:
            total_chars = sum(p["char_count"] for p in transcribed_pages)
            ocr_cache_dir.mkdir(parents=True, exist_ok=True)
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump({"file_name": pdf_path.name, "pages": transcribed_pages, "total_chars": total_chars}, f, indent=2, ensure_ascii=False)
            logger.info(f"[VISION-OCR] Saved {len(transcribed_pages)} pages ({total_chars:,} chars) to {cache_file.name}")
            return transcribed_pages

    except Exception as e:
        logger.error(f"[VISION-OCR] Failed to transcribe scanned PDF '{pdf_path.name}': {e}")

    return []


def extract_pdf_pages(pdf_path: Union[str, Path]) -> List[Dict[str, Any]]:
    """
    Extract text from a PDF file page by page.
    Automatically falls back to Apertus Native Vision OCR for scanned or bitmap PDFs.

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

        # Check if PDF is a scanned document (0 extractable digital characters)
        total_extracted = sum(p["char_count"] for p in pages_data)
        if total_extracted == 0 and num_pages > 0:
            logger.info(f"PDF '{path.name}' has 0 extractable digital characters. Invoking Apertus Native Vision OCR...")
            ocr_pages = ocr_pdf_with_apertus_vision(path, max_pages=num_pages)
            if ocr_pages and any(p["char_count"] > 0 for p in ocr_pages):
                logger.info(f"Successfully recovered {len(ocr_pages)} pages via Apertus Native Vision OCR for '{path.name}'")
                return ocr_pages

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
    # Normalize known PDF Type 1 embedded font glyph artifacts (\x11 -> š)
    text = text.replace("\x11", "š")
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

    # 2b. Regex-based flexible whitespace & hyphen-resilient match (handles line-wraps, Dun-\nkelziffer, etc.)
    def _word_pattern(w: str) -> str:
        return r"(?:[-\u00ad\u2010\u2011]\s*)?".join(re.escape(c) for c in w)

    norm_s = normalize_swiss_text(snippet).strip()
    words = [_word_pattern(w) for w in norm_s.split() if w]
    if len(words) >= 2:
        try:
            pattern = r"\s+".join(words)
            m = re.search(pattern, page_text, re.IGNORECASE)
            if m:
                return m.start(), m.end()
        except re.error:
            pass

    # 2c. Diacritic-folded fallback match (resilient to accents/umlauts dropped or corrupted by PDF drivers)
    folded_s = fold_diacritics(norm_s)
    folded_p = fold_diacritics(page_text)
    f_words = [_word_pattern(w) for w in folded_s.split() if w]
    if len(f_words) >= 2:
        try:
            pattern = r"\s+".join(f_words)
            m = re.search(pattern, folded_p)
            if m:
                return m.start(), m.end()
        except re.error:
            pass

        # 2d. Leading anchor words match with suffix boundary detection
        if len(f_words) >= 3:
            for k in (min(4, len(f_words)), 3):
                try:
                    anchor_pattern = r"\s+".join(f_words[:k])
                    m = re.search(anchor_pattern, folded_p)
                    if m:
                        start = m.start()
                        semi_idx = page_text.find(";", start)
                        if semi_idx != -1 and semi_idx - start <= len(snippet) + 30:
                            end = semi_idx + 1
                        else:
                            end = None
                            for s_k in (min(3, len(f_words)), 2, 1):
                                try:
                                    s_pat = r"\s+".join(f_words[-s_k:])
                                    s_m = re.search(s_pat, folded_p[start:])
                                    if s_m:
                                        end = start + s_m.end()
                                        break
                                except re.error:
                                    pass
                            if end is None:
                                end = min(len(page_text), start + len(snippet))
                        return start, end
                except re.error:
                    pass

        # 2e. Token cluster matching (resilient to internal letter drops like š->empty by LLMs)
        delims = r'[;,.:"()\[\]{}]'
        tokens = [re.sub(delims, '', t) for t in folded_s.split()]
        tokens = [t for t in tokens if len(t) >= 3]
        if len(tokens) >= 2:
            token_positions = []
            for t in tokens:
                for m in re.finditer(re.escape(t), folded_p):
                    token_positions.append((m.start(), m.end(), t))
            if token_positions:
                max_span = int(len(snippet) * 1.5) + 40
                best_cluster = []
                token_positions.sort(key=lambda x: x[0])
                for i, start_pos in enumerate(token_positions):
                    cluster = [start_pos]
                    for next_pos in token_positions[i+1:]:
                        if next_pos[0] - start_pos[0] <= max_span:
                            if not any(x[2] == next_pos[2] for x in cluster):
                                cluster.append(next_pos)
                        else:
                            break
                    if len(cluster) > len(best_cluster):
                        best_cluster = cluster
                if len(best_cluster) >= max(2, int(len(tokens) * 0.5)):
                    cluster_start = best_cluster[0][0]
                    cluster_end = max(x[1] for x in best_cluster)
                    lookback = page_text[max(0, cluster_start - 30):cluster_start]
                    semi = lookback.rfind(';')
                    if semi != -1:
                        start = max(0, cluster_start - 30) + semi + 1
                        while start < len(page_text) and page_text[start] in ' \t\n\r':
                            start += 1
                    else:
                        start = cluster_start
                    lookforward = page_text[cluster_end:min(len(page_text), cluster_end + 30)]
                    semi_fwd = lookforward.find(';')
                    if semi_fwd != -1:
                        end = cluster_end + semi_fwd + 1
                    else:
                        end = cluster_end
                    return start, end

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
