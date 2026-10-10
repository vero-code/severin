"""
Unit and Integration tests for CSCS Inference API Client (Rule 5).
Validates endpoint configuration, temperature determinism, and telemetry tracking.
Track 2A - Hack Apertus 2026.
Uses standard Python library (no pytest dependency required).
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Ensure .env is loaded before running tests
_env_path = ROOT_DIR / ".env"
if _env_path.exists():
    load_dotenv(dotenv_path=_env_path)
else:
    load_dotenv()

from src.cscs_client import CSCSInferenceClient


def test_missing_api_key_raises_error():
    """Ensure the client refuses to start without an API key to avoid silent failures."""
    orig = os.environ.get("CSCS_INFERENCE_API_KEY")
    try:
        os.environ.pop("CSCS_INFERENCE_API_KEY", None)
        try:
            CSCSInferenceClient()
            raise AssertionError("Client should have raised ValueError when API key is missing!")
        except ValueError as e:
            assert "CSCS_INFERENCE_API_KEY is not set" in str(e)
            print("PASSED: test_missing_api_key_raises_error")
    finally:
        if orig is not None:
            os.environ["CSCS_INFERENCE_API_KEY"] = orig


def test_client_configuration_and_defaults():
    """Ensure correct default parameters conforming to Hack Apertus Rule 5."""
    orig = os.environ.get("CSCS_INFERENCE_API_KEY")
    tmp_telemetry = ROOT_DIR / "data" / "test_isolated_telemetry.json"
    if tmp_telemetry.exists():
        tmp_telemetry.unlink()
    try:
        os.environ["CSCS_INFERENCE_API_KEY"] = "test-secret-key-12345"
        client = CSCSInferenceClient(telemetry_path=tmp_telemetry)

        # Rule 5 assertions
        assert client.base_url == "https://api.inference.cscs.ch/v1"
        assert client.default_model == "swiss-ai/Apertus-v1.5-8B"
        assert client.FIXED_TEMPERATURE == 0.0

        # Telemetry initial state
        summary = client.get_telemetry_summary()
        assert summary["total_requests"] == 0
        assert summary["total_tokens"] == 0
        assert summary["total_cached_tokens"] == 0
        assert summary["total_cost_chf"] == 0.0
        assert summary["average_latency_seconds"] == 0.0

        print("PASSED: test_client_configuration_and_defaults")
    finally:
        if tmp_telemetry.exists():
            tmp_telemetry.unlink()
        if orig is not None:
            os.environ["CSCS_INFERENCE_API_KEY"] = orig
        else:
            os.environ.pop("CSCS_INFERENCE_API_KEY", None)


def test_live_cscs_inference_if_key_available():
    """
    Live smoke test executed only if CSCS_INFERENCE_API_KEY is configured in the environment.
    Queries /v1/models to verify network connectivity to CSCS.
    """
    live_key = os.getenv("CSCS_INFERENCE_API_KEY")
    if not live_key or live_key.startswith("test-"):
        print("\n[INFO] Live CSCS test skipped: CSCS_INFERENCE_API_KEY is not configured.")
        return

    print("\n" + "=" * 60)
    print("Executing live test against CSCS endpoint: https://api.inference.cscs.ch/v1...")
    print("=" * 60)

    client = CSCSInferenceClient(api_key=live_key)
    models = client.list_models()

    print(f"Available CSCS models ({len(models)}): {models}")
    assert any("Apertus" in m for m in models), "Swiss-AI Apertus model not found in CSCS models list!"

    # Execute deterministic ping completion
    result = client.chat_completion(
        messages=[{"role": "user", "content": "Respond with the word 'OK'."}],
        max_tokens=10,
        task="CSCS Smoke Test (Ping)",
        canton="CSCS"
    )
    print(f"CSCS response: '{result['content'].strip()}' in {result['latency_sec']:.2f}s")
    assert result["content"], "Empty response received from CSCS model!"
    assert result["prompt_tokens"] > 0
    assert result["total_tokens"] > 0

    print("=" * 60)
    print("LIVE CSCS INFERENCE TEST PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    print("=" * 60)
    print("Testing CSCS Inference Client (Rule 5 compliance)...")
    print("=" * 60)
    test_missing_api_key_raises_error()
    test_client_configuration_and_defaults()
    test_live_cscs_inference_if_key_available()
    print("=" * 60)
    print("ALL CSCS CLIENT TESTS PASSED!")
    print("=" * 60)
