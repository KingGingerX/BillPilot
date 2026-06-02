from __future__ import annotations

import re
import time
from typing import Callable, Optional

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

_FETCH_TIMEOUT = 8
_MAX_PAGE_CHARS = 3000
_HIGH_VALUE_DOMAINS = {
    "crunchbase.com", "angel.co", "angellist.com", "linkedin.com",
    "techcrunch.com", "forbes.com", "businessinsider.com",
    "venturebeat.com", "inc.com", "fastcompany.com",
}


def _clean_html(html: str) -> str:
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer", "aside",
                          "form", "noscript", "iframe", "svg"]):
            tag.decompose()
        text = soup.get_text(separator=" ")
        return re.sub(r"\s{2,}", " ", text).strip()
    except Exception:
        return ""


def _fetch_page(url: str) -> str:
    """Fetch a URL and return up to _MAX_PAGE_CHARS of cleaned text."""
    try:
        import requests
        resp = requests.get(url, headers=_HEADERS, timeout=_FETCH_TIMEOUT, allow_redirects=True)
        ct = resp.headers.get("content-type", "")
        if resp.status_code == 200 and "text/html" in ct:
            return _clean_html(resp.text)[:_MAX_PAGE_CHARS]
    except Exception:
        pass
    return ""


def search_investor_web(
    name: str,
    firm: str = "",
    extra_notes: str = "",
    on_progress: Optional[Callable[[str], None]] = None,
) -> str:
    """
    Search the web for an angel investor and return aggregated research text
    ready to pass to Claude as grounding context.

    Uses DuckDuckGo (no API key needed). Falls back gracefully if unavailable.
    """
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        return (
            "⚠ Web search unavailable — install duckduckgo-search.\n"
            "Claude will rely on training knowledge only."
        )

    name_q = f'"{name}"'
    firm_part = f' "{firm}"' if firm.strip() else ""

    queries = [
        f"{name_q}{firm_part} angel investor portfolio investments",
        f"{name_q} investor thesis what I look for in startups",
        f"{name_q} startup investor interview advice founders",
    ]

    sections: list[str] = []
    seen_urls: set[str] = set()
    all_urls: list[str] = []
    priority_urls: list[str] = []

    if extra_notes.strip():
        sections.append("=== USER-PROVIDED NOTES ===")
        sections.append(extra_notes.strip())
        sections.append("")

    # ── Web search ────────────────────────────────────────────────────────────
    with DDGS() as ddgs:
        for query in queries:
            if on_progress:
                on_progress(f"Searching: {query[:65]}…")
            try:
                results = list(ddgs.text(query, max_results=5))
                if results:
                    sections.append(f"=== SEARCH RESULTS: {query} ===")
                    for r in results:
                        url = r.get("href", "")
                        title = r.get("title", "")
                        body = r.get("body", "")
                        sections.append(f"• {title}")
                        if url:
                            sections.append(f"  URL: {url}")
                        if body:
                            sections.append(f"  {body}")
                        sections.append("")
                        if url and url not in seen_urls:
                            seen_urls.add(url)
                            domain = re.sub(r"https?://(www\.)?", "", url).split("/")[0]
                            if any(hd in domain for hd in _HIGH_VALUE_DOMAINS):
                                priority_urls.append(url)
                            else:
                                all_urls.append(url)
                time.sleep(0.4)
            except Exception as exc:
                sections.append(f"Search error for '{query}': {exc}")

    # ── Page fetching ─────────────────────────────────────────────────────────
    fetch_order = priority_urls + all_urls
    fetched = 0
    for url in fetch_order:
        if fetched >= 3:
            break
        # Skip social media that blocks scraping
        if any(x in url for x in ["twitter.com", "x.com", "instagram.com", "facebook.com"]):
            continue
        if on_progress:
            on_progress(f"Reading page: {url[:65]}…")
        content = _fetch_page(url)
        if content and len(content) > 150:
            sections.append(f"=== PAGE CONTENT: {url} ===")
            sections.append(content)
            sections.append("")
            fetched += 1

    return "\n".join(sections) if sections else "No web search results found."
