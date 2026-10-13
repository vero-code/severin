"""
Conservative Parliamentary Affairs Extractor using Swiss-AI Apertus 1.5-8B.
Implements Rule 5, Zero-Hallucination Mandate, and Strict Provenance Verification.
Track 2A - Hack Apertus 2026.
"""

import re
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union

from .schema import (ParliamentaryAffair, Provenance)
from .enums import ExtractionStatus
from .pdf_parser import extract_pdf_pages, format_pages_for_llm, find_snippet_offsets, normalize_swiss_text
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
        provenance.source_text_snippet = page_text[start:end]
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
            provenance.source_text_snippet = other_text[start:end]
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
        if author.provenance and author.provenance.status in (ExtractionStatus.EXTRACTED, ExtractionStatus.INFERRED):
            # Ground the author's name to the physical text in the PDF before comma/semicolon
            raw_chunk = author.provenance.source_text_snippet.split(",")[0].split(";")[0].strip()
            if ":" in raw_chunk:
                raw_chunk = raw_chunk.split(":")[-1].strip()
            if raw_chunk and 2 <= len(raw_chunk) <= 60 and not any(p in raw_chunk.lower() for p in ("depart", "direktion", "amt", "initiative")):
                author.name = raw_chunk

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
        "details": verification_details,
        "pages": pages
    }


# ============================================================================
# Main Extraction Pipeline
# ============================================================================

def normalize_provenance(prov: Any) -> Optional[Dict[str, Any]]:
    """Defensively clean and validate a provenance dictionary."""
    if not isinstance(prov, dict):
        return None
    snippet = prov.get("source_text_snippet") or prov.get("snippet") or prov.get("quote")
    if not snippet or not isinstance(snippet, str) or not snippet.strip():
        return None
    page = prov.get("page_number") or prov.get("page") or 1
    try:
        page_num = max(1, int(page))
    except (ValueError, TypeError):
        page_num = 1

    clean_prov: Dict[str, Any] = {
        "page_number": page_num,
        "source_text_snippet": normalize_swiss_text(snippet).strip(),
    }
    if "char_start" in prov and isinstance(prov["char_start"], int):
        clean_prov["char_start"] = prov["char_start"]
    if "char_end" in prov and isinstance(prov["char_end"], int):
        clean_prov["char_end"] = prov["char_end"]
    if "status" in prov and isinstance(prov["status"], str):
        clean_prov["status"] = prov["status"].lower()
    return clean_prov


