.PHONY: run benchmark dry-run test build clean

# Official HackApertus jury entrypoint
# Executes end-to-end benchmark in Docker and starts services
run:
	@echo "Starting SEVERIN Track 2A in Docker container..."
	docker compose up --build

# Run benchmark directly in local Python environment (auto detects CSCS API key or dry-run)
benchmark:
	python -X utf8 src/benchmark.py --mode auto

# Run offline dry-run benchmark (zero network required, physical PDF validation)
dry-run:
	python -X utf8 src/benchmark.py --dry-run

# Run automated test suite
test:
	python -X utf8 tests/test_schema.py
	python -X utf8 tests/test_extractor.py

build:
	docker compose build

clean:
	docker compose down
