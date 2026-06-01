import subprocess
import socket
import re
from scapy.all import ARP, Ether, srp


def get_local_subnet() -> str:
    """Detect local subnet like 192.168.1.0/24."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
    finally:
        s.close()
    parts = local_ip.split(".")
    return f"{parts[0]}.{parts[1]}.{parts[2]}.0/24"


def _arp_scan_scapy(subnet: str) -> list[dict]:
    """ARP sweep using scapy. Requires Npcap on Windows."""
    packet = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=subnet)
    answered, _ = srp(packet, timeout=2, verbose=False)
    results = []
    for _, recv in answered:
        ip = recv.psrc
        mac = recv.hwsrc.upper()
        hostname = _resolve_hostname(ip)
        results.append({"ip": ip, "mac": mac, "hostname": hostname})
    return results


def _arp_scan_fallback(subnet: str) -> list[dict]:
    """Fallback: ping sweep + parse arp -a table."""
    base = ".".join(subnet.split(".")[:3])
    # Ping broadcast to populate ARP table
    subprocess.run(
        ["ping", "-n", "1", "-w", "500", f"{base}.255"],
        capture_output=True
    )
    result = subprocess.run(["arp", "-a"], capture_output=True, text=True)
    devices = []
    for line in result.stdout.splitlines():
        match = re.search(
            r"(\d+\.\d+\.\d+\.\d+)\s+([\da-fA-F-]{17})", line
        )
        if match:
            ip = match.group(1)
            mac = match.group(2).replace("-", ":").upper()
            if not ip.endswith(".255") and not ip.endswith(".0"):
                hostname = _resolve_hostname(ip)
                devices.append({"ip": ip, "mac": mac, "hostname": hostname})
    return devices


def _resolve_hostname(ip: str) -> str:
    try:
        return socket.gethostbyaddr(ip)[0]
    except Exception:
        return ""


def scan() -> list[dict]:
    """Return list of {ip, mac, hostname} for all devices found."""
    subnet = get_local_subnet()
    try:
        return _arp_scan_scapy(subnet)
    except Exception:
        return _arp_scan_fallback(subnet)
