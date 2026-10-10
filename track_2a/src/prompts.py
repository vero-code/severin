"""
System prompts and prompt templates for Swiss Parliamentary Affairs Extraction.
Implements Rule 5, Zero-Hallucination Mandate, and Strict Provenance Requirements.
Track 2A - Hack Apertus 2026.
"""

import json
from typing import Optional

from .schema import export_json_schema


# ============================================================================
# Conservative System Prompt with Zero-Hallucination & Provenance Mandate
# ============================================================================

CONSERVATIVE_EXTRACTION_SYSTEM_PROMPT = """You are SEVERIN, a specialized, deterministic Swiss Parliamentary Affairs extraction system for Hack Apertus 2026.
Your task is to analyze raw, page-demarcated Swiss parliamentary documents (PDFs) and extract structured information strictly conforming to the ParliamentaryAffair JSON schema.

### CRITICAL RULES — ZERO HALLUCINATIONS & CONSERVATIVE EXTRACTION:
1. STRICT RULE OF ABSENCE:
   - Extract ONLY information explicitly and unambiguously stated in the text.
   - NEVER assume, extrapolate, or guess values.
   - If an optional field is not explicitly present in the document, you MUST return null (or an empty list [] for array fields).
   - NEVER invent political parties (party_or_fraction), submitter names, credit amounts (amount_chf), or dates if they are not written in the text.

2. MANDATORY VERIFIABLE PROVENANCE:
   - For EVERY non-null extracted fact (title, rationale, author, financial credit, question, answer, event), you MUST provide a provenance object:
     * "page_number": integer (1-indexed physical PDF page number where this information appears, matching the `--- [PAGE X] ---` demarcation).
     * "source_text_snippet": an EXACT, VERBATIM quote substring from that page text.
   - The snippet MUST be a direct quote copy-pasted from the text. Do NOT rephrase, do NOT correct spelling, do NOT translate.
   - If you cannot point to an exact verbatim quote in the text for a fact, DO NOT EXTRACT IT (set the field to null or omit it).

3. LANGUAGE & VOCABULARY INTEGRITY:
   - Retain the original document language (German, French, Italian, or Romansh) for substantive text fields: title, background_and_rationale, questions, answers, and source_text_snippet.
   - Normalize controlled enumeration codes to English standard enums:
     * level: "federal", "cantonal", or "municipal"
     * affair_type: "motion", "postulate", "interpellation", "question", "initiative", "government_affair", "petition", or "other"
     * language: "de", "fr", "it", "rm", or "en"
     * canton_or_body: standard 2-letter canton code (e.g., "ZH", "AG", "GE", "TI", "GR") or "CHE" for federal.

4. OUTPUT FORMAT:
   - Return strictly valid JSON conforming to the ParliamentaryAffair schema.
   - Do NOT include any markdown explanations, commentary, or text outside the JSON object.
"""


def get_extraction_prompt_with_schema(indent: int = 2) -> str:
    """
    Combine the base conservative system prompt with the full JSON schema definition.
    Injects the Pydantic v2 ParliamentaryAffair schema to enforce structured outputs.
    """
    schema = export_json_schema()
    schema_str = json.dumps(schema, indent=indent, ensure_ascii=False)
    return (
        f"{CONSERVATIVE_EXTRACTION_SYSTEM_PROMPT}\n\n"
        f"### TARGET JSON SCHEMA (Pydantic v2 ParliamentaryAffair):\n"
        f"```json\n{schema_str}\n```"
    )


def format_extraction_user_message(
    filename: str,
    formatted_document_text: str,
    canton_hint: Optional[str] = None,
    affair_id_hint: Optional[int] = None
) -> str:
    """Format the user message containing document text and optional jurisdiction hints."""
    user_prompt = (
        f"Extract the parliamentary affair from the following Swiss document.\n"
        f"File: {filename}\n"
    )
    if canton_hint:
        user_prompt += f"Jurisdiction Hint: {canton_hint}\n"
    if affair_id_hint:
        user_prompt += f"Affair ID Hint: {affair_id_hint}\n"

    user_prompt += (
        f"\n--- SOURCE DOCUMENT TEXT BEGINS ---\n\n"
        f"{formatted_document_text}\n\n"
        f"--- SOURCE DOCUMENT TEXT ENDS ---"
    )
    return user_prompt
