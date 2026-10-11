"""
Cross-Cantonal Benchmark & Provenance Evaluation Pipeline.
Evaluates Apertus 1.5-8B extraction fidelity and verifiable provenance across Swiss linguistic regions:
- CHE: Federal level (German / Multilingual)
- ZH: Zürich (German, Cantonal)
- GE: Genève (French, Cantonal)
- TI: Ticino (Italian, Cantonal)
- GR: Graubünden (Trilingual: German, Italian, Romansh)

Supports both:
  1. Live inference on CSCS Alps Supercomputer GH200 nodes (temperature=0.0).
  2. Offline dry-run validation using physical PDFs and cached extractions (for Docker make run reproducibility).

Track 2A - Hack Apertus 2026.
"""

import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Directory paths
TRACK_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = TRACK_DIR / "data"
SAMPLE_DIR = DATA_DIR / "sample_pdfs"
CACHE_DIR = DATA_DIR / "benchmark_cache"

# Ensure track_2a root is in sys.path for both module and direct script execution
if str(TRACK_DIR) not in sys.path:
    sys.path.insert(0, str(TRACK_DIR))

from src.enums import LanguageCode, ParliamentLevel, AffairType
from src.schema import ParliamentaryAffair
from src.pdf_parser import extract_pdf_pages
from src.extractor import extract_affair_from_pdf, verify_provenance, normalize_extracted_dict
from src.cscs_client import CSCSInferenceClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("benchmark")

# Benchmark benchmark documents spanning all 4 linguistic regions
BENCHMARK_TARGETS = [
    {
        "file_name": "CHE_326604_819055.pdf",
        "canton": "CHE",
        "region": "Federal / National",
        "language": "de",
        "affair_type": "initiative",
        "affair_id": 326604,
        "description": "Eidgenössische Volksinitiative «Nein zum F-35»"
    },
    {
        "file_name": "ZH_341002_927679.pdf",
        "canton": "ZH",
        "region": "German (Deutschschweiz)",
        "language": "de",
        "affair_type": "government_affair",
        "affair_id": 341002,
        "description": "Änderung der Kantonalen Opferhilfeverordnung (KOHV)"
    },
    {
        "file_name": "GE_340969_927404.pdf",
        "canton": "GE",
        "region": "French (Suisse romande)",
        "language": "fr",
        "affair_type": "question",
        "affair_id": 340969,
        "description": "Protection des mineurs: pratiques coercitives (Q 4165)"
    },
    {
        "file_name": "TI_341386_928764.pdf",
        "canton": "TI",
        "region": "Italian (Svizzera italiana)",
        "language": "it",
        "affair_type": "interpellation",
        "affair_id": 341386,
        "description": "Versamenti ai membri del CdA di AET"
    },
    {
        "file_name": "GR_337559_920605.pdf",
        "canton": "GR",
        "region": "Trilingual (de/it/rm)",
        "language": "de",
        "affair_type": "question",
        "affair_id": 337559,
        "description": "Die Rekordhitze und -trockenheit (Anfrage Kreiliger)"
    }
]


