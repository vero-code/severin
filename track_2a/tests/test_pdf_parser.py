"""
Unit tests for page-level PDF text parser and snippet offset tracking.
Track 2A - Hack Apertus 2026.
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.pdf_parser import extract_pdf_pages, format_pages_for_llm, find_snippet_offsets


def test_pdf_parsing_on_real_samples():
    sample_dir = ROOT_DIR / "data" / "sample_pdfs"
    pdf_files = list(sample_dir.glob("*.pdf"))
    assert len(pdf_files) > 0, "No sample PDFs found in data/sample_pdfs!"

    print("=" * 60)
    print("Testing PDF parser on real Swiss parliamentary documents...")
    print("=" * 60)

    # Pick first 2 files (e.g. ZH and BE or NE)
    for pdf_path in pdf_files[:2]:
        pages = extract_pdf_pages(pdf_path)
        assert len(pages) > 0, f"No pages extracted from {pdf_path.name}"

        # 1. Check page number continuity (1-indexed)
        for i, p in enumerate(pages):
            assert p["page_number"] == i + 1, f"Page index mismatch on {pdf_path.name}"
            assert "text" in p
            assert "char_count" in p

        # 2. Check formatted output with LLM page markers
        formatted = format_pages_for_llm(pages)
        assert "--- [PAGE 1] ---" in formatted, "Page marker missing in LLM formatted text"

        # 3. Check snippet search on extracted text
        first_page_text = pages[0]["text"]
        if len(first_page_text) > 20:
            sample_snippet = first_page_text[5:25]
            start, end = find_snippet_offsets(sample_snippet, first_page_text)
            assert start is not None and end is not None, "Failed to find snippet offsets"
            assert end > start, "Invalid snippet offsets"

        total_chars = sum(p["char_count"] for p in pages)
        print(f"PASSED: {pdf_path.name} -> {len(pages)} pages, {total_chars} characters.")

    print("=" * 60)
    print("ALL PDF PARSER TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    test_pdf_parsing_on_real_samples()
