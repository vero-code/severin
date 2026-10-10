"""
Unit tests for Dataset Downloader and Directory Limit constraints.
Track 2A - Hack Apertus 2026.
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.dataset import get_data_dir_size_bytes, MAX_DATA_DIR_BYTES


def test_directory_size_constraint():
    """Verify data directory exists and does not exceed 100 MB limit."""
    data_dir = ROOT_DIR / "data"
    total_bytes = get_data_dir_size_bytes(data_dir)
    assert total_bytes < MAX_DATA_DIR_BYTES, (
        f"CRITICAL: data directory size ({total_bytes} bytes) exceeds 100 MB limit!"
    )
    mb = total_bytes / (1024 * 1024)
    print(f"PASSED: data directory size constraint verified: {mb:.2f} MB / 100 MB limit.")


if __name__ == "__main__":
    test_directory_size_constraint()
