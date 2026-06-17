"""
Proxy Manager - Residential Proxy Infrastructure
Supports rotating proxies, health checks, sticky sessions,
and provider-specific URL formats (Smartproxy, IPRoyal, etc.)
"""
import logging
import random
import time
import requests
from typing import List, Dict, Optional
from dataclasses import dataclass
from urllib.parse import urlparse

logger = logging.getLogger("ProxyManager")


@dataclass
class ProxyAccount:
    name: str
    email: str
    password: str
    proxy_url: str          # http://user:pass@host:port
    sticky_session: bool = False
    session_duration: int = 600  # seconds for sticky session
    last_used: float = 0.0
    fail_count: int = 0
    healthy: bool = True
    provider: str = "generic"
    country_code: str = "us"


class ProxyManager:
    """
    Manages a pool of residential proxies with rotation,
    health monitoring, and sticky session support.
    """

    def __init__(self, accounts: List[ProxyAccount]):
        self.accounts = accounts
        self.current_index = 0
        self._session_map: Dict[str, str] = {}  # account -> session_id for sticky
        self._health_check_interval = 300  # 5 minutes
        self._last_health_check = 0

    @classmethod
    def from_profiles(cls, profiles_path: str = "referIt/accounts/profiles.json"):
        """Load proxies from profiles.json"""
        import json
        import os
        with open(profiles_path, 'r') as f:
            data = json.load(f)
        accounts = []
        for entry in data.get("accounts", []):
            proxy = entry.get("proxy", "")
            if proxy:
                accounts.append(ProxyAccount(
                    name=entry.get("name", "unknown"),
                    email=entry.get("email", ""),
                    password=entry.get("password", ""),
                    proxy_url=proxy,
                    sticky_session=entry.get("sticky_session", False),
                    provider=entry.get("provider", "generic"),
                    country_code=entry.get("country", "us")
                ))
        return cls(accounts)

    @classmethod
    def from_provider_url(cls, provider_url: str, username: str, password: str,
                         country: str = "us", session_id: Optional[str] = None,
                         count: int = 5):
        """
        Generate proxy list from provider gateway URL.
        Example: Smartproxy gateway -> rotating residential endpoints
        """
        accounts = []
        for i in range(count):
            # Generate unique session IDs for sticky rotation
            sid = session_id or f"referit_{int(time.time())}_{i}"
            proxy = f"http://{username}-session-{sid}-country-{country}:{password}@{provider_url}"
            accounts.append(ProxyAccount(
                name=f"proxy_{i+1}",
                email=f"account{i+1}@temp.com",
                password="",
                proxy_url=proxy,
                sticky_session=True,
                session_duration=600,
                provider="smartproxy" if "smartproxy" in provider_url else "iproyal"
            ))
        return cls(accounts)

    def get_next_account(self) -> Optional[ProxyAccount]:
        """Round-robin with health filtering."""
        healthy = [a for a in self.accounts if a.healthy and a.fail_count < 3]
        if not healthy:
            # Reset failures if all are down (temporary network issue)
            for a in self.accounts:
                a.fail_count = 0
                a.healthy = True
            healthy = self.accounts

        account = healthy[self.current_index % len(healthy)]
        self.current_index = (self.current_index + 1) % len(healthy)
        account.last_used = time.time()
        return account

    def get_proxy_for_selenium(self, account: ProxyAccount) -> str:
        """Return proxy URL formatted for Chrome --proxy-server arg."""
        parsed = urlparse(account.proxy_url)
        # Chrome expects host:port, auth handled separately via extension or embedded
        return f"{parsed.hostname}:{parsed.port}"

    def get_proxy_for_requests(self, account: ProxyAccount) -> Dict[str, str]:
        """Return proxy dict for Python requests library."""
        return {
            "http": account.proxy_url,
            "https": account.proxy_url
        }

    def mark_failure(self, account: ProxyAccount):
        """Increment failure count for an account."""
        account.fail_count += 1
        if account.fail_count >= 3:
            account.healthy = False
            logger.warning(f"{account.name} marked unhealthy ({account.fail_count} failures)")

    def mark_success(self, account: ProxyAccount):
        """Reset failure count on success."""
        if account.fail_count > 0:
            account.fail_count = max(0, account.fail_count - 1)

    def health_check_all(self):
        """Run health checks on all proxies."""
        now = time.time()
        if now - self._last_health_check < self._health_check_interval:
            return
        self._last_health_check = now

        logger.info("Running health checks on all proxies...")
        for account in self.accounts:
            healthy, ip = self.validate_proxy(account)
            account.healthy = healthy
            if healthy:
                account.fail_count = 0
                logger.info(f"OK {account.name} | IP: {ip}")
            else:
                logger.warning(f"FAILED {account.name}")

    def validate_proxy(self, account: ProxyAccount, timeout: int = 10) -> tuple:
        """
        Test proxy connectivity and return IP.
        Returns (success, ip_address)
        """
        proxies = self.get_proxy_for_requests(account)
        endpoints = [
            "https://api.ipify.org?format=json",
            "http://ip-api.com/json",
        ]
        for url in endpoints:
            try:
                resp = requests.get(url, proxies=proxies, timeout=timeout)
                if resp.status_code == 200:
                    data = resp.json()
                    ip = data.get("ip") or data.get("query")
                    return True, ip
            except Exception as e:
                continue
        return False, None

    def get_unique_ip_count(self) -> int:
        """Check how many unique exit IPs we have."""
        ips = set()
        for account in self.accounts:
            ok, ip = self.validate_proxy(account, timeout=5)
            if ok and ip:
                ips.add(ip)
        return len(ips)

    def stats(self) -> Dict:
        healthy = sum(1 for a in self.accounts if a.healthy)
        return {
            "total": len(self.accounts),
            "healthy": healthy,
            "unhealthy": len(self.accounts) - healthy,
            "rotation_index": self.current_index
        }
