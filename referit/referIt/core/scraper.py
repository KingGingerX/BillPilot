"""
Nextdoor Scraper — Stealth Edition
Handles login with cookie persistence, then scans the news feed for
keyword-matching posts. Reuse a single instance within a campaign
to avoid spawning multiple Chrome processes.
"""
import hashlib
import pickle
import time
import random
import logging
from pathlib import Path
from bs4 import BeautifulSoup

from referIt.core.stealth_driver import StealthDriver
from referIt.core.proxy_mgr import ProxyManager, ProxyAccount

logger = logging.getLogger("Scraper")

COOKIE_DIR = Path("referIt/accounts/cookies")
COOKIE_DIR.mkdir(parents=True, exist_ok=True)

# Multiple selector fallbacks — Nextdoor's DOM changes regularly
POST_SELECTORS = [
    'div[data-testid="post-content"]',
    'div[data-testid="feed-post"]',
    'div[class*="post-content"]',
    'div[class*="content-body"]',
    'div[class*="feed-post"]',
    'article[class*="post"]',
    'article',
]

LOGIN_URL     = "https://nextdoor.com/login/"
NEWS_FEED_URL = "https://nextdoor.com/news_feed/"


class NextdoorScraper:
    """
    Manages a single authenticated Nextdoor session.
    Call login() once, then scan_feed() as many times as needed.
    """

    def __init__(self, account: ProxyAccount = None, proxy_manager: ProxyManager = None,
                 headless: bool = True):
        self.account = account
        self.proxy_manager = proxy_manager
        self.headless = headless
        self.driver = None
        self._logged_in = False
        self._init_driver()

    def _init_driver(self):
        proxy_str = proxy_user = proxy_pass = None
        if self.account and self.account.proxy_url:
            from urllib.parse import urlparse
            p = urlparse(self.account.proxy_url)
            proxy_str  = f"{p.hostname}:{p.port}"
            proxy_user = p.username
            proxy_pass = p.password

        self.driver = StealthDriver(
            proxy=proxy_str,
            proxy_user=proxy_user,
            proxy_pass=proxy_pass,
            headless=self.headless,
        )

    # ── Cookie persistence ─────────────────────────────────────────────────

    def _cookie_path(self) -> Path:
        name = self.account.name if self.account else "default"
        return COOKIE_DIR / f"{name}.pkl"

    def _save_cookies(self):
        try:
            with open(self._cookie_path(), "wb") as f:
                pickle.dump(self.driver.get_driver().get_cookies(), f)
        except Exception as e:
            logger.warning(f"Cookie save failed: {e}")

    def _load_cookies(self) -> bool:
        path = self._cookie_path()
        if not path.exists():
            return False
        try:
            self.driver.get_driver().get("https://nextdoor.com")
            time.sleep(2)
            with open(path, "rb") as f:
                cookies = pickle.load(f)
            for cookie in cookies:
                try:
                    self.driver.get_driver().add_cookie(cookie)
                except Exception:
                    pass
            return True
        except Exception as e:
            logger.warning(f"Cookie load failed: {e}")
            return False

    def _check_logged_in(self) -> bool:
        try:
            self.driver.get_driver().get(NEWS_FEED_URL)
            time.sleep(3)
            url = self.driver.get_driver().current_url
            return "news_feed" in url or "/feed" in url
        except Exception:
            return False

    # ── Login ──────────────────────────────────────────────────────────────

    def login(self) -> bool:
        """
        Resume via saved cookies if available; otherwise do a fresh credential login.
        Returns True if authenticated.
        """
        if not self.account:
            return False

        if self._load_cookies() and self._check_logged_in():
            logger.info(f"{self.account.name} resumed via cookies")
            self._logged_in = True
            return True

        if not self.account.email or not self.account.password:
            logger.error(f"{self.account.name} has no credentials")
            return False

        logger.info(f"{self.account.name} performing fresh login...")
        try:
            drv = self.driver.get_driver()
            # Wipe any stale/expired cookies that might interfere with the login form
            try:
                drv.delete_all_cookies()
            except Exception:
                pass
            drv.get(LOGIN_URL)
            self.driver.human_delay(2, 4)

            # Email
            for sel in ["input[name='email']", "input[type='email']",
                        "input[placeholder*='email' i]", "#id_email"]:
                try:
                    f = drv.find_element("css selector", sel)
                    f.clear()
                    self.driver.human_type(f, self.account.email)
                    break
                except Exception:
                    continue

            self.driver.human_delay(0.5, 1.5)

            # Password
            for sel in ["input[name='password']", "input[type='password']",
                        "input[placeholder*='password' i]"]:
                try:
                    f = drv.find_element("css selector", sel)
                    f.clear()
                    self.driver.human_type(f, self.account.password)
                    break
                except Exception:
                    continue

            self.driver.human_delay(0.5, 1.2)

            # Submit
            for sel in ["button[type='submit']",
                        "//button[contains(text(),'Sign in')]",
                        "//button[contains(text(),'Log in')]"]:
                try:
                    btn = (drv.find_element("xpath", sel) if sel.startswith("//")
                           else drv.find_element("css selector", sel))
                    btn.click()
                    break
                except Exception:
                    continue

            self.driver.human_delay(4, 8)

            if self._check_logged_in():
                self._save_cookies()
                logger.info(f"{self.account.name} logged in — cookies saved")
                self._logged_in = True
                if self.proxy_manager:
                    self.proxy_manager.mark_success(self.account)
                return True
            else:
                logger.error(f"{self.account.name} login FAILED — check credentials")
                if self.proxy_manager:
                    self.proxy_manager.mark_failure(self.account)
                return False

        except Exception as e:
            logger.error(f"Login error for {self.account.name}: {e}")
            if self.proxy_manager:
                self.proxy_manager.mark_failure(self.account)
            return False

    # ── Feed scanning ──────────────────────────────────────────────────────

    def scan_feed(self, keywords: list, scroll_count: int = 5) -> list:
        """
        Scan the Nextdoor news feed for posts matching any keyword.
        Requires a successful login() call first.
        """
        targets = []
        try:
            logger.info(f"Scanning feed for keywords: {keywords}")
            self.driver.get_driver().get(NEWS_FEED_URL)
            self.driver.human_delay(3, 6)

            for _ in range(scroll_count):
                self.driver.random_scroll(300, 900)
                self.driver.human_delay(1, 3)

            soup = BeautifulSoup(self.driver.get_driver().page_source, "html.parser")

            posts = []
            for selector in POST_SELECTORS:
                posts = soup.select(selector)
                if posts:
                    break

            logger.info(f"Found {len(posts)} total posts on feed")

            seen_ids: set = set()
            for post in posts:
                text = post.get_text(separator=" ", strip=True)
                if not any(kw.lower() in text.lower() for kw in keywords):
                    continue

                link_elem = post.find("a", href=True)
                link = link_elem["href"] if link_elem else None
                if link and not link.startswith("http"):
                    link = "https://nextdoor.com" + link

                # Build a stable post ID (hashlib vs Python's seeded hash())
                raw_id = (post.get("data-testid")
                          or post.get("data-id")
                          or hashlib.md5(text[:120].encode(), usedforsecurity=False).hexdigest()[:16])
                post_id = str(raw_id)

                if post_id in seen_ids:
                    continue
                seen_ids.add(post_id)

                targets.append({
                    "id":   post_id,
                    "text": text[:300],
                    "link": link,
                })

            logger.info(f"{len(targets)} posts matched keywords")
            if self.proxy_manager and self.account:
                self.proxy_manager.mark_success(self.account)

        except Exception as e:
            logger.error(f"Scan error: {e}")
            if self.proxy_manager and self.account:
                self.proxy_manager.mark_failure(self.account)

        return targets

    def close(self):
        if self.driver:
            self.driver.quit()
            self.driver = None
        self._logged_in = False
