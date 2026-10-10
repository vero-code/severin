"""
Unified Representation Schema for Swiss Parliamentary Affairs.
Compliant with Pydantic v2 and OpenAPI 3.1.
Enforces strict provenance attribution for conservative, hallucination-free extraction.
Track 2A - Hack Apertus 2026.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

from .enums import ExtractionStatus, ParliamentLevel, AffairType, LanguageCode


class Provenance(BaseModel):
    """
    Source traceability reference pointing to exact document locations.
    Guarantees conservative extraction and allows fast human review.
    """
    model_config = ConfigDict(extra="forbid")

    page_number: int = Field(
        ...,
        description="1-indexed physical PDF page number where this information appears.",
        ge=1
    )
    source_text_snippet: str = Field(
        ...,
        description="Exact quote or text span extracted from the source PDF.",
        min_length=1
    )
    char_start: Optional[int] = Field(
        default=None,
        description="Character start offset within the page text.",
        ge=0
    )
    char_end: Optional[int] = Field(
        default=None,
        description="Character end offset within the page text.",
        ge=0
    )
    status: ExtractionStatus = Field(
        default=ExtractionStatus.EXTRACTED,
        description="Reliability status of this extracted piece of information."
    )


class Actor(BaseModel):
    """A person, parliamentary group, or government body involved in the affair."""
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., description="Full name or designated title of the actor.")
    role: str = Field(
        default="author",
        description="Role in this affair: author, co-signatory, spokesperson, addressed_body."
    )
    party_or_fraction: Optional[str] = Field(
        default=None,
        description="Political party or parliamentary fraction (e.g., FDP, SP, SVP, Die Mitte, Grüne)."
    )
    canton_or_municipality: Optional[str] = Field(
        default=None,
        description="Originating canton or municipality key (e.g. ZH, GR, GE, Bern-City)."
    )
    provenance: Optional[Provenance] = Field(
        default=None,
        description="Provenance of the actor's attribution in the document."
    )


class FinancialDetail(BaseModel):
    """Financial credits, expenditures, or budget appropriations requested or approved."""
    model_config = ConfigDict(extra="forbid")

    amount_chf: Optional[float] = Field(
        default=None,
        description="Monetary amount in Swiss Francs (CHF).",
        ge=0
    )
    purpose: str = Field(
        ...,
        description="Description of the requested credit, investment, or budget item."
    )
    credit_type: Optional[str] = Field(
        default=None,
        description="Type of credit: Verpflichtungskredit, Zusatzkredit, Rahmenkredit, etc."
    )
    fiscal_year: Optional[int] = Field(
        default=None,
        description="Relevant fiscal or budget year.",
        ge=1848,
        le=2100
    )
    provenance: Optional[Provenance] = Field(
        default=None,
        description="Provenance of the financial figure in the document."
    )


class QuestionItem(BaseModel):
    """An individual question or demand raised by the parliamentary submitter(s)."""
    model_config = ConfigDict(extra="forbid")

    number: Optional[str] = Field(
        default=None,
        description="Question number or bullet index (e.g., '1', '2a', 'Frage 1')."
    )
    text: str = Field(
        ...,
        description="Text of the specific question or demand."
    )
    provenance: Optional[Provenance] = Field(
        default=None,
        description="Provenance for this question text."
    )


class AnswerItem(BaseModel):
    """The executive's response to an individual question or the overall affair."""
    model_config = ConfigDict(extra="forbid")

    question_reference: Optional[str] = Field(
        default=None,
        description="Matching question number or index that this response answers."
    )
    text: str = Field(
        ...,
        description="Substantive answer, reasoning, or legal opinion provided by the executive."
    )
    provenance: Optional[Provenance] = Field(
        default=None,
        description="Provenance for this answer text."
    )


class QuestionAnswerPair(BaseModel):
    """Pairing an inquiry question with its corresponding governmental response."""
    model_config = ConfigDict(extra="forbid")

    question: QuestionItem = Field(..., description="The parliamentarian's question.")
    answer: Optional[AnswerItem] = Field(
        default=None,
        description="The government's answer if present in the document."
    )


class ProceduralEvent(BaseModel):
    """A formal parliamentary event or milestone in the lifecycle of the affair."""
    model_config = ConfigDict(extra="forbid")

    date: Optional[str] = Field(
        default=None,
        description="ISO date YYYY-MM-DD of the event."
    )
    event_type: str = Field(
        ...,
        description="Classification: submission, executive_response, committee_deliberation, plenary_vote, closed."
    )
    decision: Optional[str] = Field(
        default=None,
        description="Outcome or vote result: angenommen, überwiesen, abgelehnt, erledigt, abgeschrieben."
    )
    provenance: Optional[Provenance] = Field(
        default=None,
        description="Provenance for the event details."
    )


class ParliamentaryAffair(BaseModel):
    """
    Unified, harmonized representation of a Swiss parliamentary affair.
    Spans Federal, Cantonal, and Municipal levels across DE, FR, IT, RM.
    """
    model_config = ConfigDict(extra="forbid")

    affair_id: Optional[int] = Field(
        default=None,
        description="Internal OpenParlData affair ID if available."
    )
    short_id: Optional[str] = Field(
        default=None,
        description="Official parliament registration number (e.g. '24.3012', 'Motion 12/2026', 'Interpellation 45')."
    )
    title: str = Field(
        ...,
        description="Official title or subject of the parliamentary affair."
    )
    canton_or_body: str = Field(
        ...,
        description="Code of the parliamentary body (e.g. 'CHE', 'ZH', 'GR', 'GE', 'Bern-City')."
    )
    level: ParliamentLevel = Field(
        ...,
        description="Governance level: federal, cantonal, or municipal."
    )
    affair_type: AffairType = Field(
        ...,
        description="Harmonized affair classification (motion, postulate, interpellation, question, etc.)."
    )
    language: LanguageCode = Field(
        default=LanguageCode.DE,
        description="Primary language of the document (de, fr, it, rm, en)."
    )
    submission_date: Optional[str] = Field(
        default=None,
        description="ISO date YYYY-MM-DD when the affair was formally submitted."
    )

    # Actors
    authors: List[Actor] = Field(
        default_factory=list,
        description="List of primary authors and co-signatories."
    )
    addressed_to: Optional[str] = Field(
        default=None,
        description="Addressed executive body (e.g. 'Regierungsrat', 'Conseil d'Etat', 'Bundesrat')."
    )

    # Core Semantic Contents
    background_and_rationale: Optional[str] = Field(
        default=None,
        description="Context, problem statement, or explanatory reasoning provided by the author."
    )
    questions_and_answers: List[QuestionAnswerPair] = Field(
        default_factory=list,
        description="Structured list of specific questions and their executive answers."
    )

    # Financial & Procedural
    financial_details: List[FinancialDetail] = Field(
        default_factory=list,
        description="Financial appropriations, requested credits, or costs cited in the document."
    )
    procedural_events: List[ProceduralEvent] = Field(
        default_factory=list,
        description="Chronological milestones and voting outcomes."
    )

    # Document-Level Provenance
    title_provenance: Optional[Provenance] = Field(
        default=None,
        description="Provenance of the affair title."
    )
    rationale_provenance: Optional[Provenance] = Field(
        default=None,
        description="Provenance of the rationale/background statement."
    )


def export_json_schema() -> Dict[str, Any]:
    """Export Pydantic schema as standard JSON Schema for Apertus LLM structured output."""
    return ParliamentaryAffair.model_json_schema()
