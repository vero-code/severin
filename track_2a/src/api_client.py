"""
OpenParlData API Client.

Provides an interface to query Swiss parliamentary data from
https://api.openparldata.ch/v1
Includes methods for searching affairs, fetching documents, and querying parliaments.
"""

import json
import logging
from typing import Dict, Any, List, Optional
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("openparldata_client")


class OpenParlDataClient:
    """Client for interacting with OpenParlData REST API."""

    BASE_URL = "https://api.openparldata.ch/v1"

    def __init__(self, timeout: int = 15):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "HackApertus-Track2A-Client/1.0",
            "Accept": "application/json"
        })
        self.timeout = timeout

    def get_bodies(self, indexed_only: bool = True) -> List[Dict[str, Any]]:
        """
        Get all parliamentary bodies (Federal, cantons, municipalities).
        Example: CHE (Federal), ZH (Zurich), GR (Graubünden), GE (Geneva), etc.
        """
        url = f"{self.BASE_URL}/bodies/"
        params = {"indexed": str(indexed_only).lower(), "limit": 100}
        resp = self.session.get(url, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json().get("data", [])

    def get_affairs(
        self,
        body_key: Optional[str] = None,
        limit: int = 5,
        offset: int = 0,
        expand: str = "docs",
        sort_by: str = "-begin_date",
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetch a list of parliamentary affairs with optional filtering by body_key or search term.
        `expand='docs'` includes attached PDF documents and their text.
        """
        url = f"{self.BASE_URL}/affairs/"
        params: Dict[str, Any] = {
            "limit": limit,
            "offset": offset,
            "expand": expand,
            "sort_by": sort_by
        }
        if body_key:
            params["body_key"] = body_key
        if search:
            params["search"] = search

        resp = self.session.get(url, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def get_affair_by_id(self, affair_id: int, expand: str = "docs,contributors,events") -> Dict[str, Any]:
        """Fetch a single affair by its ID with all related documents and authors."""
        url = f"{self.BASE_URL}/affairs/{affair_id}"
        params = {"expand": expand}
        resp = self.session.get(url, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()


if __name__ == "__main__":
    client = OpenParlDataClient()

    print("=" * 60)
    print("1. Fetching available parliamentary bodies (cantons & federal):")
    print("=" * 60)
    bodies = client.get_bodies()
    print(f"Total available bodies: {len(bodies)}")
    for b in bodies[:5]:
        name = b.get("name", {}).get("de") or b.get("name", {}).get("fr") or b.get("body_key")
        print(f" - [{b.get('body_key')}] {name} (Level: {b.get('canton') or 'Federal'})")

    print("\n" + "=" * 60)
    print("2. Fetching recent 2 affairs from Canton Graubünden (GR) with PDFs:")
    print("=" * 60)
    result = client.get_affairs(body_key="GR", limit=2, expand="docs")
    affairs = result.get("data", [])
    print(f"Records returned: {len(affairs)}")

    for affair in affairs:
        title = affair.get("title", {}).get("de") or str(affair.get("title"))
        affair_id = affair.get("id")
        affair_num = affair.get("number")
        docs = affair.get("docs", {}).get("data", [])

        print(f"\nAffair ID: {affair_id} | Number: {affair_num}")
        print(f"Title: {title}")
        print(f"Attached Documents (PDFs): {len(docs)}")
        for doc in docs[:2]:
            doc_name = doc.get("name")
            pdf_url = doc.get("url_oparl") or doc.get("url")
            lang = doc.get("language")
            print(f"   -> Document [{lang}]: {doc_name}")
            print(f"      PDF URL: {pdf_url}")
