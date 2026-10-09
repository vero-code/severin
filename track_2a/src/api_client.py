"""
OpenParlData API Client (OpenAPI 3.1 Specification Compliant).

Provides an interface to query Swiss parliamentary data from
https://api.openparldata.ch/v1
Includes advanced search modes (partial, exact, natural, boolean),
filtering across 97 bodies, document retrieval, and cross-cantonal queries.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
import requests

try:
    from .enums import SearchMode, LanguageCode, LangFormat, SearchScope
except ImportError:
    from enums import SearchMode, LanguageCode, LangFormat, SearchScope

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("openparldata_client")


class OpenParlDataClient:
    """Production-grade client for the OpenParlData REST API."""

    BASE_URL = "https://api.openparldata.ch/v1"

    def __init__(self, timeout: int = 30):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "HackApertus-Track2A-Client/1.1",
            "Accept": "application/json"
        })
        self.timeout = timeout

    def get_bodies(self, indexed_only: bool = True, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Fetch all parliamentary bodies (Federal Assembly, 26 cantons, municipal councils).
        """
        url = f"{self.BASE_URL}/bodies/"
        params = {"indexed": str(indexed_only).lower(), "limit": limit}
        try:
            resp = self.session.get(url, params=params, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json().get("data", [])
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout while fetching bodies after {self.timeout}s")
            return []

    def get_affairs(
        self,
        body_key: Optional[str] = None,
        limit: int = 10,
        offset: int = 0,
        expand: str = "docs",
        sort_by: str = "-begin_date",
        search: Optional[str] = None,
        search_mode: Union[SearchMode, str] = SearchMode.PARTIAL,
        search_scope: Optional[Union[SearchScope, str]] = None,
        search_language: Optional[Union[LanguageCode, str]] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        status: Optional[str] = None,
        lang: Optional[Union[LanguageCode, str]] = None,
        lang_format: Union[LangFormat, str] = LangFormat.NESTED,
        exclude_null: Optional[str] = None,
        hide_null: bool = False
    ) -> Dict[str, Any]:
        """
        Fetch parliamentary affairs with advanced filtering and search capabilities.

        :param body_key: Filter by canton/body code, e.g. 'CHE', 'ZH', 'GR', 'GE'
        :param limit: Page size (1 to 1000)
        :param offset: Pagination offset
        :param expand: Relations to expand: 'docs', 'events', 'contributors', or '*'
        :param sort_by: Sort expression, e.g. '-begin_date', 'number'
        :param search: Search query string
        :param search_mode: SearchMode enum or str ('partial', 'exact', 'natural', 'boolean')
        :param search_scope: SearchScope enum or str ('metadata', 'docs', 'texts', etc.)
        :param search_language: LanguageCode enum or str ('de', 'fr', 'it', 'rm', 'en')
        :param date_from: ISO date YYYY-MM-DD
        :param date_to: ISO date YYYY-MM-DD
        :param status: Filter by affair status (e.g. 'active')
        :param lang: LanguageCode enum or str
        :param lang_format: LangFormat enum or str ('nested', 'flat')
        :param exclude_null: Comma-separated fields that must not be null
        :param hide_null: Remove empty/null properties from response
        """
        def _to_val(v):
            return v.value if hasattr(v, "value") else str(v)

        url = f"{self.BASE_URL}/affairs/"
        params: Dict[str, Any] = {
            "limit": limit,
            "offset": offset,
            "expand": expand,
            "sort_by": sort_by,
            "lang_format": _to_val(lang_format)
        }

        if body_key:
            params["body_key"] = body_key
        if search:
            params["search"] = search
            params["search_mode"] = _to_val(search_mode)
            if search_scope:
                params["search_scope"] = _to_val(search_scope)
            if search_language:
                params["search_language"] = _to_val(search_language)
        if date_from:
            params["date_from"] = date_from
        if date_to:
            params["date_to"] = date_to
        if status:
            params["status"] = status
        if lang:
            params["lang"] = _to_val(lang)
        if exclude_null:
            params["exclude_null"] = exclude_null
        if hide_null:
            params["hide_null"] = "true"

        try:
            resp = self.session.get(url, params=params, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout while querying affairs after {self.timeout}s")
            return {"data": [], "meta": {"total_records": 0}}
        except Exception as e:
            logger.error(f"Error fetching affairs: {e}")
            return {"data": [], "meta": {"total_records": 0}}

    def get_affair_by_id(
        self,
        affair_id: int,
        expand: str = "docs,contributors,events"
    ) -> Dict[str, Any]:
        """Fetch full record of a single parliamentary affair."""
        url = f"{self.BASE_URL}/affairs/{affair_id}"
        params = {"expand": expand}
        resp = self.session.get(url, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def get_docs(
        self,
        affair_id: Optional[int] = None,
        body_key: Optional[str] = None,
        limit: int = 10,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Query individual documents metadata and links."""
        url = f"{self.BASE_URL}/docs/"
        params: Dict[str, Any] = {"limit": limit, "offset": offset}
        if affair_id:
            params["affair_id"] = affair_id
        if body_key:
            params["body_key"] = body_key

        resp = self.session.get(url, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def search_cross_cantonal(
        self,
        query: str,
        body_keys: List[str],
        limit_per_body: int = 3,
        search_mode: Union[SearchMode, str] = SearchMode.NATURAL
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Cross-parliamentary thematic search.
        Queries multiple cantons/levels for the same topic to facilitate cross-cantonal comparison.
        """
        results: Dict[str, List[Dict[str, Any]]] = {}
        for body in body_keys:
            data = self.get_affairs(
                body_key=body,
                search=query,
                search_mode=search_mode,
                search_scope="metadata,docs",
                limit=limit_per_body,
                expand="docs"
            )
            results[body] = data.get("data", [])
        return results

    def download_pdf(self, url: str, target_path: Path) -> bool:
        """Download binary PDF from openparldata file servers."""
        try:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            resp = self.session.get(url, stream=True, timeout=30)
            resp.raise_for_status()
            with open(target_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            logger.info(f"Downloaded PDF: {target_path.name} ({target_path.stat().st_size / 1024:.1f} KB)")
            return True
        except Exception as e:
            logger.error(f"Failed to download {url}: {e}")
            if target_path.exists():
                target_path.unlink()
            return False


if __name__ == "__main__":
    client = OpenParlDataClient()

    print("=" * 65)
    print("DEMO 1: Fetching available bodies")
    print("=" * 65)
    bodies = client.get_bodies(limit=5)
    for b in bodies:
        print(f"[{b.get('body_key')}] {b.get('name', {}).get('de') or b.get('body_key')} | Seats: {b.get('legislative_seats')}")

    print("\n" + "=" * 65)
    print("DEMO 2: Cross-cantonal Natural Language Search ('Klima Umwelt')")
    print("=" * 65)
    test_cantons = ["GR", "ZH", "GE"]
    cross_results = client.search_cross_cantonal(
        query="Klima Umwelt",
        body_keys=test_cantons,
        limit_per_body=1,
        search_mode="natural"
    )

    for canton, affairs in cross_results.items():
        print(f"\n--- Canton [{canton}] Results ({len(affairs)} found) ---")
        for aff in affairs:
            title = aff.get("title", {}).get("de") or aff.get("title", {}).get("fr") or str(aff.get("title"))
            docs = aff.get("docs", {}).get("data", [])
            print(f"Affair #{aff.get('number')} (ID: {aff.get('id')}): {title[:75]}...")
            print(f"Docs attached: {len(docs)}")
            for d in docs[:2]:
                pdf_link = d.get("url_oparl") or d.get("url")
                print(f"   -> PDF: {d.get('name')}")
                print(f"      Direct Download URL: {pdf_link}")

    print("\n" + "=" * 65)
    print("DEMO 3: Boolean search in Zurich ('Budget & Finanzen')")
    print("=" * 65)
    bool_res = client.get_affairs(
        body_key="ZH",
        search="Budget & Finanzen",
        search_mode="boolean",
        search_scope="metadata,docs",
        limit=2,
        expand="docs"
    )
    for item in bool_res.get("data", []):
        title = item.get("title", {}).get("de") if isinstance(item.get("title"), dict) else str(item.get("title"))
        docs = item.get("docs", {}).get("data", [])
        print(f"\nAffair ID: {item.get('id')} [{item.get('body_key')}]: {title[:70]}...")
        for d in docs[:2]:
            pdf_link = d.get("url_oparl") or d.get("url")
            print(f"   -> PDF: {d.get('name')}")
            print(f"      Direct Download URL: {pdf_link}")
