# SEVERIN — Swiss Parliamentary Affairs Extraction Platform
> **Hack Apertus 2026 • Track 2A: OpenParlData Challenge**  
> *Extracting Swiss Parliamentary Affairs from Heterogeneous PDFs into One Common Structure with Verifiable Provenance*  
> **Key Deliverables:** [Technical Report](track_2a/technical_report.md) • [Architecture](track_2a/docs/architecture.md) • [Data](track_2a/data/)

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![Apertus 1.5-8B](https://img.shields.io/badge/Model-Apertus--1.5--8B-red.svg)](https://huggingface.co/swiss-ai/Apertus-v1.5-8B)
[![CSCS Alps](https://img.shields.io/badge/Hardware-NVIDIA_GH200_Alps-green.svg)](https://www.cscs.ch/)
[![Pydantic v2](https://img.shields.io/badge/Pydantic-v2-e92063.svg)](https://docs.pydantic.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/Frontend-React_19_TS-61dafb.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED.svg)](https://www.docker.com/)

---

## Overview

Switzerland's parliamentary system (Federal Assembly, 26 Cantonal Parliaments, and Municipal Councils) produces ~300,000 parliamentary affairs across four national languages (DE, FR, IT, RM). While [OpenParlData](https://openparldata.ch) indexes titles and filing metadata, substantive details — **questions, government replies, financial credit amounts, and procedural decisions** — are contained within PDF documents.

**SEVERIN** is an extraction and verification pipeline built for Track 2A:
1. **Unified Semantic Model**: A Pydantic v2 schema (`ParliamentaryAffair`) serving as an intermediate layer (comparable to JATS for parliamentary affairs), mapped conceptually to *Popolo* and *Akoma Ntoso*.
2. **Conservative Extraction Pipeline**: Structured output using **`swiss-ai/Apertus-v1.5-8B`** on the **CSCS Alps supercomputer** (NVIDIA GH200) at `temperature=0.0` with the Rule of Absence (`null` for unstated entities). Automatically falls back to **Apertus Native Vision OCR** (via Pillow) when scanned or image-only PDFs (e.g. Canton Obwalden) are detected.
3. **Provenance Verification**: Anchors extracted fields to 1-indexed physical page numbers and verbatim quotes, calculating character offsets (`char_start`, `char_end`) against the source PDF.
4. **Web Interface**: React 19 single-page application with split-view PDF/text viewer, extracted affair data, citation verification indicators, and live CSCS token and cost telemetry.

---

## 🚀 Quickstart (Jury Reproducibility)

SEVERIN runs on any clean machine via Docker. The primary turnkey entrypoint for the jury is GNU Make:

```bash
# 1. Provide CSCS API key
# (If omitted, automatically runs in 100% offline dry-run mode)
export CSCS_INFERENCE_API_KEY="your_cscs_key_here"

# 2. Primary Entrypoint via GNU Make (from repository root):
make build      # Build Docker container image
make run        # Run benchmark & start web platform
make test       # Run all 6 automated test suites
make benchmark  # Run cross-cantonal benchmark (auto-detects key)
make dry-run    # Run 100% offline verification benchmark

# Alternative: Direct Docker Compose
cd track_2a
docker compose build
docker compose up
```

Once started:
1. The container executes the automated cross-cantonal benchmark.
2. The interactive web platform is available at **[http://localhost:8000](http://localhost:8000)**.
3. Stop the container anytime with `make clean` from root (or `docker compose down` from the track_2a folder).

---

## 📖 API Documentation

When the SEVERIN platform is running, interactive OpenAPI/Swagger documentation is served directly by FastAPI:

| Documentation Interface | URL | Description |
|---|---|---|
| **Interactive Swagger UI** | **[http://localhost:8000/docs](http://localhost:8000/docs)** | Test endpoints directly in browser with schema validation & try-it-out |
| **ReDoc Specification** | **[http://localhost:8000/redoc](http://localhost:8000/redoc)** | Clean, hierarchical technical API documentation |
| **OpenAPI 3.1 Schema** | **[http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)** | Machine-readable OpenAPI 3.1 JSON schema |
| **Unified Pydantic Model** | **[http://localhost:8000/api/schema](http://localhost:8000/api/schema)** | Exported JSON Schema for the unified `ParliamentaryAffair` model |

### Key API Endpoints

- `POST /api/extract` — Conservative extraction using Apertus 1.5-8B on CSCS Alps GH200 with page-anchored provenance verification (supports born-digital text PDFs and scanned raster PDFs via Vision OCR).
- `GET /api/schema` — Export JSON Schema for the unified `ParliamentaryAffair` Pydantic v2 model.
- `GET /api/sample-pdfs` — List 27 curated Swiss cantonal sample PDFs from manifest.
- `GET /api/bodies` — List indexed Swiss parliamentary bodies (cantons, federal assembly, cities).
- `GET /api/affairs` — Search OpenParlData parliamentary affairs with filters and pagination.
- `GET /api/affairs/{affair_id}` — Retrieve full detail and document attachments for a single parliamentary affair.
- `GET /api/parse-pdf?url=...` — Parse PDF page-by-page returning text with physical page offsets.
- `GET /api/pdf-proxy?url=...` — Stream PDF with inline disposition to avoid browser CORS restrictions.
- `GET /api/telemetry` — Cumulative CSCS inference telemetry (prompt/completion tokens, cache hit rates, cost counters).
- `GET /api/health` — Service health check.

---

## 📊 Cross-Cantonal Benchmark

Evaluated across all Swiss linguistic regions on real-world cantonal and federal PDFs:

| Jurisdiction | Linguistic Region | Document Type | Provenance Match | Verified Citations | Latency | Tokens | Cost (CHF) |
|---|---|---|---|---|---|---|---|
| **CHE** | Federal / National (DE) | `initiative` | **100.0%** | 3/3 | 6.01s | 6,422 | `0.000089` |
| **ZH** | Zürich / Deutschschweiz (DE) | `postulate` | **100.0%** | 3/3 | 3.52s | 5,594 | `0.000026` |
| **GE** | Genève / Suisse romande (FR) | `question` | **100.0%** | 3/3 | 6.61s | 6,498 | `0.000051` |
| **TI** | Ticino / Svizzera italiana (IT) | `interpellation` | **100.0%** | 4/4 | 3.16s | 5,282 | `0.000022` |
| **GR** | Graubünden / Trilingual (DE/IT/RM) | `question` | **100.0%** | 6/6 | 6.32s | 6,075 | `0.000046` |

- **Provenance Accuracy**: **100.0%** (19/19 citations verified verbatim on physical PDF pages across the 5 benchmark documents).
- **Average Latency**: **5.12s** (down to **3.16s** on warm cache calls).
- **Benchmark Cost**: **0.000234 CHF** across all 5 benchmark targets (~0.000047 CHF per document).
- **Prefix Caching**: CSCS Alps vLLM PagedAttention automatically caches 4,480 prompt tokens (billed at 0.00 CHF under CSCS Academia pricing).

### 📂 Dataset Structure

Data files are located under `track_2a/data/` (**19.8 MB** total, within the 100 MB limit):

- **`data/sample_pdfs/` (19.7 MB)**: 27 sample PDFs covering all 26 Swiss cantons and the Federal Assembly (`CHE`) across German, French, Italian, and Romansh (including born-digital text PDFs and pure raster scans like OW).
- **`data/ocr_cache/` (<1 MB)**: Pre-computed Apertus Native Vision OCR transcriptions for scanned documents (e.g., Canton Obwalden), enabling instant offline evaluation.
- **`data/benchmark_cache/` (<1 MB)**: Authentic model outputs for the 5 benchmark targets (CHE, ZH, GE, TI, GR), used for offline dry-run testing when no CSCS API key is present.
- **Benchmark Artifacts**:
  Generated by `make run` or `benchmark.py`:
  - `data/benchmark_results.json`: Machine-readable results (latency, tokens, citation matches).
  - `data/benchmark_summary.md`: Markdown summary table.
  - `data/telemetry.json`: Log of CSCS API requests, token counts, and cost.

---

## 🏗️ Core Architecture

For complete system design, sequence diagrams, and data flows, see:
- 📄 **[System Architecture Guide](track_2a/docs/architecture.md)** — Pipeline stages, schema mappings, and sequence diagrams.
- 🖼️ **[Architecture Vector Diagram](track_2a/docs/architecture.svg)** — High-resolution system flow and hardware layout.

```
severin/
├── Makefile                          # Root targets (run, build, clean)
├── track_2a/                         # Challenge workspace
│   ├── Dockerfile                    # Container definition
│   ├── docker-compose.yml            # Compose configuration
│   ├── Makefile                      # Track build & run targets
│   ├── technical_report.md           # Technical report for jury
│   ├── docs/                         # Architecture documentation
│   │   ├── architecture.md           # Technical architecture
│   │   └── architecture.svg          # Pipeline vector diagram
│   ├── src/                          # Extraction pipeline & FastAPI backend
│   ├── frontend/                     # React 19 + TypeScript SPA
│   ├── data/                         # Evaluation data (<20 MB)
│   │   ├── sample_pdfs/              # 27 cantonal & federal PDFs
│   │   ├── ocr_cache/                # Transcribed scan cache (OW)
│   │   ├── benchmark_cache/          # Offline dry-run cache
│   │   ├── benchmark_results.json    # Benchmark results
│   │   ├── benchmark_summary.md      # Benchmark summary
│   │   └── telemetry.json            # CSCS token & cost ledger
│   └── tests/                        # Automated unit tests
```

---

## 🛠️ Technology Stack

| Layer | Technologies | Role in SEVERIN |
|---|---|---|
| **AI Inference** | [Apertus 1.5-8B](https://huggingface.co/swiss-ai/Apertus-v1.5-8B) • [CSCS Alps](https://www.cscs.ch/) (GH200) | Deterministic extraction (`temp=0.0`), vLLM prefix caching |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) • Python 3.11+ | REST API, OpenAPI 3.1 & Swagger documentation |
| **Schema & Parsing** | [Pydantic v2](https://docs.pydantic.dev/) • [pypdf](https://pypdf.readthedocs.io/) • [Pillow](https://python-pillow.org/) | Strict schema (`extra="forbid"`), page-level provenance grounding, raster scan ingestion |
| **Frontend** | [React 19](https://react.dev/) • [TypeScript](https://www.typescriptlang.org/) • [Vite](https://vite.dev/) | 3-column studio SPA, PDF/Text viewer with citation highlights |
| **Styling** | Vanilla CSS3 | Minimalist design tokens, Inter & JetBrains Mono typography |
| **Data Source** | [OpenParlData](https://api.openparldata.ch) | Live API client for federal and cantonal parliamentary affairs |
| **DevOps** | [Docker](https://www.docker.com/) • GNU Make | Multi-stage container, one-click `make run` reproducibility |

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

## ⚖️ Compliance & Integrity

- **Model & Endpoint**: `swiss-ai/Apertus-v1.5-8B` via CSCS Alps (`https://api.inference.cscs.ch/v1`).
- **Deterministic Extraction**: `temperature=0.0`, schema validation via Pydantic v2, and mandatory page-anchored provenance.
- **Transparent Execution**: Offline dry-run mode is explicitly labeled (`Mode: OFFLINE DRY-RUN`) and validates citations against physical PDF pages without synthetic mock data.
- **Data Size**: `track_2a/data/` is **19.8 MB** (within the 100 MB competition ceiling).
- **License**: [Apache-2.0 License](LICENSE).
