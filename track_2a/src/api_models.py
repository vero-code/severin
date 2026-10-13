"""
API Request and Response Models for SEVERIN FastAPI Server.
OpenAPI / Swagger / ReDoc schemas for Track 2A - Hack Apertus 2026.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str = Field(default="ok", description="Server health status", examples=["ok"])
    app: str = Field(default="SEVERIN", description="Application name", examples=["SEVERIN"])
    version: str = Field(default="1.0.0", description="API version", examples=["1.0.0"])


class BodiesResponse(BaseModel):
    """Indexed Swiss parliamentary bodies response schema."""
    data: List[Dict[str, Any]] = Field(description="List of indexed parliamentary bodies")
    count: int = Field(description="Number of bodies returned")


class TelemetryHistoryItem(BaseModel):
    """Single CSCS inference call log."""
    timestamp: Optional[str] = Field(default=None, description="ISO timestamp of invocation")
    model: Optional[str] = Field(default="swiss-ai/Apertus-v1.5-8B", description="Model identifier")
    task: Optional[str] = Field(default=None, description="Task label (e.g. Smoke Test, Extract: ZH...)")
    canton: Optional[str] = Field(default=None, description="Canton or jurisdiction code")
    provenance_score: Optional[float] = Field(default=None, description="Verified provenance match score")
    prompt_tokens: int = Field(default=0, description="Input tokens")
    completion_tokens: int = Field(default=0, description="Output tokens")
    cached_tokens: Optional[int] = Field(default=0, description="Prefix cache hit tokens")
    total_tokens: int = Field(default=0, description="Sum of prompt and completion tokens")
    cost_chf: Optional[float] = Field(default=0.0, description="Incurred inference cost in CHF")
    latency_sec: float = Field(default=0.0, description="Latency in seconds")
    status: str = Field(default="success", description="Status string")


class TelemetryResponse(BaseModel):
    """CSCS Alps GH200 cumulative inference telemetry schema."""
    model: str = Field(default="swiss-ai/Apertus-v1.5-8B", description="Active model")
    endpoint: Optional[str] = Field(default=None, description="Inference endpoint URL")
    status: str = Field(default="online", description="Endpoint connection status")
    total_requests: int = Field(default=0, description="Total inference requests dispatched")
    total_prompt_tokens: int = Field(default=0, description="Cumulative prompt tokens")
    total_completion_tokens: int = Field(default=0, description="Cumulative completion tokens")
    total_cached_tokens: Optional[int] = Field(default=0, description="Cumulative tokens served from prefix cache")
    total_tokens: int = Field(default=0, description="Cumulative total tokens")
    total_cost_chf: float = Field(default=0.0, description="Cumulative inference cost in CHF")
    total_latency_seconds: Optional[float] = Field(default=0.0, description="Cumulative latency in seconds")
    average_latency_seconds: float = Field(default=0.0, description="Average request latency in seconds")
    last_request_at: Optional[str] = Field(default=None, description="Timestamp of most recent request")
    history: List[TelemetryHistoryItem] = Field(default_factory=list, description="Recent request invocation log")


class ParsePdfPage(BaseModel):
    """Single PDF page text extraction model."""
    page_number: int = Field(description="1-indexed physical page number")
    char_count: int = Field(description="Character count on this page")
    text: str = Field(description="Extracted raw page text")
    page: Optional[int] = Field(default=None, description="Optional alias for physical page number")

    def model_post_init(self, __context: Any) -> None:
        if self.page is None:
            self.page = self.page_number


class ParsePdfResponse(BaseModel):
    """PDF parsing response schema."""
    url: str = Field(description="Source PDF URL")
    total_pages: int = Field(description="Total pages in document")
    total_chars: int = Field(description="Total extracted characters")
    pages: List[ParsePdfPage] = Field(description="Page text breakdown")


class ProvenanceReport(BaseModel):
    """Mathematical provenance grounding verification report."""
    total_citations: int = Field(description="Total cited fact snippets")
    verified_citations: int = Field(description="Number of mathematically verified citations")
    failed_citations: int = Field(description="Number of unverified or hallucinated citations")
    provenance_score: float = Field(description="Ratio of verified to total citations (0.0 to 1.0)")
    details: List[Dict[str, Any]] = Field(description="Per-citation verification metadata with char offsets")


class ExtractRequest(BaseModel):
    """Document extraction request payload."""
    url: Optional[str] = Field(None, description="Remote OpenParlData PDF URL")
    sample_file: Optional[str] = Field(None, description="Local sample filename from data/sample_pdfs/")
    canton_hint: Optional[str] = Field(None, description="Optional canton key hint (e.g. CHE, ZH, GE)")
    affair_id_hint: Optional[int] = Field(None, description="Optional OpenParlData affair ID hint")


class ExtractResponse(BaseModel):
    """Document extraction output schema."""
    affair: Dict[str, Any] = Field(description="Extracted unified ParliamentaryAffair model")
    provenance_report: ProvenanceReport = Field(description="Grounding verification metrics")
    telemetry: TelemetryResponse = Field(description="Cumulative CSCS inference telemetry")


class SamplePdfItem(BaseModel):
    """Curated nationwide sample PDF metadata item."""
    file_name: str = Field(description="Local file name")
    affair_id: Optional[int] = Field(None, description="OpenParlData affair identifier")
    short_id: Optional[str] = Field(None, description="Official parliamentary short ID")
    title: Optional[Dict[str, str]] = Field(None, description="Multilingual title dict")
    body_key: str = Field(description="Canton or federal body key (e.g. CHE, ZH, GE)")
    level: Optional[str] = Field(None, description="Legislative tier (federal, cantonal, communal)")
    language: Optional[str] = Field(None, description="Document language")
    doc_id: Optional[int] = Field(None, description="Document identifier")
    doc_name: Optional[str] = Field(None, description="Document title/type")
    url: Optional[str] = Field(None, description="Remote source PDF URL")
    size_bytes: Optional[int] = Field(None, description="File size in bytes")
