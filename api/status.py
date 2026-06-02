"""GET /api/status — returns whether ANTHROPIC_API_KEY is configured."""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):

    def do_GET(self) -> None:
        ok = bool(os.getenv("ANTHROPIC_API_KEY", "").startswith("sk-"))
        payload = json.dumps({"ok": ok}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_) -> None:
        pass
