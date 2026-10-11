# SEVERIN — Swiss Parliamentary Affairs Extraction Platform
> **Hack Apertus 2026 • Track 2A: OpenParlData Challenge**  
> *Extracting Swiss Parliamentary Affairs from Heterogeneous PDFs into One Common Structure with Verifiable Provenance*

[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![Apertus 1.5-8B](https://img.shields.io/badge/Model-Apertus--1.5--8B-red.svg)](https://huggingface.co/swiss-ai/Apertus-v1.5-8B)
[![CSCS Alps](https://img.shields.io/badge/Hardware-NVIDIA_GH200_Alps-green.svg)](https://www.cscs.ch/)
[![Pydantic v2](https://img.shields.io/badge/Pydantic-v2-e92063.svg)](https://docs.pydantic.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/Frontend-React_19_TS-61dafb.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED.svg)](https://www.docker.com/)

---

## 🇨🇭 Overview

Switzerland's three-tier federal democracy (Federal Assembly, 26 Cantonal Parliaments, and hundreds of Municipal Councils) produces ~300,000 parliamentary affairs across four national languages (DE, FR, IT, RM). While [OpenParlData](https://openparldata.ch) indexes high-level titles and metadata, the critical substance — **exact questions, government rationale, financial credit appropriations, and decisions** — remains trapped inside heterogeneous, often scanned PDF documents.

**SEVERIN** provides an end-to-end, production-grade extraction and verification system:
1. **Unified Semantic Model**: A Pydantic v2 schema (`ParliamentaryAffair`) acting as a domain-specific middle-layer (comparable to JATS for scientific papers), mapped to *Popolo* and *Akoma Ntoso*.
2. **Zero-Hallucination Apertus Pipeline**: Conservative extraction using the sovereign Swiss model **`swiss-ai/Apertus-v1.5-8B`** hosted on the **CSCS Alps supercomputer** (NVIDIA GH200) with strictly locked `temperature=0.0`.
3. **Algorithmic Provenance Verification**: Every extracted fact includes physical PDF page numbers and exact quotes, mathematically grounded to character offsets (`char_start`, `char_end`) to guarantee zero hallucinations.
4. **Interactive Full-Stack Platform**: A dual-action React 19 UI with embedded PDF viewer, raw page text, extracted visual cards, and live CSCS micro-CHF cost telemetry.

---

## 🚀 Quickstart (Jury Entrypoint)

SEVERIN runs turn-key on any clean machine via Docker with a single command from the project root:

```bash
# Optional: provide CSCS API key for live Alps GH200 inference
# (If omitted, automatically executes in 100% offline dry-run mode)
export CSCS_INFERENCE_API_KEY="your_cscs_key_here"

# Start the full pipeline (builds multi-stage container & runs benchmark)
make run
```

Once started:
1. The container executes the automated cross-cantonal benchmark.
2. The interactive web platform is available at **[http://localhost:8000](http://localhost:8000)**.
3. Stop the container anytime with `make clean` (or `Ctrl+C`).

---

## 📖 API Documentation (Swagger & OpenAPI)

When the SEVERIN platform is running, interactive OpenAPI/Swagger documentation is served directly by FastAPI:

| Documentation Interface | URL | Description |
|---|---|---|
| **Interactive Swagger UI** | **[http://localhost:8000/docs](http://localhost:8000/docs)** | Test endpoints directly in browser with schema validation & try-it-out |
| **ReDoc Specification** | **[http://localhost:8000/redoc](http://localhost:8000/redoc)** | Clean, hierarchical technical API documentation |
| **OpenAPI 3.1 Schema** | **[http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)** | Machine-readable OpenAPI 3.1 JSON schema |
| **Unified Pydantic Model** | **[http://localhost:8000/api/schema](http://localhost:8000/api/schema)** | Exported JSON Schema for the unified `ParliamentaryAffair` model |

### Key API Endpoints

- `POST /api/extract` — Conservative extraction using Swiss-AI Apertus 1.5-8B on CSCS Alps GH200 with mathematical provenance verification against source PDF.
- `GET /api/sample-pdfs` — List 27 curated nationwide Swiss cantonal sample PDFs from manifest.
- `GET /api/bodies` — List indexed Swiss parliamentary bodies (cantons, federal assembly, cities).
- `GET /api/affairs` — Search OpenParlData parliamentary affairs with filters and pagination.
- `GET /api/affairs/{affair_id}` — Retrieve full detail and document attachments for a single parliamentary affair.
- `GET /api/parse-pdf?url=...` — Download remote PDF and return page-by-page text with physical page offsets.
- `GET /api/pdf-proxy?url=...` — Stream remote PDF to bypass browser iframe CORS restrictions.
- `GET /api/telemetry` — Live cumulative CSCS inference telemetry (prompt/completion tokens, cache hit rates, micro-CHF cost counters).
- `GET /api/health` — Service health check.

---

## 📊 Cross-Cantonal Benchmark Results (CSCS Alps GH200)

Evaluated across all Swiss linguistic regions on real-world cantonal and federal PDFs:

| Jurisdiction | Linguistic Region | Document Type | Provenance Match | Verified Citations | Latency | Tokens | Cost (CHF) |
|---|---|---|---|---|---|---|---|
| **CHE** | Federal / National (DE) | `initiative` | **92.9%** | 13/14 | 10.1s | 6,944 | `0.000115` |
| **ZH** | Zürich / Deutschschweiz (DE) | `postulate` | **100.0%** | 3/3 | 3.2s | 5,353 | `0.000027` |
| **GE** | Genève / Suisse romande (FR) | `question` | **100.0%** | 2/2 | 7.7s | 6,473 | `0.000060` |
| **TI** | Ticino / Svizzera italiana (IT) | `interpellation` | **100.0%** | 5/5 | 3.0s | 5,051 | `0.000023` |
| **GR** | Graubünden / Trilingual (DE/IT/RM) | `question` | **100.0%** | 3/3 | 6.0s | 5,820 | `0.000046` |

- **Average Verifiable Provenance Match**: **98.6%** (mathematically verified verbatim against physical pages)
- **Average Round-Trip Latency**: **6.0s**
- **Economic Feasibility**: **~0.00005 CHF per affair** (Alps GH200 PagedAttention prefix cache serves ~4,200 prompt tokens for free, projecting to **<20 CHF** for the entire 300,000 OpenParlData corpus).

### 📂 Dataset Structure & Runtime Artifacts

The repository bundles all necessary data offline under `track_2a/data/` (**19.78 MB**, well below the competition's 100 MB ceiling):

- **`data/sample_pdfs/` (19.4 MB)**: **27 curated nationwide PDF samples** covering all 26 Swiss cantons plus the Federal Assembly (`CHE`) across all 4 national languages (DE, FR, IT, RM). These documents are bundled offline so no external downloads are required during evaluation. All 27 documents are interactively browsable and extractable in the web UI.
- **`data/benchmark_cache/` (<1 MB)**: Authentic model extraction responses for the 5 core cross-cantonal targets (CHE, ZH, GE, TI, GR). These JSON files enable transparent **offline dry-run verification** on machines without CSCS API access.
- **Runtime Benchmark Outputs (`make run`)**:
  When `make run` executes with a valid `CSCS_INFERENCE_API_KEY`, it dispatches 5 live requests to the CSCS Alps GH200 supercomputer and persists the latest evaluation metrics directly to `track_2a/data/`:
  - `data/benchmark_results.json`: Detailed machine-readable metrics (latency, token counts, exact citation matches).
  - `data/benchmark_summary.md`: Auto-generated summary table with verification percentages.
  - `data/telemetry.json`: Persistent audit log of CSCS inference requests and micro-CHF expenditure.
  - `data/benchmark_cache/*.pdf.json`: Fresh model completion cache updated with the latest inference run.

---

## 🏗️ Core Architecture & Pipeline Components

```
severin/
├── Makefile                          # Root dispatcher forwarding commands to track_2a
├── track_2a/                         # Official Hack Apertus Track 2A workspace
│   ├── Dockerfile                    # Multi-stage container (Node 20 build + Python 3.11 runtime)
│   ├── docker-compose.yml            # Service orchestration with CSCS env mapping
│   ├── Makefile                      # Track-level execution targets (run, clean, test, benchmark)
│   ├── technical_report.md           # Official evaluation report for Track 2A jury
│   ├── src/
│   │   ├── schema.py                 # Pydantic v2 ParliamentaryAffair & Provenance models
│   │   ├── enums.py                  # Controlled vocabularies (AffairType, Levels, Statuses)
│   │   ├── prompts.py                # Conservative system prompt with Strict Rule of Absence
│   │   ├── extractor.py              # Apertus extractor + verify_provenance() grounding engine
│   │   ├── pdf_parser.py             # Page-level PDF text extractor with character offset indexing
│   │   ├── cscs_client.py            # OpenAI-compatible CSCS client (temperature=0.0, live telemetry)
│   │   ├── api_client.py             # OpenParlData REST API client
│   │   ├── benchmark.py              # Automated cross-cantonal evaluation pipeline
│   │   └── server.py                 # FastAPI backend mounting compiled React 19 SPA
│   ├── frontend/                     # Modern React 19 + TypeScript SPA Explorer
│   ├── data/
│   │   ├── sample_pdfs/              # 27 curated nationwide PDF samples (all 26 cantons + CHE, ~19.8 MB)
│   │   └── benchmark_cache/          # Authentic model extractions for offline dry-run verification
│   └── tests/                        # Automated unit tests for schema, parser, and extractor
```

---

## 💻 Local Development (Without Docker)

```bash
# 1. Setup Python virtual environment
cd track_2a
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. Run automated test suite
python tests/test_schema.py
python tests/test_extractor.py

# 3. Run cross-cantonal benchmark
python src/benchmark.py --dry-run   # Zero-network offline validation
python src/benchmark.py --mode live # Live CSCS Alps inference (requires CSCS_INFERENCE_API_KEY)

# 4. Launch development server
uvicorn src.server:app --port 8000 --reload
```

---

## ⚖️ Hackathon Compliance & Integrity

- **Target LLM**: Strictly `swiss-ai/Apertus-v1.5-8B` via CSCS Alps endpoint `https://api.inference.cscs.ch/v1` (Rule 5).
- **Zero Hallucination Mandate**: Inference temperature locked to `temperature=0.0`; all fields require physical page and verbatim quotation provenance.
- **Scientific Honesty**: Strict prohibition of deceptive fallbacks; offline dry-run mode explicitly labeled (`Mode: OFFLINE DRY-RUN`).
- **Data Size Limit**: `track_2a/data/` measures **19.78 MB**, well below the competition's 100 MB hard ceiling.
- **License**: Creative Commons Attribution 4.0 International (**CC-BY 4.0**).
