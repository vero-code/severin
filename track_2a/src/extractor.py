"""
Conservative Parliamentary Affairs Extractor using Swiss-AI Apertus 1.5-8B.
Implements Rule 5, Zero-Hallucination Mandate, and Strict Provenance Verification.
Track 2A - Hack Apertus 2026.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union

from .schema import (ParliamentaryAffair, Provenance)
from .enums import ExtractionStatus
from .pdf_parser import extract_pdf_pages, format_pages_for_llm, find_snippet_offsets
from .cscs_client import CSCSInferenceClient
from .prompts import (
    get_extraction_prompt_with_schema,
    format_extraction_user_message,
)

logger = logging.getLogger("extractor")


# ============================================================================
# Algorithmic Provenance Verifier
# ============================================================================

def verify_single_provenance(
    provenance: Optional[Provenance],
    pages_map: Dict[int, str]
) -> Tuple[Optional[Provenance], bool]:
    """
    Verify that the provenance snippet exists verbatim on the cited physical page.
    If found, fills in exact char_start and char_end offsets.
    If found on a different page, corrects the page_number and sets status to INFERRED.
    If not found anywhere, sets status to NOT_FOUND.

    :param provenance: Provenance object to verify.
    :param pages_map: Dict mapping page_number -> normalized page text.
    :return: (updated_provenance, is_verified)
    """
    if provenance is None:
        return None, False

    snippet = provenance.source_text_snippet.strip()
    if not snippet:
        provenance.status = ExtractionStatus.NOT_FOUND
        return provenance, False

    cited_page = provenance.page_number
    page_text = pages_map.get(cited_page, "")

    # 1. Check on cited page first
    start, end = find_snippet_offsets(snippet, page_text)
    if start is not None and end is not None:
        provenance.char_start = start
        provenance.char_end = end
        provenance.status = ExtractionStatus.EXTRACTED
        return provenance, True

    # 2. Fallback: Search across all other pages in case LLM cited adjacent page
    for other_page, other_text in pages_map.items():
        if other_page == cited_page:
            continue
        start, end = find_snippet_offsets(snippet, other_text)
        if start is not None and end is not None:
            logger.info(
                f"Provenance relocated: snippet found on page {other_page} instead of cited page {cited_page}"
            )
            provenance.page_number = other_page
            provenance.char_start = start
            provenance.char_end = end
            provenance.status = ExtractionStatus.INFERRED
            return provenance, True

    # 3. Not found in source text
    logger.warning(
        f"Provenance unverified: snippet not found on page {cited_page}: '{snippet[:60]}...'"
    )
    provenance.status = ExtractionStatus.NOT_FOUND
    return provenance, False


def verify_provenance(
    affair: ParliamentaryAffair,
    pages: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Algorithmically verify all citations across an extracted ParliamentaryAffair.
    Calculates exact char offsets and the final verifiable provenance score.

    :param affair: Extracted ParliamentaryAffair Pydantic model.
    :param pages: List of raw parsed page dictionaries from pdf_parser.
    :return: Report dictionary with total, verified, failed counts, and provenance_score.
    """
    pages_map: Dict[int, str] = {p["page_number"]: p["text"] for p in pages}

    total_citations: int = 0
    verified_citations: int = 0
    verification_details: List[Dict[str, Any]] = []

    def check(field_name: str, prov: Optional[Provenance]) -> Optional[Provenance]:
        nonlocal total_citations, verified_citations
        if prov is None:
            return None
        total_citations += 1
        updated_prov, ok = verify_single_provenance(prov, pages_map)
        if ok:
            verified_citations += 1
        verification_details.append({
            "field": field_name,
            "page": updated_prov.page_number if updated_prov else None,
            "status": updated_prov.status.value if updated_prov else "not_found",
            "verified": ok,
            "snippet_preview": (updated_prov.source_text_snippet[:50] + "...") if updated_prov else ""
        })
        return updated_prov

    # 1. Document-level Provenance
    affair.title_provenance = check("title", affair.title_provenance)
    affair.rationale_provenance = check("background_and_rationale", affair.rationale_provenance)

    # 2. Authors
    for idx, author in enumerate(affair.authors):
        author.provenance = check(f"authors[{idx}].{author.name}", author.provenance)

    # 3. Questions & Answers
    for idx, qa in enumerate(affair.questions_and_answers):
        qa.question.provenance = check(f"questions[{idx}]", qa.question.provenance)
        if qa.answer:
            qa.answer.provenance = check(f"answers[{idx}]", qa.answer.provenance)

    # 4. Financial Details
    for idx, fin in enumerate(affair.financial_details):
        fin.provenance = check(f"financial_details[{idx}].{fin.purpose}", fin.provenance)

    # 5. Procedural Events
    for idx, ev in enumerate(affair.procedural_events):
        ev.provenance = check(f"procedural_events[{idx}].{ev.event_type}", ev.provenance)

    score = (
        round(verified_citations / total_citations, 3)
        if total_citations > 0
        else 1.0
    )

    logger.info(
        f"Provenance Verification Complete: {verified_citations}/{total_citations} verified "
        f"({score * 100:.1f}% match)"
    )

    return {
        "total_citations": total_citations,
        "verified_citations": verified_citations,
        "failed_citations": total_citations - verified_citations,
        "provenance_score": score,
        "details": verification_details
    }


