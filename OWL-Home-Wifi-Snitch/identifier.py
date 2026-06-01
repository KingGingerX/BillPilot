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


PROBE_PORTS = [80, 443, 554, 7000, 8080, 8443, 8009, 9197, 62078]
PROBE_TIMEOUT = 0.5  # seconds per port


def probe_ports(ip: str) -> list[int]:
    open_ports = []
    for port in PROBE_PORTS:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(PROBE_TIMEOUT)
                if s.connect_ex((ip, port)) == 0:
                    open_ports.append(port)
        except Exception:
            pass
    return open_ports


def describe_device(vendor: str, open_ports: list[int]) -> str:
    ports = set(open_ports)

    if 62078 in ports:
        return "Likely iPhone or iPad"
    if 9197 in ports and 8009 in ports:
        return "Likely Samsung Smart TV"
    if 9197 in ports:
        return "Likely Samsung device"
    if 554 in ports:
        return "Likely IP Camera or NVR"
    if 7000 in ports:
        return "Likely Apple AirPlay device"
    if 8080 in ports or 8443 in ports:
        return "Likely smart home hub or IoT device"
    if 80 in ports and 443 in ports:
        return "Likely router or web-enabled device"
    if 80 in ports:
        return "Likely router or IoT device"

    vendor_lower = vendor.lower()
    if "apple" in vendor_lower:
        return "Apple device (Mac, iPhone, iPad, or HomePod)"
    if "samsung" in vendor_lower:
        return "Samsung device"
    if "amazon" in vendor_lower:
        return "Amazon device (Echo, Fire TV, or Kindle)"
    if "google" in vendor_lower:
        return "Google device (Chromecast, Nest, or Pixel)"
    if "raspberry" in vendor_lower:
        return "Raspberry Pi"
    if "intel" in vendor_lower or "realtek" in vendor_lower:
        return "Likely Windows PC or laptop"

    return "Unknown device type"


def identify(mac: str, ip: str) -> dict:
    vendor = lookup_vendor(mac)
    open_ports = probe_ports(ip)
    description = describe_device(vendor, open_ports)
    return {
        "vendor": vendor,
        "open_ports": open_ports,
        "description": description,
    }
