"""
Controlled vocabularies and enumerations for Swiss Parliamentary Affairs.
Track 2A - OpenParlData Challenge.
"""

from enum import Enum


# --- Parliamentary Domain Enums ---

class ExtractionStatus(str, Enum):
    """Reliability status of an extracted piece of data."""
    EXTRACTED = "extracted"       # Directly found in text with exact quote
    INFERRED = "inferred"         # Synthesized/derived from context
    UNVERIFIED = "unverified"     # Found but could not verify exact span
    NOT_FOUND = "not_found"       # Explicitly absent in the source


class ParliamentLevel(str, Enum):
    """Three levels of Swiss governance."""
    FEDERAL = "federal"
    CANTONAL = "cantonal"
    MUNICIPAL = "municipal"


class AffairType(str, Enum):
    """
    Harmonized classification of parliamentary affair types across Switzerland.
    Matches standard classifications from OParl and Parla-CLARIN.
    """
    MOTION = "motion"
    POSTULATE = "postulate"
    INTERPELLATION = "interpellation"
    QUESTION = "question"                     # Anfrage / Einfache Anfrage / Question écrite / Interrogazione
    INITIATIVE = "initiative"                 # Parlamentarische Initiative / Volksinitiative
    GOVERNMENT_AFFAIR = "government_affair"   # Regierungsgeschäft / Vorlage / Antrag
    PETITION = "petition"
    OTHER = "other"


# --- OpenParlData API Client Enums ---

class SearchMode(str, Enum):
    """Supported OpenParlData search modes."""
    PARTIAL = "partial"
    EXACT = "exact"
    NATURAL = "natural"
    BOOLEAN = "boolean"


class LanguageCode(str, Enum):
    """Official Swiss parliamentary languages."""
    DE = "de"
    FR = "fr"
    IT = "it"
    RM = "rm"
    EN = "en"


class LangFormat(str, Enum):
    """API payload language format."""
    NESTED = "nested"
    FLAT = "flat"


class SearchScope(str, Enum):
    """Search target scopes."""
    METADATA = "metadata"
    DOCS = "docs"
    TEXTS = "texts"
    SPEECHES = "speeches"
    ALL = "all"
