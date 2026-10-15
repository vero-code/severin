.PHONY: run benchmark dry-run test build clean

VENV_PYTHON := $(firstword $(wildcard .venv/Scripts/python.exe) $(wildcard .venv/bin/python))
PYTHON ?= $(if $(VENV_PYTHON),$(VENV_PYTHON),python)

# Official HackApertus jury entrypoint
# Executes end-to-end benchmark in Docker and starts services
run:
	@echo "Starting SEVERIN Track 2A in Docker container..."
	docker compose up --build

# Run benchmark directly in local Python environment (auto detects CSCS API key or dry-run)
benchmark:
	$(PYTHON) -X utf8 src/benchmark.py --mode auto

# Run offline dry-run benchmark (zero network required, physical PDF validation)
dry-run:
	$(PYTHON) -X utf8 src/benchmark.py --dry-run

# Run automated test suite
test:
	$(PYTHON) -X utf8 tests/test_schema.py
	$(PYTHON) -X utf8 tests/test_extractor.py
	$(PYTHON) -X utf8 tests/test_adapter.py
	$(PYTHON) -X utf8 tests/test_pdf_parser.py
	$(PYTHON) -X utf8 tests/test_cscs_client.py
	$(PYTHON) -X utf8 tests/test_dataset.py

build:
	docker compose build

clean:
	docker compose down