def run_benchmark_target(
    target: Dict[str, Any],
    is_dry_run: bool,
    client: Optional[CSCSInferenceClient] = None
) -> Dict[str, Any]:
    """
    Run extraction and algorithmic provenance verification for a single benchmark document.
    """
    pdf_path = SAMPLE_DIR / target["file_name"]
    cache_path = CACHE_DIR / f"{target['file_name']}.json"

    if not pdf_path.exists():
        raise FileNotFoundError(f"Sample PDF not found: {pdf_path}")

    logger.info(
        f"Processing [{target['canton']}] {target['file_name']} "
        f"({target['region']}, {target['language'].upper()}) [mode={'dry-run' if is_dry_run else 'live'}]..."
    )

    pages = extract_pdf_pages(pdf_path)
    total_chars = sum(p["char_count"] for p in pages)
    page_count = len(pages)

    affair: ParliamentaryAffair
    report: Dict[str, Any]
    tokens_prompt = 0
    tokens_completion = 0
    tokens_cached = 0
    cost_chf = 0.0
    latency_sec = 0.0

    t_start = time.perf_counter()

    if not is_dry_run:
        # Live extraction strictly via CSCS Apertus 1.5-8B on Alps
        cscs = client or CSCSInferenceClient()
        affair, report = extract_affair_from_pdf(
            pdf_path=pdf_path,
            client=cscs,
            canton_hint=target["canton"],
            affair_id_hint=target["affair_id"]
        )
        latency_sec = round(time.perf_counter() - t_start, 3)

        # Retrieve telemetry from the last invocation
        if cscs.history:
            last_hist = cscs.history[-1]
            tokens_prompt = last_hist.get("prompt_tokens", 0)
            tokens_completion = last_hist.get("completion_tokens", 0)
            tokens_cached = last_hist.get("cached_tokens", 0)
            cost_chf = last_hist.get("cost_chf", 0.0)

        # Save to benchmark cache for future offline runs
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump({
                "affair": affair.model_dump(),
                "report": report,
                "latency_sec": latency_sec,
                "tokens_prompt": tokens_prompt,
                "tokens_completion": tokens_completion,
                "tokens_cached": tokens_cached,
                "cost_chf": cost_chf
            }, f, indent=2, ensure_ascii=False)

    else:
        # Offline dry-run mode: strictly verify authentic cached extractions against physical PDFs
        if not cache_path.exists():
            raise FileNotFoundError(
                f"Benchmark cache file not found: {cache_path}. "
                f"Dry-run mode requires pre-computed model extractions in data/benchmark_cache/."
            )
        with open(cache_path, "r", encoding="utf-8") as f:
            cached_data = json.load(f)
        raw_affair_dict = normalize_extracted_dict(cached_data.get("affair", {}))
        affair = ParliamentaryAffair.model_validate(raw_affair_dict)
        latency_sec = cached_data.get("latency_sec", 0.0)
        tokens_prompt = cached_data.get("tokens_prompt", 0)
        tokens_completion = cached_data.get("tokens_completion", 0)
        tokens_cached = cached_data.get("tokens_cached", 0)
        cost_chf = cached_data.get("cost_chf", 0.0)

        # Re-verify provenance deterministically against local physical pages
        report = verify_provenance(affair, pages)

    return {
        "canton": target["canton"],
        "region": target["region"],
        "file_name": target["file_name"],
        "language": target["language"],
        "level": affair.level.value,
        "affair_type": affair.affair_type.value,
        "title": affair.title,
        "pages": page_count,
        "chars": total_chars,
        "authors_count": len(affair.authors),
        "questions_count": len(affair.questions_and_answers),
        "financial_credits_count": len(affair.financial_details),
        "total_citations": report["total_citations"],
        "verified_citations": report["verified_citations"],
        "failed_citations": report["failed_citations"],
        "provenance_score": report["provenance_score"],
        "provenance_percent": f"{round(report['provenance_score'] * 100, 1)}%",
        "tokens_prompt": tokens_prompt,
        "tokens_completion": tokens_completion,
        "tokens_cached": tokens_cached,
        "total_tokens": tokens_prompt + tokens_completion,
        "cost_chf": cost_chf,
        "latency_sec": latency_sec,
        "mode": "dry-run" if is_dry_run else "live"
    }


def format_markdown_table(results: List[Dict[str, Any]]) -> str:
    """
    Generate standard Markdown table for Section 5 of technical_report.md.
    Transparently displays both successful and failed target evaluations.
    """
    lines = [
        "| Canton / Body | Region & Language | Document Type | Provenance Match | Verified Citations | Latency (s) | Total Tokens | Cached (Alps) | Cost (CHF) |",
        "|---|---|---|---|---|---|---|---|---|"
    ]
    for r in results:
        if "error" in r:
            lines.append(
                f"| **{r['canton']}** | {r['region']} ({r['language'].upper()}) | `{r.get('affair_type', 'N/A')}` | "
                f"**FAILED** | 0/0 | N/A | N/A | N/A | `0.00 CHF` |"
            )
        else:
            lines.append(
                f"| **{r['canton']}** | {r['region']} ({r['language'].upper()}) | `{r['affair_type']}` | "
                f"**{r['provenance_percent']}** | {r['verified_citations']}/{r['total_citations']} | "
                f"{r['latency_sec']}s | {r['total_tokens']:,} | {r['tokens_cached']:,} | "
                f"`{r['cost_chf']:.6f} CHF` |"
            )
    return "\n".join(lines)