# ============================================================================
# Main Extraction Pipeline
# ============================================================================

def clean_llm_json_response(content: str) -> str:
    """Strip markdown code fence wrappers if present in LLM response."""
    cleaned = content.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def extract_affair_from_pdf(
    pdf_path: Union[str, Path],
    client: Optional[CSCSInferenceClient] = None,
    canton_hint: Optional[str] = None,
    affair_id_hint: Optional[int] = None
) -> Tuple[ParliamentaryAffair, Dict[str, Any]]:
    """
    Extract a structured ParliamentaryAffair from a PDF using Apertus 1.5-8B on CSCS.
    Enforces deterministic temperature=0.0 and verifies provenance citations.

    :param pdf_path: Path to the Swiss parliamentary PDF document.
    :param client: Optional CSCSInferenceClient instance (defaults to standard client).
    :param canton_hint: Optional canton code hint (e.g., 'ZH', 'AG') from metadata.
    :param affair_id_hint: Optional OpenParlData affair ID hint.
    :return: Tuple of (validated ParliamentaryAffair, provenance verification report).
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    # Initialize client if not supplied
    cscs = client or CSCSInferenceClient()

    # 1. Parse PDF pages preserving 1-indexed numbers
    logger.info(f"Parsing pages from PDF: {path.name}...")
    pages = extract_pdf_pages(path)
    if not pages or all(p["char_count"] == 0 for p in pages):
        raise ValueError(f"No extractable text found in PDF: {path.name}")

    formatted_text = format_pages_for_llm(pages)

    # 2. Prepare prompt
    system_prompt = get_extraction_prompt_with_schema()
    user_prompt = format_extraction_user_message(
        filename=path.name,
        formatted_document_text=formatted_text,
        canton_hint=canton_hint,
        affair_id_hint=affair_id_hint
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    # 3. Call CSCS Apertus 1.5-8B at temperature=0.0
    task_label = f"Extract: {path.stem[:30]}"
    target_canton = canton_hint or (path.stem.split("_")[0] if "_" in path.stem else "CHE")

    logger.info(f"Submitting extraction request to CSCS for {path.name} ({len(pages)} pages)...")
    response_dict = cscs.chat_completion(
        messages=messages,
        response_format={"type": "json_object"},
        task=task_label,
        canton=target_canton,
        max_tokens=4096
    )

    raw_content = response_dict.get("content", "")
    cleaned_json = clean_llm_json_response(raw_content)

    # 4. Parse and validate against Pydantic schema
    try:
        raw_dict = json.loads(cleaned_json)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON response: {e}\nRaw Content:\n{raw_content[:500]}")
        raise ValueError(f"Model returned invalid JSON: {e}")

    # Inject hints if missing from extracted output
    if affair_id_hint and not raw_dict.get("affair_id"):
        raw_dict["affair_id"] = affair_id_hint
    if canton_hint and not raw_dict.get("canton_or_body"):
        raw_dict["canton_or_body"] = canton_hint

    try:
        affair = ParliamentaryAffair.model_validate(raw_dict)
    except Exception as e:
        logger.error(f"Pydantic schema validation error: {e}")
        raise

    # 5. Algorithmically verify provenance citations against source text
    verification_report = verify_provenance(affair, pages)

    # Update latest history record in client telemetry with verified provenance score
    if cscs.history:
        cscs.history[-1]["provenance_score"] = verification_report["provenance_score"]
        cscs._save_telemetry()

    logger.info(
        f"Extraction successful for {path.name}: title='{affair.title[:50]}...', "
        f"authors={len(affair.authors)}, questions={len(affair.questions_and_answers)}, "
        f"provenance_score={verification_report['provenance_score']}"
    )

    return affair, verification_report
