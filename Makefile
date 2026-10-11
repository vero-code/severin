.PHONY: run clean test benchmark dry-run build

# Forward targets to track_2a Makefile
run:
	$(MAKE) -C track_2a run

clean:
	$(MAKE) -C track_2a clean

test:
	$(MAKE) -C track_2a test

benchmark:
	$(MAKE) -C track_2a benchmark

dry-run:
	$(MAKE) -C track_2a dry-run

build:
	$(MAKE) -C track_2a build
