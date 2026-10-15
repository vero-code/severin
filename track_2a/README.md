# Hack Apertus 2026 — Track 2A: OpenParlData Challenge
## SEVERIN — Swiss Parliamentary Affairs Extraction Platform

> **Challenge:** *Extracting Parliamentary Affairs from PDFs into One Common Structure with Verifiable Provenance*  
> **Team:** SEVERIN  
> **Target Model:** `swiss-ai/Apertus-v1.5-8B` (hosted on CSCS Alps NVIDIA GH200 nodes)  
> **Official Deliverables:** Technical Report ([technical_report.md](technical_report.md)), Code ([src/](src/)), Curated Dataset ([data/](data/)), and System Architecture ([docs/architecture.md](docs/architecture.md)).

---

## 🚀 Quickstart (Jury Reproducibility)

Run the full end-to-end pipeline via Docker using GNU Make (primary jury entrypoint):

```bash
# Optional: Set CSCS Alps API key for live inference
# (If omitted, automatically executes in 100% offline dry-run mode)
export CSCS_INFERENCE_API_KEY="your_cscs_key_here"

# Primary Entrypoint via GNU Make:
make build
make run

# Alternative: Direct Docker Compose:
cd track_2a
docker compose build
docker compose up
```

Once started:
1. The container executes the automated cross-cantonal verification benchmark (`src/benchmark.py`).
2. The interactive web platform is available at **[http://localhost:8000](http://localhost:8000)**.
3. Interactive OpenAPI / Swagger documentation is available at **[http://localhost:8000/docs](http://localhost:8000/docs)**.

### Local Python & Standalone CLI
```bash
# Run benchmark in auto mode (detects API key or dry-run)
make benchmark

# Run 100% offline dry-run verification
make dry-run

# Run automated test suite (all 6 test modules)
make test
```

---

## 📦 Directory Structure & Rules Compliance

- **`src/`**: Unified Pydantic v2 schema (`schema.py`), Apertus extraction engine (`extractor.py`), physical PDF parser (`pdf_parser.py`), CSCS client (`cscs_client.py`), OpenParlData API client (`api_client.py`), and FastAPI server (`server.py`).
- **`data/`**: 27 curated nationwide Swiss sample PDFs (including born-digital text PDFs and scanned raster files in `data/sample_pdfs/`), persistent Vision OCR transcriptions (`data/ocr_cache/`), model benchmark cache (`data/benchmark_cache/`), and live telemetry audit log (`data/telemetry.json`).  
  *Total size:* **19.8 MB** (strictly below the 100 MB competition ceiling).
- **`docs/`**: Technical architecture specifications ([docs/architecture.md](docs/architecture.md)) and system vector diagrams ([docs/architecture.svg](docs/architecture.svg)).
- **`technical_report.md`**: Official Hack Apertus technical report for the jury.
- **`Dockerfile` / `docker-compose.yml`**: Multi-stage container (Node 20 build + Python 3.11 runtime) ensuring turnkey reproducibility.

---

## ⚖️ Verification & Key Metrics

- **Conservative Extraction**: Deterministic inference (`temperature=0.0`), Rule of Absence (`null` for unstated entities), and algorithmic offset verification (`char_start`, `char_end`) against physical PDF pages.
- **Benchmark Provenance Accuracy**: **100.0%** (19/19 citations verified verbatim across 5 multilingual benchmark documents: CHE, ZH, GE, TI, GR).
- **Cost & Latency**: Hardware prefix caching (vLLM PagedAttention on CSCS Alps) reduces warm inference latency to **~3.16s** and cost to **~0.000022 – 0.000051 CHF** per document (0.000234 CHF total).

---

## 📜 License

This project is licensed under the **[Apache-2.0 License](../LICENSE)**.
