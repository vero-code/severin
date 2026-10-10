"""
FastAPI Server for SEVERIN Swiss Parliamentary Affairs Platform.
Provides API endpoints proxying OpenParlData and serving the extraction pipeline.
Track 2A - Hack Apertus 2026.
"""

import io
import logging
from typing import Optional
from pydantic import BaseModel
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import requests

from .api_client import OpenParlDataClient
from .enums import SearchMode
from .schema import export_json_schema
from .pdf_parser import extract_pdf_pages
from .cscs_client import CSCSInferenceClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("severin_server")

app = FastAPI(
    title="SEVERIN API",
    description="Swiss Parliamentary Affairs Extraction and Exploration Platform",
    version="1.0.0"
)

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenParlDataClient(timeout=30)


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "app": "SEVERIN", "version": "1.0.0"}


@app.get("/api/schema")
def get_unified_schema():
    """
    Return JSON Schema for ParliamentaryAffair representation model.
    Used for LLM structured output specification and schema inspection.
    """
    try:
        return export_json_schema()
    except Exception as e:
        logger.error(f"Error exporting schema: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bodies")
def list_bodies():
    """Get list of indexed Swiss parliamentary bodies (cantons, federal, cities)."""
    try:
        bodies = client.get_bodies(indexed_only=True)
        return {"data": bodies, "count": len(bodies)}
    except Exception as e:
        logger.error(f"Error fetching bodies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/affairs")
def search_affairs(
    body_key: Optional[str] = Query(None, description="Body key filter, e.g. CHE, ZH, GR, GE"),
    search: Optional[str] = Query(None, description="Search keyword"),
    search_mode: str = Query("partial", description="partial, exact, natural, boolean"),
    limit: int = Query(10, ge=1, le=50, description="Items limit"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    expand: str = Query("docs", description="Related entities to expand")
):
    """Query parliamentary affairs with filters and pagination."""
    try:
        result = client.get_affairs(
            body_key=body_key,
            search=search,
            search_mode=search_mode,
            limit=limit,
            offset=offset,
            expand=expand
        )
        return result
    except Exception as e:
        logger.error(f"Error querying affairs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/affairs/{affair_id}")
def get_affair(affair_id: int):
    """Retrieve full detail for a single parliamentary affair."""
    try:
        data = client.get_affair_by_id(affair_id=affair_id)
        return data
    except Exception as e:
        logger.error(f"Error fetching affair {affair_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pdf-proxy")
def proxy_pdf(url: str = Query(..., description="OpenParlData PDF file URL")):
    """
    Proxy remote PDF to bypass browser iframe CORS / X-Frame-Options restrictions.
    """
    if not (url.startswith("https://") or url.startswith("http://")):
        raise HTTPException(status_code=400, detail="Invalid URL protocol")
    try:
        resp = requests.get(url, stream=True, timeout=30)
        resp.raise_for_status()
        return StreamingResponse(
            io.BytesIO(resp.content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'inline; filename="document.pdf"',
                "Content-Type": "application/pdf"
            }
        )
    except Exception as e:
        logger.error(f"Error proxying PDF from {url}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch PDF: {e}")


@app.get("/api/parse-pdf")
def parse_pdf(url: str = Query(..., description="OpenParlData PDF file URL")):
    """
    Download and parse PDF page-by-page returning text with physical page numbers.
    """
    if not (url.startswith("https://") or url.startswith("http://")):
        raise HTTPException(status_code=400, detail="Invalid URL protocol")
    try:
        resp = requests.get(url, stream=True, timeout=30)
        resp.raise_for_status()

        import tempfile
        from pathlib import Path
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(resp.content)
            tmp_path = Path(tmp.name)

        try:
            pages = extract_pdf_pages(tmp_path)
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

        total_chars = sum(p["char_count"] for p in pages)
        return {
            "url": url,
            "total_pages": len(pages),
            "total_chars": total_chars,
            "pages": pages
        }
    except Exception as e:
        logger.error(f"Error parsing PDF from {url}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to parse PDF: {e}")


@app.get("/api/telemetry")
def get_telemetry():
    """Retrieve cumulative LLM inference telemetry from CSCS (Rule 5 compliance)."""
    try:
        return CSCSInferenceClient.get_global_telemetry()
    except Exception as e:
        logger.error(f"Error reading telemetry: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ExtractRequest(BaseModel):
    url: Optional[str] = None
    sample_file: Optional[str] = None
    canton_hint: Optional[str] = None
    affair_id_hint: Optional[int] = None


@app.post("/api/extract")
def extract_document(req: ExtractRequest):
    """
    Execute conservative extraction using Swiss-AI Apertus 1.5-8B on CSCS Alps.
    Verifies citations and calculates strict provenance score against source PDF.
    """
    import tempfile
    from pathlib import Path
    from .extractor import extract_affair_from_pdf

    sample_dir = Path(__file__).resolve().parent.parent / "data" / "sample_pdfs"

    target_pdf: Optional[Path] = None
    temp_file: Optional[Path] = None

    try:
        if req.sample_file:
            candidate = sample_dir / req.sample_file
            if candidate.exists():
                target_pdf = candidate
            else:
                raise HTTPException(status_code=404, detail=f"Sample PDF not found: {req.sample_file}")
        elif req.url:
            if not (req.url.startswith("https://") or req.url.startswith("http://")):
                raise HTTPException(status_code=400, detail="Invalid PDF URL protocol")
            resp = requests.get(req.url, stream=True, timeout=45)
            resp.raise_for_status()
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(resp.content)
                temp_file = Path(tmp.name)
            target_pdf = temp_file
        else:
            raise HTTPException(status_code=400, detail="Must provide either 'url' or 'sample_file'")

        affair, report = extract_affair_from_pdf(
            pdf_path=target_pdf,
            canton_hint=req.canton_hint,
            affair_id_hint=req.affair_id_hint
        )

        return {
            "affair": affair.model_dump(),
            "provenance_report": report,
            "telemetry": CSCSInferenceClient.get_global_telemetry()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    finally:
        if temp_file and temp_file.exists():
            try:
                temp_file.unlink()
            except Exception:
                pass


@app.get("/api/sample-pdfs")
def list_sample_pdfs():
    """List curated nationwide Swiss cantonal sample PDFs from data/sample_pdfs/manifest.json."""
    from pathlib import Path
    import json
    manifest_path = Path(__file__).resolve().parent.parent / "data" / "sample_pdfs" / "manifest.json"
    if manifest_path.exists():
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading manifest: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    return []


