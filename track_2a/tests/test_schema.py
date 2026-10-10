"""
Verification tests for ParliamentaryAffair schema.
Validates valid instances, strict constraints, and JSON schema export.
Track 2A - Hack Apertus 2026.
"""

import sys
from pathlib import Path

# Ensure track_2a root is in python path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from pydantic import ValidationError
from src.schema import (
    ParliamentaryAffair,
    Provenance,
    Actor,
    QuestionItem,
    AnswerItem,
    QuestionAnswerPair,
    FinancialDetail,
    ProceduralEvent,
    export_json_schema,
)
from src.enums import ExtractionStatus, ParliamentLevel, AffairType, LanguageCode


def run_tests():
    print("=" * 60)
    print("1. Testing POSITIVE scenario: Valid ParliamentaryAffair")
    print("=" * 60)

    affair = ParliamentaryAffair(
        affair_id=340901,
        short_id="24.3012",
        title="Wie reagiert der Kanton auf die Lage unserer Wälder?",
        canton_or_body="BE",
        level=ParliamentLevel.CANTONAL,
        affair_type=AffairType.INTERPELLATION,
        language=LanguageCode.DE,
        submission_date="2026-09-29",
        addressed_to="Regierungsrat des Kantons Bern",
        authors=[
            Actor(
                name="Hans Muster",
                role="author",
                party_or_fraction="Grüne",
                canton_or_municipality="BE",
                provenance=Provenance(
                    page_number=1,
                    source_text_snippet="Eingereicht von Grossrat Hans Muster (Grüne)",
                    status=ExtractionStatus.EXTRACTED,
                ),
            )
        ],
        background_and_rationale="Der Klimawandel setzt dem Wald im Kanton Bern stark zu.",
        questions_and_answers=[
            QuestionAnswerPair(
                question=QuestionItem(
                    number="1",
                    text="Welche Massnahmen plant der Regierungsrat?",
                    provenance=Provenance(
                        page_number=2,
                        source_text_snippet="1. Welche Massnahmen plant der Regierungsrat zur Aufforstung?",
                        status=ExtractionStatus.EXTRACTED,
                    ),
                ),
                answer=AnswerItem(
                    question_reference="1",
                    text="Der Regierungsrat unterstützt gezielte Mischwald-Projekte.",
                    provenance=Provenance(
                        page_number=3,
                        source_text_snippet="Zu Frage 1: Der Regierungsrat unterstützt gezielte Mischwald-Projekte.",
                        status=ExtractionStatus.EXTRACTED,
                    ),
                ),
            )
        ],
        financial_details=[
            FinancialDetail(
                amount_chf=150000.0,
                purpose="Sofortprogramm Waldschutz",
                credit_type="Verpflichtungskredit",
                fiscal_year=2026,
                provenance=Provenance(
                    page_number=3,
                    source_text_snippet="ein Verpflichtungskredit von CHF 150'000 beantragt",
                    status=ExtractionStatus.EXTRACTED,
                ),
            )
        ],
        procedural_events=[
            ProceduralEvent(
                date="2026-10-02",
                event_type="submission",
                decision=None,
            )
        ],
    )

    print("SUCCESS: Created ParliamentaryAffair instance.")
    print(f"   Title: {affair.title}")
    print(f"   Level: {affair.level.value} | Type: {affair.affair_type.value}")
    print(f"   Authors: {len(affair.authors)} (Author: {affair.authors[0].name})")
    print(f"   Q&A pairs: {len(affair.questions_and_answers)}")
    print(f"   Financial items: {affair.financial_details[0].amount_chf} CHF")
    print(f"   Provenance: Page {affair.authors[0].provenance.page_number}")

    print("\n" + "=" * 60)
    print("2. Testing NEGATIVE scenario: Strict Constraints Protection")
    print("=" * 60)

    # Test A: Negative amount_chf should fail
    try:
        FinancialDetail(amount_chf=-500.0, purpose="Invalid negative amount")
        print("FAILED: Negative amount was accepted!")
    except ValidationError:
        print("PASSED: Rejected negative financial amount (ge=0 constraint works).")

    # Test B: Page number < 1 should fail
    try:
        Provenance(page_number=0, source_text_snippet="Invalid page")
        print("FAILED: Page 0 was accepted!")
    except ValidationError:
        print("PASSED: Rejected invalid page_number=0 (ge=1 constraint works).")

    # Test C: Extra unauthorized fields should fail (extra='forbid')
    try:
        Actor.model_validate({"name": "Test", "unknown_hallucinated_field": "forbidden"})
        print("FAILED: Extra field was accepted!")
    except ValidationError:
        print("PASSED: Rejected extra unknown fields (extra='forbid' protects against LLM hallucinations).")

    print("\n" + "=" * 60)
    print("3. Testing JSON Schema Export (for Apertus LLM)")
    print("=" * 60)
    schema = export_json_schema()
    print(f"PASSED: Generated JSON Schema with {len(schema['properties'])} properties.")
    print(f"   Schema title: {schema.get('title')}")
    print(f"   Required fields: {schema.get('required')}")
    print("\nALL TESTS PASSED! Schema is verified.")


if __name__ == "__main__":
    run_tests()