def normalize_extracted_dict(raw_dict: Any) -> Dict[str, Any]:
    """
    Defensively normalize and sanitize raw dictionary returned by Apertus LLM:
    - Unwraps outer envelope wrappers (e.g., 'ParliamentaryAffair', 'affair', 'data').
    - Hoists root affair fields that small LLMs occasionally dump inside authors[0].
    - Normalizes actors (converting strings, cleaning extra fields).
    - Normalizes questions_and_answers (flattened questions, string questions, etc.).
    - Normalizes financial details and procedural events.
    - Cleans provenance fields (dropping empty snippets, ensuring page_number >= 1).
    - Maps and standardizes enums (level, affair_type, language, canton_or_body).
    - Strips JSON Schema meta properties ($schema, $defs, etc.).
    """
    if not isinstance(raw_dict, dict):
        return raw_dict

    # 1. Outer envelope unwrap
    for wrapper in ("ParliamentaryAffair", "parliamentary_affair", "affair", "data", "result", "record"):
        if wrapper in raw_dict and isinstance(raw_dict[wrapper], dict):
            inner = raw_dict.pop(wrapper)
            for k, v in raw_dict.items():
                if not k.startswith("$") and k not in inner:
                    inner[k] = v
            raw_dict = inner
            break

    # 2. Strip schema meta keys that violate extra='forbid'
    for meta_key in ("$schema", "$id", "$defs", "definitions", "_comment", "properties"):
        raw_dict.pop(meta_key, None)

    # 3. Hoist root affair fields that small LLMs occasionally dump inside authors[0]
    root_affair_keys = {
        "background_and_rationale",
        "rationale_provenance",
        "questions_and_answers",
        "financial_details",
        "procedural_events",
        "title_provenance",
        "title",
        "short_id",
        "submission_date",
        "addressed_to",
        "affair_type",
        "level",
        "language",
        "canton_or_body",
    }
    authors = raw_dict.get("authors")
    if isinstance(authors, list):
        for author in authors:
            if isinstance(author, dict):
                for k in root_affair_keys:
                    if k in author:
                        val = author.pop(k)
                        if k not in raw_dict or raw_dict[k] is None or (isinstance(raw_dict[k], list) and len(raw_dict[k]) == 0):
                            raw_dict[k] = val

    # 4. Clean authors
    cleaned_authors = []
    if isinstance(raw_dict.get("authors"), list):
        for item in raw_dict["authors"]:
            if isinstance(item, str) and item.strip():
                cleaned_authors.append({"name": item.strip(), "role": "author"})
            elif isinstance(item, dict):
                name = item.get("name") or item.get("author_name") or item.get("full_name") or ""
                if not name and item.get("role"):
                    name = item.get("role")
                if name:
                    name_str = normalize_swiss_text(str(name)).strip()
                    if ":" in name_str and any(p in name_str.lower() for p in ("initiativ", "komitee", "urheber", "unterzeichn", "bestehend", "berechtigt")):
                        name_str = name_str.split(":")[-1].strip()
                    if "," in name_str and any(char.isdigit() for char in name_str):
                        name_str = name_str.split(",")[0].strip()

                    author_dict = {
                        "name": name_str,
                        "role": str(item.get("role", "author") or "author").strip().lower(),
                        "party_or_fraction": item.get("party_or_fraction") or item.get("party"),
                        "canton_or_municipality": item.get("canton_or_municipality") or item.get("canton"),
                        "provenance": normalize_provenance(item.get("provenance"))
                    }
                    cleaned_authors.append(author_dict)
    raw_dict["authors"] = cleaned_authors

    # 5. Clean questions_and_answers
    qa_list = raw_dict.get("questions_and_answers")
    cleaned_qa = []
    if isinstance(qa_list, list):
        for item in qa_list:
            if isinstance(item, str) and item.strip():
                q_text = item.strip()
                num_match = re.match(r"^(?:Frage\s+|Question\s+|Domanda\s+)?(\d+[a-z]?)[.:)\s]", q_text, re.IGNORECASE)
                cleaned_qa.append({
                    "question": {
                        "number": num_match.group(1) if num_match else None,
                        "text": q_text,
                        "provenance": None
                    },
                    "answer": None
                })
            elif isinstance(item, dict):
                q_val = item.get("question")
                q_dict = None
                if isinstance(q_val, str) and q_val.strip():
                    q_text = q_val.strip()
                    num_match = re.match(r"^(?:Frage\s+|Question\s+|Domanda\s+)?(\d+[a-z]?)[.:)\s]", q_text, re.IGNORECASE)
                    q_dict = {
                        "number": num_match.group(1) if num_match else None,
                        "text": q_text,
                        "provenance": normalize_provenance(item.get("provenance") or item.get("question_provenance"))
                    }
                elif isinstance(q_val, dict):
                    q_dict = {
                        "number": str(q_val.get("number") or q_val.get("question_reference")) if (q_val.get("number") or q_val.get("question_reference")) is not None else None,
                        "text": str(q_val.get("text") or q_val.get("question_text") or "").strip(),
                        "provenance": normalize_provenance(q_val.get("provenance"))
                    }
                else:
                    # Flattened question inside QA pair (observed in Italian TI)
                    text = item.get("text") or item.get("question_text") or ""
                    if text:
                        num = item.get("number") or item.get("question_reference")
                        prov = normalize_provenance(item.get("provenance"))
                        q_dict = {
                            "number": str(num) if num is not None else None,
                            "text": str(text).strip(),
                            "provenance": prov
                        }

                if q_dict and q_dict["text"]:
                    ans_val = item.get("answer")
                    ans_dict = None
                    if isinstance(ans_val, str) and ans_val.strip():
                        ans_dict = {
                            "question_reference": q_dict.get("number"),
                            "text": ans_val.strip(),
                            "provenance": None
                        }
                    elif isinstance(ans_val, dict) and (ans_val.get("text") or ans_val.get("answer_text")):
                        ans_dict = {
                            "question_reference": str(ans_val.get("question_reference") or q_dict.get("number")) if (ans_val.get("question_reference") or q_dict.get("number")) is not None else None,
                            "text": str(ans_val.get("text") or ans_val.get("answer_text")).strip(),
                            "provenance": normalize_provenance(ans_val.get("provenance"))
                        }
                    cleaned_qa.append({
                        "question": q_dict,
                        "answer": ans_dict
                    })
    raw_dict["questions_and_answers"] = cleaned_qa

    # 6. Clean financial details
    fin_list = raw_dict.get("financial_details")
    cleaned_fin = []
    if isinstance(fin_list, list):
        for item in fin_list:
            if isinstance(item, dict) and item.get("purpose"):
                amt = item.get("amount_chf") or item.get("amount")
                if amt is not None:
                    try:
                        if isinstance(amt, str):
                            amt = float(re.sub(r"[^\d.]", "", amt))
                        else:
                            amt = float(amt)
                    except (ValueError, TypeError):
                        amt = None
                cleaned_fin.append({
                    "amount_chf": amt,
                    "purpose": str(item["purpose"]).strip(),
                    "credit_type": item.get("credit_type"),
                    "fiscal_year": int(item["fiscal_year"]) if isinstance(item.get("fiscal_year"), (int, str)) and str(item.get("fiscal_year")).isdigit() else None,
                    "provenance": normalize_provenance(item.get("provenance"))
                })
    raw_dict["financial_details"] = cleaned_fin

    # 7. Clean procedural events
    ev_list = raw_dict.get("procedural_events")
    cleaned_ev = []
    if isinstance(ev_list, list):
        for item in ev_list:
            if isinstance(item, dict) and (item.get("event_type") or item.get("decision")):
                cleaned_ev.append({
                    "date": item.get("date"),
                    "event_type": str(item.get("event_type") or "milestone").strip().lower(),
                    "decision": item.get("decision"),
                    "provenance": normalize_provenance(item.get("provenance"))
                })
    raw_dict["procedural_events"] = cleaned_ev

    # 8. Clean document-level provenances
    raw_dict["title_provenance"] = normalize_provenance(raw_dict.get("title_provenance"))
    raw_dict["rationale_provenance"] = normalize_provenance(raw_dict.get("rationale_provenance"))

    # 9. Enums normalization
    lvl = raw_dict.get("level")
    if isinstance(lvl, str):
        lvl_s = lvl.strip().lower()
        if "fed" in lvl_s or "nat" in lvl_s:
            raw_dict["level"] = "federal"
        elif "cant" in lvl_s:
            raw_dict["level"] = "cantonal"
        elif "mun" in lvl_s or "com" in lvl_s or "gem" in lvl_s:
            raw_dict["level"] = "municipal"
        else:
            raw_dict["level"] = "cantonal"
    else:
        raw_dict["level"] = "cantonal"

    aft = raw_dict.get("affair_type")
    if isinstance(aft, str):
        aft_s = aft.strip().lower()
        if "motion" in aft_s:
            raw_dict["affair_type"] = "motion"
        elif "postulat" in aft_s:
            raw_dict["affair_type"] = "postulate"
        elif "interpell" in aft_s:
            raw_dict["affair_type"] = "interpellation"
        elif "initiativ" in aft_s:
            raw_dict["affair_type"] = "initiative"
        elif "anfrag" in aft_s or "quest" in aft_s or "interrog" in aft_s:
            raw_dict["affair_type"] = "question"
        elif "petit" in aft_s:
            raw_dict["affair_type"] = "petition"
        elif "geschäft" in aft_s or "antrag" in aft_s or "vorlage" in aft_s or "gov" in aft_s:
            raw_dict["affair_type"] = "government_affair"
        else:
            valid_types = {"motion", "postulate", "interpellation", "question", "initiative", "government_affair", "petition", "other"}
            raw_dict["affair_type"] = aft_s if aft_s in valid_types else "other"
    else:
        raw_dict["affair_type"] = "question"

    lang = raw_dict.get("language")
    if isinstance(lang, str):
        lang_s = lang.strip().lower()[:2]
        raw_dict["language"] = lang_s if lang_s in {"de", "fr", "it", "rm", "en"} else "de"
    else:
        raw_dict["language"] = "de"

    cb = raw_dict.get("canton_or_body")
    if isinstance(cb, str):
        raw_dict["canton_or_body"] = cb.strip().upper()
    else:
        raw_dict["canton_or_body"] = "CHE"

    if not raw_dict.get("title"):
        raw_dict["title"] = "Untitled Parliamentary Affair"

    return raw_dict


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

    raw_dict = normalize_extracted_dict(raw_dict)

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
