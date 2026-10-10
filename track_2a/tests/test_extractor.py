"""
Unit and Integration tests for Conservative Parliamentary Extractor.
Tests zero-hallucination prompt, algorithmic provenance verifier,
and live extraction from real Swiss cantonal PDFs.
Track 2A - Hack Apertus 2026.
Uses standard Python library (no pytest dependency required).
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Ensure .env is loaded
_env_path = ROOT_DIR / ".env"
if _env_path.exists():
    load_dotenv(dotenv_path=_env_path)
else:
    load_dotenv()

from src.schema import (
    ParliamentaryAffair,
    Provenance,
    Actor,
    ExtractionStatus,
    ParliamentLevel,
    AffairType,
    LanguageCode
)
from src.extractor import (
    get_extraction_prompt_with_schema,
    verify_provenance,
    extract_affair_from_pdf
)
from src.cscs_client import CSCSInferenceClient


def test_system_prompt_rules():
    """Verify that the system prompt strictly embeds anti-hallucination and provenance rules."""
    prompt = get_extraction_prompt_with_schema()
    
    # Must enforce absence rule
    assert "STRICT RULE OF ABSENCE" in prompt
    assert "return null" in prompt or "null" in prompt
    assert "NEVER invent" in prompt

    # Must enforce verbatim provenance
    assert "MANDATORY VERIFIABLE PROVENANCE" in prompt
    assert "source_text_snippet" in prompt
    assert "page_number" in prompt
    assert "VERBATIM" in prompt

    # Must contain target JSON schema
    assert "ParliamentaryAffair" in prompt
    assert "properties" in prompt
    print("PASSED: test_system_prompt_rules")


def test_algorithmic_provenance_verification():
    """
    Test the provenance verifier against exact, relocated, and hallucinated snippets.
    Ensures mathematical accuracy of the provenance_score.
    """
    # Mock document pages
    mock_pages = [
        {
            "page_number": 1,
            "text": "Kanton Zürich\nÄnderung der Kantonalen Opferhilfeverordnung (KOHV)\n1. Oktober 2026",
            "char_count": 80
        },
        {
            "page_number": 2,
            "text": "Sehr geehrte Damen und Herren\nFreundliche Grüsse\nJacqueline Fehr\nRegierungsrätin",
            "char_count": 85
        }
    ]

    # Create mock affair with 3 provenance items:
    # 1. Exact match on cited page 1
    # 2. Relocated match on page 2 (cited page 1 by mistake)
    # 3. Hallucinated / invented quote not in text
    affair = ParliamentaryAffair(
        title="Änderung der Kantonalen Opferhilfeverordnung (KOHV)",
        canton_or_body="ZH",
        level=ParliamentLevel.CANTONAL,
        affair_type=AffairType.GOVERNMENT_AFFAIR,
        language=LanguageCode.DE,
        title_provenance=Provenance(
            page_number=1,
            source_text_snippet="Änderung der Kantonalen Opferhilfeverordnung (KOHV)"
        ),
        authors=[
            Actor(
                name="Jacqueline Fehr",
                role="author",
                provenance=Provenance(
                    page_number=1,  # Intentional error: actually on page 2
                    source_text_snippet="Jacqueline Fehr"
                )
            ),
            Actor(
                name="Fake Person",
                role="co-signatory",
                provenance=Provenance(
                    page_number=1,
                    source_text_snippet="This non-existent person was hallucinated by an LLM"
                )
            )
        ]
    )

    report = verify_provenance(affair, mock_pages)

    # Assertions
    assert report["total_citations"] == 3
    assert report["verified_citations"] == 2  # 1 exact + 1 relocated
    assert report["failed_citations"] == 1    # 1 hallucinated
    assert report["provenance_score"] == round(2 / 3, 3)

    # Item 1: Exact match on page 1
    assert affair.title_provenance.status == ExtractionStatus.EXTRACTED
    assert affair.title_provenance.char_start is not None
    assert affair.title_provenance.char_end is not None

    # Item 2: Relocated to page 2
    assert affair.authors[0].provenance.status == ExtractionStatus.INFERRED
    assert affair.authors[0].provenance.page_number == 2
    assert affair.authors[0].provenance.char_start is not None

    # Item 3: Hallucinated
    assert affair.authors[1].provenance.status == ExtractionStatus.NOT_FOUND
    assert affair.authors[1].provenance.char_start is None

    print(f"PASSED: test_algorithmic_provenance_verification (score={report['provenance_score']})")


def test_live_extraction_if_key_available():
    """
    Live extraction test running against CSCS Alps with Apertus 1.5-8B.
    Extracts from real Swiss PDF: ZH_341002_927679.pdf (Zurich, 2 pages).
    """
    live_key = os.getenv("CSCS_INFERENCE_API_KEY")
    if not live_key or live_key.startswith("test-"):
        print("\n[INFO] Live extraction test skipped: CSCS_INFERENCE_API_KEY is not configured.")
        return

    sample_pdf = ROOT_DIR / "data" / "sample_pdfs" / "ZH_341002_927679.pdf"
    if not sample_pdf.exists():
        # Fallback to AG sample if ZH not downloaded
        sample_pdf = ROOT_DIR / "data" / "sample_pdfs" / "AG_340791_927230.pdf"

    if not sample_pdf.exists():
        print(f"\n[INFO] Live extraction test skipped: Sample PDF not found at {sample_pdf}")
        return

    print("\n" + "=" * 60)
    print(f"Executing Live Apertus 1.5-8B Extraction on: {sample_pdf.name}...")
    print("=" * 60)

    client = CSCSInferenceClient(api_key=live_key)
    affair, report = extract_affair_from_pdf(
        pdf_path=sample_pdf,
        client=client,
        canton_hint="ZH" if "ZH_" in sample_pdf.name else "AG"
    )

    print("\n[EXTRACTED PARLIAMENTARY AFFAIR]")
    print(f"Title:         {affair.title}")
    print(f"Canton / Body: {affair.canton_or_body}")
    print(f"Level:         {affair.level.value}")
    print(f"Affair Type:   {affair.affair_type.value}")
    print(f"Authors ({len(affair.authors)}): {[a.name for a in affair.authors]}")
    print(f"Q&A Pairs:     {len(affair.questions_and_answers)}")
    print(f"Financials:    {len(affair.financial_details)}")
    print(f"Provenance:    {report['verified_citations']}/{report['total_citations']} verified ({report['provenance_score'] * 100:.1f}%)")

    # Assertions on extraction quality
    assert affair.title, "Extracted affair title must not be empty!"
    assert affair.canton_or_body in ["ZH", "AG", "CHE"]
    assert report["total_citations"] > 0, "Model must provide provenance citations for extracted facts!"
    assert report["provenance_score"] >= 0.5, f"Expected high provenance verification ratio, got {report['provenance_score']}"

    print("=" * 60)
    print("LIVE EXTRACTION TEST PASSED WITH PROVENANCE VERIFICATION!")
    print("=" * 60)


if __name__ == "__main__":
    print("=" * 60)
    print("Testing Conservative Extractor & Provenance Verifier (Track 2A)...")
    print("=" * 60)
    test_system_prompt_rules()
    test_algorithmic_provenance_verification()
    test_live_extraction_if_key_available()
    print("=" * 60)
    print("ALL EXTRACTOR TESTS PASSED!")
    print("=" * 60)
