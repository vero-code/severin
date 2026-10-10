# SEVERIN — Swiss Parliamentary Affairs Extraction Platform
> **Hack Apertus 2026 • Track 2A: OpenParlData Challenge**  
> *Harmonizing Swiss Parliamentary Affairs from PDFs into One Unified Representation Model with Conservative Provenance*

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Pydantic v2](https://img.shields.io/badge/Pydantic-v2-e92063.svg)](https://docs.pydantic.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18_TS-61dafb.svg)](https://react.dev/)
[![Coverage](https://img.shields.io/badge/Swiss_Cantons-26%2F26_%2B_CHE-red.svg)](https://openparldata.ch/)

---

## 🇨🇭 Overview

Switzerland features a unique three-tier federal democracy: the **Federal Assembly**, **26 Cantonal Parliaments**, and hundreds of **Municipal Councils**, conducting parliamentary business in German, French, Italian, and Romansh.

While open data APIs like [OpenParlData](https://openparldata.ch) index high-level metadata (titles, dates, submitter IDs), the critical substantive information — **the exact parliamentary questions, executive justifications, financial appropriations (credits), and voting decisions** — remains locked inside heterogeneous, often scanned PDF documents.

**SEVERIN** provides an end-to-end open-source pipeline to:
1. Define a **Unified Representation Schema** with mandatory, verifiable **provenance** (physical page numbers and exact quote text spans).
2. Extract rich semantic structures using the Swiss sovereign foundation model **`swiss-ai/Apertus-v1.5-8B`** via CSCS Inference API with `temperature=0.0` (zero hallucinations).
3. Explore live parliamentary affairs with side-by-side original PDF document inspection.

---

## 📦 Project Structure & Completed Milestones

```
severin/
├── track_2a/                          # Main competition track directory
│   ├── src/
│   │   ├── schema.py                  # Pydantic v2 canonical schema + strict Provenance model
│   │   ├── enums.py                   # Controlled vocabularies (AffairType, Levels, Statuses)
│   │   ├── api_client.py              # Production-grade OpenParlData REST API client
│   │   ├── adapter.py                 # Multi-level, trilingual API-to-Schema transformer
│   │   ├── dataset.py                 # Curated dataset downloader with 100 MB limit guard
│   │   ├── pdf_parser.py              # Page-level PDF text extractor with offset tracking
│   │   ├── cscs_client.py             # CSCS Apertus-v1.5-8B client (Rule 5, temperature=0.0)
│   │   └── server.py                  # FastAPI backend with /api/schema and PDF proxy
│   ├── tests/
│   │   ├── test_schema.py             # Unit tests for schema validation & anti-hallucination
│   │   ├── test_adapter.py            # Unit & live integration tests for API adapter
│   │   ├── test_dataset.py            # Automated test enforcing the 100 MB directory limit
│   │   ├── test_pdf_parser.py         # Tests for page extraction and snippet search
│   │   └── test_cscs_client.py        # CSCS connection and Rule 5 compliance test
│   ├── data/sample_pdfs/              # Curated nationwide dataset (27 PDFs, ~19.7 MB)
│   │   └── manifest.json              # Traceable metadata manifest for all samples
│   ├── frontend/                      # Vite + React + TypeScript SPA Explorer
│   ├── technical_report.md            # Official evaluation write-up for judges
│   ├── Makefile                       # Execution target for jury evaluation
│   ├── requirements.txt               # Dependencies
│   └── .env.example                   # Environment variables template for API keys
└── README.md                          # Project documentation
```

### 1. Unified Representation Schema (`track_2a/src/schema.py`)
- Standardized, documented **`ParliamentaryAffair`** model.
- **Strict Provenance First**: every field contains a `Provenance` block specifying physical PDF `page_number`, exact verbatim quote (`source_text_snippet`), character offsets, and extraction status (`extracted`, `inferred`, `not_found`).
- Anti-hallucination constraints: `extra="forbid"`, non-negative credits (`amount_chf >= 0`), valid page boundaries (`page_number >= 1`).
- Standardized JSON Schema export for Apertus structured outputs.

### 2. API Client & Adapter (`track_2a/src/api_client.py`, `track_2a/src/adapter.py`)
- Seamless client for `https://api.openparldata.ch/v1` supporting all 4 search modes (`partial`, `exact`, `natural`, `boolean`).
- Robust multilingual handling (DE, FR, IT, RM) and normalization across disparate cantonal conventions.

### 3. Full Nationwide Dataset (`track_2a/data/sample_pdfs/`)
- **27 curated real-world PDF documents** representing **all 26 Swiss cantons plus the Confederation (CHE)**.
- Total size: **19.74 MB** — strictly respecting the hackathon's **100 MB** hard limit.
- Verified and traceable via `manifest.json`.

### 4. Page-Level PDF Parser (`track_2a/src/pdf_parser.py`)
- Extracts text page-by-page preserving 1-indexed physical PDF page numbers.
- Injects LLM boundary markers (`--- [PAGE X] ---`) and calculates character offsets for highlightable evidence.

### 5. Deterministic CSCS Inference Client (`track_2a/src/cscs_client.py`)
- Direct integration with `https://api.inference.cscs.ch/v1` serving `swiss-ai/Apertus-v1.5-8B`.
- Strictly locks `temperature=0.0` for reproducible, hallucination-free output (Rule 5).
- Client-side token and latency telemetry tracking.

### 6. Live Full-Stack Workbench (`track_2a/src/server.py`, `track_2a/frontend/`)
- **FastAPI Backend**: live OpenAPI/Swagger specification at `/docs`, unified schema at `/api/schema`, and CORS/streaming PDF proxy.
- **React-TS SPA**: clean split-screen viewer displaying affairs, embedded original Swiss PDFs, and extracted page text side-by-side.

---

## ⚡ Quickstart

### 1. Clone & Setup Python Environment
```bash
cd track_2a
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run Verification Tests
```bash
python tests/test_schema.py
python tests/test_adapter.py
python tests/test_dataset.py
python tests/test_pdf_parser.py
python tests/test_cscs_client.py
```

### 3. Launch the Backend & Interactive UI
```bash
# Terminal 1: FastAPI Server
uvicorn src.server:app --port 8000 --reload

# Terminal 2: React Frontend
cd frontend
npm install
npm run dev
# Open http://localhost:5173 in your browser
```

### 4. API Key Configuration & Jury Evaluation
During evaluation, the jury will clone the repository onto a clean environment and provide their own CSCS Inference API key via an environment variable:

```bash
export CSCS_INFERENCE_API_KEY="jury_cscs_api_key_here"
make run
```

Our **`CSCSInferenceClient`** seamlessly accommodates both workflows:
1. **Jury Evaluation (Automated)**: Reads `CSCS_INFERENCE_API_KEY` directly from OS / container environment variables.
2. **Local Development**: Automatically loads keys from local `track_2a/.env` (safely ignored by Git via `.gitignore`). A template is provided in `track_2a/.env.example`.

---

## ⚖️ Hackathon Compliance
- **Track**: Track 2A (OpenParlData Challenge)
- **Target LLM**: `swiss-ai/Apertus-v1.5-8B` (via CSCS Inference API, `temperature=0.0`)
- **Reproducibility**: Reproducible run target via `make run`
- **Data limit**: `track_2a/data/` is strictly constrained under 100 MB (current size: 19.74 MB)
