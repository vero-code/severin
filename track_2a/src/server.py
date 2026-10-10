"""
FastAPI Server for SEVERIN Swiss Parliamentary Affairs Platform.
Provides API endpoints proxying OpenParlData and serving the extraction pipeline.
Track 2A - Hack Apertus 2026.
"""

import io
import logging
from typing import Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import requests

from .api_client import OpenParlDataClient
from .enums import SearchMode
from .schema import export_json_schema

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
