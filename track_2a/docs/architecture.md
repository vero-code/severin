# SEVERIN — System Architecture & Data Flow

SEVERIN (**S**wiss **E**xtraction & **V**erifiable **E**ntity **R**epresentation for Parliamentary **I**nter-cantonal **N**etworks) transforms heterogeneous, multilingual Swiss parliamentary PDF documents into a structured schema with page-anchored provenance verification.

![SEVERIN Architecture](architecture.svg)

---

## 1. Pipeline Architecture

```mermaid
flowchart LR
    subgraph S1["1. Ingestion & Preprocessing"]
        API["OpenParlData API<br/>(Cantons + Federal)"] --> PDF["PDF Ingestion<br/>(pypdf)"]
        LOCAL["Sample Corpus<br/>(27 Curated PDFs)"] --> PDF
        PDF --> DETECT{"Text Layer Check<br/>char_count > 0?"}
        DETECT -- Yes: Digital PDF --> TEXT["1-Indexed Page Parser<br/>&amp; Swiss Normalizer"]
        DETECT -- No: Raster Scan --> OCR["Pillow Extraction &amp;<br/>Apertus Vision OCR"]
        OCR --> CACHE_OCR[("Disk OCR Cache<br/>data/ocr_cache/")]
        CACHE_OCR --> TEXT
    end

    subgraph S2["2. Model Inference"]
        TEXT --> PROMPT["Extraction Prompt<br/>+ Pydantic JSON Schema"]
        PROMPT --> CSCS["CSCS Inference API<br/>(Alps GH200, Lugano)"]
        CSCS --> APERTUS["swiss-ai/Apertus-v1.5-8B<br/>temperature=0.0"]
        APERTUS --> CACHE["vLLM PagedAttention<br/>Prefix Cache (4,480 toks)"]
    end

    subgraph S3["3. Schema & Provenance"]
        APERTUS --> NORM["Defensive Normalizer<br/>(JSON Idiosyncrasy Repair)"]
        NORM --> SCHEMA["Pydantic v2 Schema<br/>extra='forbid'"]
        SCHEMA --> VERIFIER["Provenance Verifier<br/>(Physical Offsets: start/end)"]
    end

    subgraph S4["4. Delivery & Interfaces"]
        VERIFIER --> AUDIT["Benchmark Outputs<br/>(JSON &amp; Markdown Summary)"]
        VERIFIER --> FASTAPI["FastAPI Backend<br/>(REST &amp; Telemetry)"]
        FASTAPI --> REACT["React 19 Web UI<br/>(Split View &amp; Citations)"]
    end

    classDef c1 fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef c2 fill:#1e293b,stroke:#ef4444,stroke-width:2px,color:#f8fafc;
    classDef c3 fill:#1e293b,stroke:#10b981,stroke-width:2px,color:#f8fafc;
    classDef c4 fill:#1e293b,stroke:#8b5cf6,stroke-width:2px,color:#f8fafc;

    class API,PDF,LOCAL,DETECT,TEXT,OCR,CACHE_OCR c1;
    class PROMPT,CSCS,APERTUS,CACHE c2;
    class NORM,SCHEMA,VERIFIER c3;
    class AUDIT,FASTAPI,REACT c4;
```

---

## 2. Core Components

### 2.1 PDF Ingestion & Parsing (`src/pdf_parser.py`)
- **Digital PDF Extraction**: Extracts raw text per physical page using `pypdf`, preserving strict 1-indexed page numbering that aligns directly with PDF viewers.
- **Multilingual Swiss Normalization**: Expands ligatures (`ﬁ`, `ﬂ`, `œ`, `æ`), strips non-printable ASCII control artifacts, and maps legacy Type-1/CP1252 embedded font glyphs (`\x11` -> `š`, `\x12` -> `č`).
- **Native Vision OCR Fallback**: For scanned raster documents with 0 extractable digital characters (e.g. Canton Obwalden `OW_339491_925376.pdf`), automatically extracts full-page bitmap images via `Pillow`, optimizes resolution (max 2048px Lanczos), and transcribes via `swiss-ai/Apertus-v1.5-8B` Vision on CSCS Alps (`image_url` input at `temperature=0.0`).
- **OCR Cache**: Persists transcribed text with 1-indexed page markers in `data/ocr_cache/{pdf_name}.json` for instant, deterministic offline replay.

