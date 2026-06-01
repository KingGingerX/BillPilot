import socket
import json
import urllib.request
from pathlib import Path

OUI_PATH = Path(__file__).parent / "oui.txt"
OUI_URL = "https://standards-oui.ieee.org/oui/oui.txt"

_oui_cache = {}


def download_oui():
    """Download IEEE OUI database. ~5MB. Called once by setup.py."""
    print("Downloading OUI database from IEEE...")
    urllib.request.urlretrieve(OUI_URL, OUI_PATH)
    print(f"OUI database saved to {OUI_PATH}")


def _load_oui():
    global _oui_cache
    if _oui_cache or not OUI_PATH.exists():
        return
    with open(OUI_PATH, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if "(hex)" in line:
                parts = line.split("(hex)")
                if len(parts) == 2:
                    prefix = parts[0].strip().replace("-", ":").upper()
                    vendor = parts[1].strip()
                    _oui_cache[prefix] = vendor


def lookup_vendor(mac: str) -> str:
    _load_oui()
    prefix = mac.upper()[:8]
    return _oui_cache.get(prefix, "Unknown Vendor")
