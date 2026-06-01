import socket
import json
import subprocess
import xml.etree.ElementTree as ET
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


NMAP_PATH = r"C:\Program Files (x86)\Nmap\nmap.exe"


def _nmap_scan(ip: str) -> dict:
    """Run nmap OS + service scan, return {os_guess, open_ports, services}."""
    try:
        result = subprocess.run(
            [NMAP_PATH, "-O", "-sV", "--osscan-guess", "-T4",
             "--open", "-oX", "-", ip],
            capture_output=True, text=True, timeout=60
        )
        return _parse_nmap_xml(result.stdout)
    except FileNotFoundError:
        return {"os_guess": "", "open_ports": [], "services": []}
    except Exception:
        return {"os_guess": "", "open_ports": [], "services": []}


def _parse_nmap_xml(xml_str: str) -> dict:
    os_guess = ""
    open_ports = []
    services = []
    try:
        root = ET.fromstring(xml_str)
        host = root.find("host")
        if host is None:
            return {"os_guess": os_guess, "open_ports": open_ports, "services": services}

        # OS detection
        osmatch = host.find(".//osmatch")
        if osmatch is not None:
            os_guess = osmatch.get("name", "")

        # Open ports + services
        for port in host.findall(".//port"):
            state = port.find("state")
            if state is not None and state.get("state") == "open":
                portid = int(port.get("portid", 0))
                open_ports.append(portid)
                svc = port.find("service")
                if svc is not None:
                    svc_name = svc.get("name", "")
                    svc_product = svc.get("product", "")
                    if svc_product:
                        services.append(f"{portid}/{svc_name} ({svc_product})")
                    else:
                        services.append(f"{portid}/{svc_name}")
    except ET.ParseError:
        pass
    return {"os_guess": os_guess, "open_ports": open_ports, "services": services}


def _build_description(vendor: str, os_guess: str, open_ports: list, services: list) -> str:
    if os_guess:
        # nmap gave us a real OS — use it, enriched with vendor if helpful
        os_lower = os_guess.lower()
        vendor_lower = vendor.lower()
        if "ios" in os_lower or "iphone" in os_lower or "ipad" in os_lower:
            return f"iPhone or iPad — {os_guess}"
        if "android" in os_lower:
            return f"Android device — {os_guess}"
        if "windows" in os_lower:
            return f"Windows PC — {os_guess}"
        if "mac os" in os_lower or "macos" in os_lower or "darwin" in os_lower:
            return f"Mac — {os_guess}"
        if "linux" in os_lower:
            if "raspberry" in vendor_lower:
                return f"Raspberry Pi — {os_guess}"
            return f"Linux device — {os_guess}"
        return os_guess

    # Fall back to port/vendor heuristics if nmap OS detection failed
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
    nmap = _nmap_scan(ip)
    description = _build_description(vendor, nmap["os_guess"], nmap["open_ports"], nmap["services"])
    return {
        "vendor": vendor,
        "open_ports": nmap["open_ports"],
        "services": nmap["services"],
        "os_guess": nmap["os_guess"],
        "description": description,
    }