### 2.2 CSCS Inference Client (`src/cscs_client.py`)
- Connects to the OpenAI-compatible CSCS Alps endpoint (`https://api.inference.cscs.ch/v1`).
- Uses `swiss-ai/Apertus-v1.5-8B` with `temperature=0.0` for deterministic outputs.
- Leverages vLLM PagedAttention prefix caching on Alps GPU memory: shared prompt instructions and schema tokens (~4,800 tokens) are cached, reducing inference latency and cost.
- Logs token consumption, cache hits, latency, and estimated CHF expenditure to `data/telemetry.json`.

### 2.3 Unified Representation Schema (`src/schema.py`)
- Pydantic v2 data model (`ParliamentaryAffair`) standardizing affairs across DE, FR, IT, and RM.
- Enforces `extra="forbid"` to reject unmapped or hallucinated keys.
- Harmonizes 8 core affair types: `motion`, `postulate`, `interpellation`, `question`, `initiative`, `government_affair`, `petition`, and `other`.
- Maps conceptually to established standards: *Popolo* (actors, organizations), *Akoma Ntoso* (procedural events, lifecycle), and *Parla-CLARIN* (question/answer pairings).

### 2.4 Provenance Verifier (`src/extractor.py`)
- Every extracted field requires a `Provenance` block specifying the 1-indexed page number and verbatim text quote.
- Locates exact substrings on the cited physical page and computes character offsets (`char_start`, `char_end`).
- If a quote appears on an adjacent page, the verifier updates the page number and flags status as `inferred`.
- If a quote cannot be located in the text, it is tagged as `not_found`, reducing the provenance match score.

### 2.5 Benchmark Engine (`src/benchmark.py`)
- Evaluates extraction across federal and cantonal jurisdictions:
  - **CHE**: Federal Initiative (German)
  - **ZH**: Cantonal Postulate (German)
  - **GE**: Cantonal Written Question (French)
  - **TI**: Cantonal Interpellation (Italian)
  - **GR**: Cantonal Inquiry (Trilingual German/Italian/Romansh)
- Supports both **Live mode** (via CSCS Alps API key) and **Offline Dry-Run mode** (verifying pre-computed completions against physical PDF text with zero network calls).

---

## 3. End-to-End Execution Workflows

### 3.1 Workflow A: Automated Benchmark (`make run`)

When executing `make run`, the container mounts `./data:/app/data`, runs the benchmark, and starts the server:

```
[ Terminal: make run ]
         │
         ▼
[ Docker initializes container: severin_track_2a ]
         │
         ▼
[ benchmark.py selects 5 targets: CHE, ZH, GE, TI, GR ]
         │
         ▼
[ pdf_parser.py extracts 1-indexed page text from data/sample_pdfs/*.pdf ]
         │
         ▼
[ prompts.py builds prompt with Rule of Absence + JSON Schema ]
         │
         ▼ (HTTPS POST to CSCS API)
[ CSCS Alps: Apertus 1.5-8B (temperature=0.0) ]
         │
         ▼ (Structured JSON completion received)
[ extractor.py: verify_provenance() matches substrings against PDF text ]
         │
         ▼
[ Persists artifacts to data/ ]
  ├── data/benchmark_summary.md       (Markdown summary table)
  ├── data/benchmark_results.json     (Per-canton metrics: latency, tokens, citations)
  ├── data/telemetry.json             (CSCS token and cost audit log)
  └── data/benchmark_cache/*.pdf.json (Model outputs for dry-run validation)
         │
         ▼
[ Starts FastAPI server on port 8000: http://localhost:8000 ]
```

#### Sequence Diagram (Benchmark Execution):

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Terminal
    participant Docker as Docker Container
    participant Bench as benchmark.py
    participant Parser as pdf_parser.py
    participant Disk as Local Data (data/)
    participant CSCS as CSCS Alps (Lugano)
    participant Verifier as verify_provenance()
    participant Server as FastAPI Server (Uvicorn)

    User->>Docker: make run
    Docker->>Bench: python src/benchmark.py --mode auto
    Note over Bench: Evaluates 5 targets: CHE, ZH, GE, TI, GR
    loop For each canton target
        Bench->>Parser: extract_pdf_pages(file_name)
        Parser->>Disk: Read PDF from data/sample_pdfs/
        Disk-->>Parser: Binary PDF stream
        Parser-->>Bench: 1-indexed page text
        Bench->>CSCS: POST /chat/completions (Apertus 1.5-8B, temp=0.0)
        Note over CSCS: Inference with PagedAttention prefix cache
        CSCS-->>Bench: Structured JSON with citations
        Bench->>Verifier: verify_provenance(affair, pages)
        Verifier->>Disk: Locate exact substrings in physical pages
        Verifier-->>Bench: Provenance report (char_start, char_end, match score)
    end
    Bench->>Disk: Write benchmark_results.json & benchmark_summary.md
    Bench->>Disk: Update telemetry.json & benchmark_cache/
    Bench-->>Docker: Benchmark completed
    Docker->>Server: uvicorn src.server:app --port 8000
    Server-->>User: Ready on http://localhost:8000