def run_cross_cantonal_benchmark(
    mode: str = "auto",
    cantons_filter: Optional[List[str]] = None,
    output_json: Optional[Path] = None,
    output_md: Optional[Path] = None
) -> Dict[str, Any]:
    """
    Execute full cross-cantonal benchmark across selected Swiss jurisdictions.
    """
    has_api_key = bool(os.environ.get("CSCS_INFERENCE_API_KEY"))
    
    # Determine mode
    if mode == "auto":
        is_dry_run = not has_api_key
        logger.info(f"Auto-selected mode: {'live (API key detected)' if not is_dry_run else 'dry-run (no API key)'}")
    elif mode in ("dry-run", "offline"):
        is_dry_run = True
    else:
        is_dry_run = False
        if not has_api_key:
            logger.warning("Live mode selected but CSCS_INFERENCE_API_KEY is not set! Falling back to dry-run.")
            is_dry_run = True

    client = None if is_dry_run else CSCSInferenceClient()

    targets = BENCHMARK_TARGETS
    if cantons_filter:
        targets = [t for t in targets if t["canton"].upper() in [c.upper() for c in cantons_filter]]

    print("\n" + "=" * 80)
    print("🇨🇭 SEVERIN — Cross-Cantonal Apertus 1.5-8B Benchmark (Track 2A)")
    print(f"Mode: {'OFFLINE DRY-RUN (Offline verification)' if is_dry_run else 'LIVE INFERENCE (CSCS Alps GH200)'}")
    print(f"Target Jurisdictions: {', '.join(t['canton'] for t in targets)}")
    print("=" * 80 + "\n")

    results = []
    for target in targets:
        try:
            res = run_benchmark_target(target, is_dry_run=is_dry_run, client=client)
            results.append(res)
            print(f"  ✓ [{res['canton']}] {res['file_name']}: {res['provenance_percent']} verified ({res['verified_citations']}/{res['total_citations']} citations) in {res['latency_sec']}s")
        except Exception as e:
            logger.error(f"Failed benchmark on {target['file_name']}: {e}")
            results.append({
                "canton": target["canton"],
                "region": target["region"],
                "file_name": target["file_name"],
                "language": target["language"],
                "error": str(e),
                "provenance_score": 0.0,
                "provenance_percent": "0.0%",
                "verified_citations": 0,
                "total_citations": 0,
                "latency_sec": 0.0,
                "total_tokens": 0,
                "tokens_cached": 0,
                "cost_chf": 0.0,
                "affair_type": target["affair_type"],
                "mode": "failed"
            })

    # Summary statistics
    valid_results = [r for r in results if "error" not in r]
    avg_provenance = (
        sum(r["provenance_score"] for r in valid_results) / len(valid_results)
        if valid_results else 0.0
    )
    total_cost = sum(r.get("cost_chf", 0.0) for r in valid_results)
    total_tokens = sum(r.get("total_tokens", 0) for r in valid_results)
    total_cached = sum(r.get("tokens_cached", 0) for r in valid_results)
    avg_latency = (
        sum(r.get("latency_sec", 0.0) for r in valid_results) / len(valid_results)
        if valid_results else 0.0
    )

    summary_data = {
        "benchmark_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "mode": "dry-run" if is_dry_run else "live",
        "model": "swiss-ai/Apertus-v1.5-8B",
        "hardware": "CSCS Alps (NVIDIA GH200)",
        "jurisdictions_evaluated": len(results),
        "average_provenance_score": round(avg_provenance, 3),
        "average_provenance_percent": f"{round(avg_provenance * 100, 1)}%",
        "total_tokens": total_tokens,
        "total_cached_tokens": total_cached,
        "total_cost_chf": round(total_cost, 6),
        "average_latency_sec": round(avg_latency, 2),
        "results": results
    }

    md_table = format_markdown_table(results)

    print("\n" + "=" * 80)
    print("📊 BENCHMARK EVALUATION RESULTS (Ready for technical_report.md Section 5)")
    print("=" * 80 + "\n")
    print(md_table)
    print(f"\nAverage Verifiable Provenance Match: {summary_data['average_provenance_percent']}")
    print(f"Total Benchmark Cost: {summary_data['total_cost_chf']:.6f} CHF (Alps GH200 PagedAttention)")
    print(f"Average Round-Trip Latency: {summary_data['average_latency_sec']}s\n")

    # Save output artifacts
    json_path = output_json or (DATA_DIR / "benchmark_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2, ensure_ascii=False)
    logger.info(f"Machine-readable results saved to: {json_path}")

    md_path = output_md or (DATA_DIR / "benchmark_summary.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# Cross-Cantonal Evaluation Benchmark\n\n")
        f.write(f"Generated at: `{summary_data['benchmark_timestamp']}` (Mode: `{summary_data['mode']}`)\n\n")
        f.write(md_table + "\n\n")
        f.write(f"- **Overall Provenance Accuracy**: {summary_data['average_provenance_percent']}\n")
        f.write(f"- **Total Token Expenditure**: {total_tokens:,} tokens ({total_cached:,} cached @ 0.00 CHF)\n")
        f.write(f"- **Total Cumulative Cost**: `{summary_data['total_cost_chf']:.6f} CHF`\n")
    logger.info(f"Markdown summary saved to: {md_path}")

    return summary_data


def main():
    parser = argparse.ArgumentParser(description="SEVERIN Cross-Cantonal Apertus 1.5-8B Benchmark")
    parser.add_argument(
        "--mode",
        choices=["auto", "live", "dry-run", "offline"],
        default="auto",
        help="Benchmark execution mode (default: auto, falls back to dry-run if API key is absent)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Force offline dry-run evaluation using physical PDFs and cached extractions"
    )
    parser.add_argument(
        "--cantons",
        type=str,
        default=None,
        help="Comma-separated list of canton codes to evaluate (e.g. 'CHE,ZH,GE')"
    )
    parser.add_argument(
        "--output-json",
        type=str,
        default=None,
        help="Output path for JSON results"
    )
    parser.add_argument(
        "--output-md",
        type=str,
        default=None,
        help="Output path for Markdown summary table"
    )

    args = parser.parse_args()

    mode = "dry-run" if args.dry_run else args.mode
    cantons = [c.strip() for c in args.cantons.split(",")] if args.cantons else None
    out_json = Path(args.output_json) if args.output_json else None
    out_md = Path(args.output_md) if args.output_md else None

    run_cross_cantonal_benchmark(
        mode=mode,
        cantons_filter=cantons,
        output_json=out_json,
        output_md=out_md
    )


if __name__ == "__main__":
    main()
