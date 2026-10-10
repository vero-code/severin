"""
CSCS LLM Inference API Client for Swiss-AI Apertus Models.
Complies with Rule 5 of Hack Apertus 2026:
- Target model: swiss-ai/Apertus-v1.5-8B (or swiss-ai/Apertus-v1.5-70B)
- Endpoint: https://api.inference.cscs.ch/v1 (OpenAI-compatible)
- Temperature strictly locked to 0.0 for deterministic extraction
- API key retrieved strictly from CSCS_INFERENCE_API_KEY environment variable
- Client-side token and latency telemetry tracking per CSCS guidance
"""

import os
import time
import json
import math
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from openai import OpenAI, OpenAIError, AuthenticationError, APIConnectionError, RateLimitError

# Load environment variables from track_2a/.env if present
_track_dir = Path(__file__).resolve().parent.parent
_env_path = _track_dir / ".env"
if _env_path.exists():
    load_dotenv(dotenv_path=_env_path)
else:
    load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cscs_client")


class CSCSInferenceClient:
    """
    OpenAI-compatible client for CSCS Inference Service hosting Swiss-AI Apertus.
    """

    DEFAULT_BASE_URL: str = "https://api.inference.cscs.ch/v1"
    DEFAULT_MODEL: str = "swiss-ai/Apertus-v1.5-8B"
    LARGE_MODEL: str = "swiss-ai/Apertus-v1.5-70B"
    FIXED_TEMPERATURE: float = 0.0  # Mandatory deterministic temperature

    # Official CSCS pay-per-use fees for Academia (CHF per 1M tokens)
    # Source: CSCS Inference Dashboard Pricing Table (October 2026)
    INPUT_COST_PER_MILLION: float = 0.010000
    OUTPUT_COST_PER_MILLION: float = 0.040000
    CACHED_COST_PER_MILLION: float = 0.000000  # Prefix caching on Alps GH200 nodes is 100% free

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        default_model: Optional[str] = None,
        timeout: float = 60.0,
        telemetry_path: Optional[Path] = None
    ):
        """
        Initialize the CSCS Inference Client.

        :param api_key: Optional explicit API key. If not provided, reads from CSCS_INFERENCE_API_KEY env var.
        :param base_url: CSCS endpoint URL (defaults to https://api.inference.cscs.ch/v1).
        :param default_model: Target model name (defaults to swiss-ai/Apertus-v1.5-8B).
        :param timeout: Request timeout in seconds.
        :param telemetry_path: Optional custom path for telemetry JSON persistence.
        """
        self.api_key = api_key or os.getenv("CSCS_INFERENCE_API_KEY")
        if not self.api_key:
            raise ValueError(
                "CSCS_INFERENCE_API_KEY is not set. "
                "Please configure the CSCS_INFERENCE_API_KEY environment variable "
                "before initializing the CSCS client."
            )

        self.base_url = base_url or os.getenv("LLM_BASE_URL") or self.DEFAULT_BASE_URL
        self.default_model = default_model or os.getenv("LLM_NAME") or self.DEFAULT_MODEL
        self.timeout = timeout

        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout
        )

        # Persistent telemetry file path
        self.telemetry_path = Path(telemetry_path) if telemetry_path else (_track_dir / "data" / "telemetry.json")
        self._load_telemetry()

        logger.info(
            f"CSCSInferenceClient initialized: base_url={self.base_url}, default_model={self.default_model}"
        )

    def _load_telemetry(self) -> None:
        """Load persistent telemetry data if available."""
        self.total_prompt_tokens: int = 0
        self.total_completion_tokens: int = 0
        self.total_cached_tokens: int = 0
        self.total_cost_chf: float = 0.0
        self.total_requests: int = 0
        self.total_latency_seconds: float = 0.0
        self.history: List[Dict[str, Any]] = []

        if self.telemetry_path.exists():
            try:
                with open(self.telemetry_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.total_requests = data.get("total_requests", 0)
                    self.total_prompt_tokens = data.get("total_prompt_tokens", 0)
                    self.total_completion_tokens = data.get("total_completion_tokens", 0)
                    self.total_cached_tokens = data.get("total_cached_tokens", 0)
                    self.total_cost_chf = data.get("total_cost_chf", 0.0)
                    self.total_latency_seconds = data.get("total_latency_seconds", 0.0)
                    self.history = data.get("history", [])
            except Exception as e:
                logger.warning(f"Failed to read existing telemetry: {e}")

    def _save_telemetry(self) -> None:
        """Persist updated telemetry metrics to disk."""
        try:
            self.telemetry_path.parent.mkdir(parents=True, exist_ok=True)
            avg_lat = (
                round(self.total_latency_seconds / self.total_requests, 3)
                if self.total_requests > 0
                else 0.0
            )

            # Calculate cumulative account cost using CSCS ceiling methodology (micro-CHF)
            uncached_prompt_total = max(0, self.total_prompt_tokens - self.total_cached_tokens)
            cumulative_raw_chf = (
                (uncached_prompt_total * self.INPUT_COST_PER_MILLION / 1_000_000)
                + (self.total_cached_tokens * self.CACHED_COST_PER_MILLION / 1_000_000)
                + (self.total_completion_tokens * self.OUTPUT_COST_PER_MILLION / 1_000_000)
            )
            if (self.total_prompt_tokens + self.total_completion_tokens) > 0:
                cumulative_cost_chf = math.ceil(cumulative_raw_chf * 1_000_000) / 1_000_000
            else:
                cumulative_cost_chf = 0.0
            self.total_cost_chf = round(cumulative_cost_chf, 6)

            data = {
                "model": self.default_model,
                "endpoint": self.base_url,
                "status": "online",
                "total_requests": self.total_requests,
                "total_prompt_tokens": self.total_prompt_tokens,
                "total_completion_tokens": self.total_completion_tokens,
                "total_cached_tokens": self.total_cached_tokens,
                "total_tokens": self.total_prompt_tokens + self.total_completion_tokens,
                "total_cost_chf": self.total_cost_chf,
                "total_latency_seconds": round(self.total_latency_seconds, 2),
                "average_latency_seconds": avg_lat,
                "last_request_at": datetime.now().isoformat(),
                "history": self.history[-50:]  # Keep last 50 requests
            }
            with open(self.telemetry_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Failed to save telemetry: {e}")

    def list_models(self) -> List[str]:
        """
        Query available models from the CSCS /v1/models endpoint.

        :return: List of model IDs available for this API key.
        """
        try:
            resp = self.client.models.list()
            model_ids = [m.id for m in resp.data]
            logger.info(f"Retrieved {len(model_ids)} models from CSCS: {model_ids}")
            return model_ids
        except OpenAIError as e:
            logger.error(f"Failed to query CSCS models: {e}")
            raise

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        max_tokens: int = 4096,
        response_format: Optional[Dict[str, str]] = None,
        temperature: float = 0.0,
        task: str = "general",
        canton: Optional[str] = None,
        provenance_score: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Execute a chat completion request against CSCS inference.
        Enforces temperature=0.0 per project rules regardless of parameter override.

        :param messages: List of message objects [{'role': 'user', 'content': '...'}]
        :param model: Model name (defaults to swiss-ai/Apertus-v1.5-8B).
        :param max_tokens: Maximum tokens in completion.
        :param response_format: Optional OpenAI response_format, e.g. {"type": "json_object"}.
        :param temperature: Ignored if non-zero; locked to 0.0 for reproducibility.
        :param task: Label for telemetry (e.g. "Smoke Test", "Extract: ZH-2026-3713").
        :param canton: Canton or jurisdiction abbreviation (e.g. "ZH", "AG", "CHE").
        :param provenance_score: Optional provenance verification ratio (0.0 - 1.0).
        :return: Dict containing 'content', 'model', 'prompt_tokens', 'completion_tokens', 'latency_sec'.
        """
        # Rule 5: Force temperature=0.0 for deterministic and hallucination-free outputs
        actual_temperature = self.FIXED_TEMPERATURE
        target_model = model or self.default_model

        start_time = time.perf_counter()

        kwargs: Dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "temperature": actual_temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            kwargs["response_format"] = response_format

        try:
            logger.info(f"Sending request to CSCS model '{target_model}' (temp={actual_temperature}, task={task})...")
            response = self.client.chat.completions.create(**kwargs)
            latency = time.perf_counter() - start_time

            choice = response.choices[0]
            content = choice.message.content or ""
            finish_reason = choice.finish_reason

            usage = response.usage
            prompt_tokens = usage.prompt_tokens if usage else 0
            completion_tokens = usage.completion_tokens if usage else 0

            # Extract cached tokens from prompt_tokens_details if returned by CSCS vLLM
            cached_tokens = 0
            if usage and hasattr(usage, "prompt_tokens_details") and usage.prompt_tokens_details:
                cached_tokens = getattr(usage.prompt_tokens_details, "cached_tokens", 0) or 0

            # Calculate precise cost according to official CSCS tariff (CHF per 1M tokens)
            uncached_prompt = max(0, prompt_tokens - cached_tokens)
            call_cost_chf = (
                (uncached_prompt * self.INPUT_COST_PER_MILLION / 1_000_000)
                + (cached_tokens * self.CACHED_COST_PER_MILLION / 1_000_000)
                + (completion_tokens * self.OUTPUT_COST_PER_MILLION / 1_000_000)
            )
            # Enforce minimum billing precision floor of 1 micro-CHF (0.000001 CHF) per request
            # with tokens, matching CSCS Alps billing accounting
            if (prompt_tokens + completion_tokens) > 0 and call_cost_chf < 0.000001:
                call_cost_chf = 0.000001
            else:
                call_cost_chf = round(call_cost_chf, 6)

            # Update client-side telemetry
            self.total_requests += 1
            self.total_prompt_tokens += prompt_tokens
            self.total_completion_tokens += completion_tokens
            self.total_cached_tokens += cached_tokens
            self.total_cost_chf += call_cost_chf
            self.total_latency_seconds += latency

            self.history.append({
                "timestamp": datetime.now().isoformat(),
                "model": target_model,
                "task": task,
                "canton": canton,
                "provenance_score": provenance_score,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "cached_tokens": cached_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
                "cost_chf": call_cost_chf,
                "latency_sec": round(latency, 3),
                "status": "success"
            })
            self._save_telemetry()

            logger.info(
                f"CSCS response received: finish_reason={finish_reason}, "
                f"prompt_tokens={prompt_tokens} (cached={cached_tokens}), "
                f"completion_tokens={completion_tokens}, cost={call_cost_chf:.6f} CHF, "
                f"latency={latency:.2f}s"
            )

            return {
                "content": content,
                "model": target_model,
                "finish_reason": finish_reason,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "cached_tokens": cached_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
                "cost_chf": call_cost_chf,
                "latency_sec": latency
            }

        except AuthenticationError as e:
            logger.error(f"CSCS Authentication failed: Check CSCS_INFERENCE_API_KEY. Error: {e}")
            raise
        except RateLimitError as e:
            logger.error(f"CSCS Rate limit exceeded: {e}")
            raise
        except APIConnectionError as e:
            logger.error(f"Cannot connect to CSCS endpoint at {self.base_url}: {e}")
            raise
        except OpenAIError as e:
            logger.error(f"CSCS API error: {e}")
            raise

    def get_telemetry_summary(self) -> Dict[str, Any]:
        """
        Return accumulated client-side telemetry statistics for the technical report.
        """
        avg_latency = (
            self.total_latency_seconds / self.total_requests
            if self.total_requests > 0
            else 0.0
        )
        return {
            "model": self.default_model,
            "status": "online",
            "total_requests": self.total_requests,
            "total_prompt_tokens": self.total_prompt_tokens,
            "total_completion_tokens": self.total_completion_tokens,
            "total_cached_tokens": self.total_cached_tokens,
            "total_tokens": self.total_prompt_tokens + self.total_completion_tokens,
            "total_cost_chf": round(self.total_cost_chf, 6),
            "total_latency_seconds": round(self.total_latency_seconds, 2),
            "average_latency_seconds": round(avg_latency, 2),
            "history": self.history[-10:]
        }

    @staticmethod
    def get_global_telemetry() -> Dict[str, Any]:
        """Read latest telemetry snapshot directly from disk."""
        path = _track_dir / "data" / "telemetry.json"
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "model": "swiss-ai/Apertus-v1.5-8B",
            "status": "online",
            "total_requests": 0,
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0,
            "total_cached_tokens": 0,
            "total_tokens": 0,
            "total_cost_chf": 0.0,
            "average_latency_seconds": 0.0,
            "history": []
        }

