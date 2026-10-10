"""
Unit and integration tests for OpenParlData adapter.
Verifies conversion from raw API structures and live records into ParliamentaryAffair models.
Track 2A - Hack Apertus 2026.
"""

import sys
from pathlib import Path

# Ensure track_2a root is in python path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.adapter import map_api_to_affair, map_parliament_level, map_affair_type
from src.schema import ParliamentaryAffair
from src.enums import ParliamentLevel, AffairType, LanguageCode
from src.api_client import OpenParlDataClient


def test_synthetic_mapping():
    """Test mapping logic on synthetic raw dictionary with multilingual fields."""
    raw = {
        "id": 99991,
        "short_id": "24.999",
        "body_key": "GE",
        "title": {"fr": "Protection du climat à Genève", "de": "Klimaschutz in Genf"},
        "type": {"fr": "Interpellation urgente"},
        "begin_date": "2026-05-12T14:30:00",
        "contributors": [
            {"person_name": "Claire Dupont", "role": "author", "party": "Les Verts"}
        ]
    }

    affair = map_api_to_affair(raw)
    assert isinstance(affair, ParliamentaryAffair)
    assert affair.affair_id == 99991
    assert affair.title == "Klimaschutz in Genf" or affair.title == "Protection du climat à Genève"
    assert affair.canton_or_body == "GE"
    assert affair.level == ParliamentLevel.CANTONAL
    assert affair.affair_type == AffairType.INTERPELLATION
    assert affair.language == LanguageCode.FR
    assert affair.submission_date == "2026-05-12"
    assert len(affair.authors) == 1
    assert affair.authors[0].name == "Claire Dupont"
    assert affair.authors[0].party_or_fraction == "Les Verts"
    print("PASSED: Synthetic mapping unit test.")


def test_live_api_mapping():
    """Test mapping on live records from OpenParlData API (ZH and BE)."""
    client = OpenParlDataClient(timeout=30)
    res = client.get_affairs(body_key="ZH", limit=2, expand="contributors")
    data = res.get("data", [])
    assert len(data) > 0, "No records returned from OpenParlData API"

    raw_item = data[0]
    affair = map_api_to_affair(raw_item)
    assert isinstance(affair, ParliamentaryAffair)
    assert affair.affair_id == raw_item.get("id")
    assert affair.canton_or_body == "ZH"
    assert affair.level == ParliamentLevel.CANTONAL
    assert len(affair.title) > 0

    print(f"PASSED: Live API mapping test for affair #{affair.affair_id}")
    print(f"   Title: {affair.title}")
    print(f"   Harmonized Type: {affair.affair_type.value}")
    print(f"   Authors count: {len(affair.authors)}")


def run_all():
    print("=" * 60)
    print("Running Adapter Tests...")
    print("=" * 60)
    test_synthetic_mapping()
    test_live_api_mapping()
    print("=" * 60)
    print("ALL ADAPTER TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    run_all()