```

---

### 3.2 Workflow B: Interactive Web Application (`http://localhost:8000`)

```
[ User opens http://localhost:8000 ]
         │
         ▼
[ Selects canton from 27 sample PDFs ]
         │
         ▼
[ Clicks "Extract Affair" ]
         │
         ▼ (HTTP POST /api/extract)
[ FastAPI / pdf_parser extracts page text ]
  ├── Born-digital PDFs: pypdf physical page text extraction
  └── Scanned bitmaps (OW): Apertus 1.5-8B Vision OCR fallback
         │
         ▼ (HTTPS POST to CSCS API)
[ Apertus 1.5-8B extracts entities and quote snippets ]
         │
         ▼
[ Verifier validates offsets against physical page text ]
         │
         ▼
[ React 19 UI renders results ]:
  ├── Affair metadata card (title, authors, summary, dates)
  ├── Question & Answer list with verification badges
  ├── Dual-mode Document Studio (raw PDF embed & Text viewer with <mark> citation highlights)
  └── CSCS telemetry bar (tokens, cost, speed)
```

#### Sequence Diagram (Interactive Extraction):

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant UI as React 19 Frontend
    participant API as FastAPI Backend (/api)
    participant Parser as pdf_parser.py
    participant Disk as Local Data (data/)
    participant CSCS as CSCS Alps (Lugano)
    participant Verifier as verify_provenance()

    User->>UI: Select canton from sample PDFs
    UI->>Disk: Stream PDF via /api/pdf-proxy
    Disk-->>UI: Display PDF in viewer
    User->>UI: Click "Extract Affair"
    UI->>API: POST /api/extract { sample_file: "..." }
    API->>Parser: extract_pdf_pages(sample_path)
    Note over Parser: Born-digital: pypdf extraction<br/>Scanned bitmap (OW): Apertus Vision OCR fallback
    Parser-->>API: 1-indexed page text
    API->>CSCS: POST /chat/completions (Apertus 1.5-8B, temp=0.0)
    CSCS-->>API: JSON response with citations
    API->>Verifier: verify_provenance(affair, pages)
    Verifier-->>API: Grounded offsets (char_start, char_end)
    API-->>UI: Return ExtractResponse
    UI-->>User: Display Affair card, citation badges & telemetry
    User->>UI: Click citation badge in affair card
    UI->>UI: Switch to Text tab, auto-scroll & highlight snippet (<mark>)
```

---

### 3.3 Telemetry & Frontend Synchronization (`telemetry.json`)

SEVERIN maintains a unified telemetry log (`data/telemetry.json`) connecting CLI benchmarks, API extractions, and the web interface:

```mermaid
sequenceDiagram
    autonumber
    participant CLI as Startup Benchmark (CLI)
    participant Disk as Persistent Ledger (data/telemetry.json)
    participant API as FastAPI Backend (/api/telemetry)
    participant UI as React Header (Telemetry Widget)

    CLI->>Disk: Record prompt, completion, cache tokens, latency & cost
    CLI->>Disk: Append calls [CHE, ZH, GE, TI, GR] to history
    UI->>API: GET /api/telemetry (polling interval)
    API->>Disk: Read telemetry data
    Disk-->>API: Cumulative stats (tokens, CHF, cache hits)
    API-->>UI: Return TelemetryResponse
    Note over UI: Header displays total tokens, cache rate & cost<br/>Popover displays recent calls with canton tags
```

1. **CLI-to-Web Handover**: The 5 benchmark documents processed during container launch (`make run`) are logged to `data/telemetry.json`. When the web UI opens, these calls appear in the telemetry popover with their latencies, token counts, and provenance scores.
2. **Single Source of Truth**: `CSCSInferenceClient` coordinates telemetry logging across both CLI runs and HTTP endpoints, keeping terminal and UI numbers consistent.
3. **Execution Modes**:
   - In **LIVE mode** (with `CSCS_INFERENCE_API_KEY`): Dispatches requests to CSCS Alps, updates token counters, and logs CHF costs.
   - In **OFFLINE DRY-RUN mode** (without API key): Validates pre-computed completions against physical PDF pages. No API requests or costs are recorded, and existing telemetry remains unchanged.
