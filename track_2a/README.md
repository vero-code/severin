# Hack Apertus 2026 — Track 2A: OpenParlData Challenge
## SEVERIN — Swiss Parliamentary Affairs Extraction Platform

> **Challenge:** *Extracting Parliamentary Affairs from PDFs into One Common Structure with Verifiable Provenance*  
> **Team:** SEVERIN  
> **Target Model:** `swiss-ai/Apertus-v1.5-8B` (hosted on CSCS Alps NVIDIA GH200 nodes)  
> **Official Deliverables:** Technical Report ([technical_report.md](technical_report.md)), Code ([src/](src/)), Curated Dataset ([data/](data/)), and System Architecture ([docs/architecture.md](docs/architecture.md)).

---

## 🚀 Quickstart (Jury Reproducibility)

Run the full end-to-end pipeline with a single command from the project root:

```bash
# Optional: Set CSCS Alps API key for live inference
# (If omitted, automatically executes in 100% offline dry-run mode)
export CSCS_INFERENCE_API_KEY="your_cscs_key_here"

# Start the full pipeline (executes benchmark + launches web platform)
make run
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
- **`data/`**: 27 curated nationwide Swiss sample PDFs (`data/sample_pdfs/`), model benchmark cache (`data/benchmark_cache/`), and live telemetry audit log (`data/telemetry.json`).  
  *Total size:* **19.8 MB** (strictly below the 100 MB competition ceiling).
- **`docs/`**: Technical architecture specifications ([docs/architecture.md](docs/architecture.md)) and system vector diagrams ([docs/architecture.svg](docs/architecture.svg)).
- **`technical_report.md`**: Official Hack Apertus technical report for the jury.
- **`Dockerfile` / `docker-compose.yml`**: Multi-stage container (Node 20 build + Python 3.11 runtime) ensuring turnkey reproducibility.

---

## ⚖️ Scientific Integrity & Key Metrics

- **Zero Hallucination Mandate**: Deterministic inference (`temperature=0.0`) and algorithmic character offset provenance verification (`char_start`, `char_end`) against physical PDF pages.
- **National Verification Score**: **100.0%** verifiable citation accuracy (27/27 citations verified verbatim nationwide across DE, FR, IT, and RM).
- **Economic Feasibility**: Leveraging CSCS Alps PagedAttention prefix caching reduces warm inference cost to **0.000020 – 0.000039 CHF** per document.

---

## 📜 Submission & Licensing

- **Submission Portal**: [hackapertus.ch/online-hack/submissions](https://hackapertus.ch/online-hack/submissions)
- **License**: Creative Commons Attribution 4.0 International (**CC-BY 4.0**).
- **Terms & FAQ**: [hackapertus.ch/terms-and-conditions](https://hackapertus.ch/terms-and-conditions) • [hackapertus.ch/faq](https://hackapertus.ch/faq)
- **Contact**: hello@hackapertus.ch
