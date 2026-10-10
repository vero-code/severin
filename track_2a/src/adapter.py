"""
OpenParlData API to Unified Schema Adapter.
Maps heterogeneous raw API dictionaries into standardized ParliamentaryAffair Pydantic models.
Track 2A - Hack Apertus 2026.
"""

from typing import Dict, Any, List, Optional
from .schema import ParliamentaryAffair, Actor
from .enums import ParliamentLevel, AffairType, LanguageCode


def extract_multilingual_text(val: Any) -> str:
    """
    Extract single plain text from raw string or multilingual dictionary {de: ..., fr: ...}.
    """
    if not val:
        return ""
    if isinstance(val, str):
        return val.strip()
    if isinstance(val, dict):
        # Priority order: DE -> FR -> IT -> RM -> EN -> first available
        for lang in ("de", "fr", "it", "rm", "en"):
            if lang in val and val[lang]:
                return str(val[lang]).strip()
        # Fallback to first non-empty value
        for v in val.values():
            if v:
                return str(v).strip()
    return str(val).strip()


def map_parliament_level(body_key: str) -> ParliamentLevel:
    """Determine federal, cantonal, or municipal level from body key."""
    if not body_key:
        return ParliamentLevel.CANTONAL
    key = body_key.upper()
    if key in ("CHE", "CH", "BUND"):
        return ParliamentLevel.FEDERAL
    # Common Swiss municipal body patterns
    if "-" in key or "CITY" in key or "STADT" in key or "COMMUNE" in key:
        return ParliamentLevel.MUNICIPAL
    return ParliamentLevel.CANTONAL


def map_affair_type(type_val: Any) -> AffairType:
    """Harmonize raw cantonal/federal affair types into controlled AffairType enum."""
    raw_str = extract_multilingual_text(type_val).lower()
    if not raw_str:
        return AffairType.OTHER

    if "motion" in raw_str:
        return AffairType.MOTION
    if "postulat" in raw_str:
        return AffairType.POSTULATE
    if "interpellation" in raw_str:
        return AffairType.INTERPELLATION
    if any(q in raw_str for q in ("anfrage", "question", "interrogazione")):
        return AffairType.QUESTION
    if "initiative" in raw_str:
        return AffairType.INITIATIVE
    if any(g in raw_str for g in ("vorlage", "antrag", "geschäft", "projet")):
        return AffairType.GOVERNMENT_AFFAIR
    if "petition" in raw_str:
        return AffairType.PETITION
    return AffairType.OTHER


def map_language_code(body_key: str, raw_lang: Optional[str] = None) -> LanguageCode:
    """Infer primary language from canton/body and document metadata."""
    if raw_lang:
        code = raw_lang.lower().strip()
        if code in ("de", "fr", "it", "rm", "en"):
            return LanguageCode(code)

    # Canton-based default language rules
    french_cantons = {"GE", "VD", "NE", "JU"}
    italian_cantons = {"TI"}
    key = body_key.upper() if body_key else "ZH"

    if key in french_cantons:
        return LanguageCode.FR
    if key in italian_cantons:
        return LanguageCode.IT
    return LanguageCode.DE


def map_api_to_affair(raw: Dict[str, Any]) -> ParliamentaryAffair:
    """
    Transform raw OpenParlData affair dictionary into standardized ParliamentaryAffair.
    """
    body_key = raw.get("body_key", "CHE")
    title = extract_multilingual_text(raw.get("title")) or f"Affair #{raw.get('id')}"
    raw_type = raw.get("type") or raw.get("affair_type")
    affair_type = map_affair_type(raw_type)
    level = map_parliament_level(body_key)
    language = map_language_code(body_key, raw.get("lang"))

    # Map contributors into actors
    authors: List[Actor] = []
    contributors = raw.get("contributors") or []
    if isinstance(contributors, dict) and "data" in contributors:
        contributors = contributors["data"]

    if isinstance(contributors, list):
        for c in contributors:
            if isinstance(c, dict):
                name = extract_multilingual_text(c.get("name") or c.get("person_name"))
                if name:
                    authors.append(
                        Actor(
                            name=name,
                            role=c.get("type") or c.get("role") or "author",
                            party_or_fraction=c.get("party"),
                            canton_or_municipality=body_key,
                        )
                    )

    # Date formatting (extract YYYY-MM-DD from ISO timestamp)
    submission_date = None
    begin_date = raw.get("begin_date")
    if begin_date and isinstance(begin_date, str) and len(begin_date) >= 10:
        submission_date = begin_date[:10]

    return ParliamentaryAffair(
        affair_id=raw.get("id"),
        short_id=raw.get("short_id") or f"#{raw.get('id')}",
        title=title,
        canton_or_body=body_key,
        level=level,
        affair_type=affair_type,
        language=language,
        submission_date=submission_date,
        authors=authors,
    )
