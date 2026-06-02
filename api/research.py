"""
Vercel Python serverless function — POST /api/research
Runs automated web search then calls Claude to produce the investor brief.
"""
from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

# Allow imports from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from debt_bot.investor_research import InvestorQuery, research_investor  # noqa: E402


def _cors(handler: "handler") -> None:
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self) -> None:
        self.send_response(200)
        _cors(self)
        self.end_headers()

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)

        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            self._json(400, {"error": "Invalid JSON body"})
            return

        try:
            query = InvestorQuery(
                investor_name=body.get("investor_name", ""),
                firm_or_affiliation=body.get("firm", ""),
                your_venture_name=body.get("venture_name", ""),
                your_venture_description=body.get("venture_description", ""),
                your_sector=body.get("sector", ""),
                your_stage=body.get("stage", "Seed"),
                why_good_cause=body.get("mission", ""),
                additional_investor_notes=body.get("investor_notes", ""),
            )
        except Exception as exc:
            self._json(400, {"error": f"Validation error: {exc}"})
            return

        # Optional live web search — graceful fallback if unavailable
        web_context = ""
        if body.get("enable_web_search", True):
            try:
                from debt_bot.web_search import search_investor_web
                web_context = search_investor_web(
                    name=query.investor_name,
                    firm=query.firm_or_affiliation,
                    extra_notes=query.additional_investor_notes,
                )
            except Exception:
                pass  # proceed with Claude training knowledge only

        try:
            data = research_investor(query, web_context)
            self._json(200, data)
        except RuntimeError as exc:
            self._json(500, {"error": str(exc)})
        except Exception as exc:
            self._json(500, {"error": f"Unexpected error: {exc}"})

    def _json(self, status: int, data: dict) -> None:
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        _cors(self)
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_) -> None:
        pass  # silence default access logs
