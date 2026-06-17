"""
Stealth Selenium Driver
Bypasses common bot-detection vectors on modern sites (webdriver flag,
consistent fingerprints, headless UA strings, CDP artifacts).
"""
import json
import random
import time
import os
import tempfile
import zipfile
from typing import Optional
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

VIEWPORTS = [
    (1920, 1080), (1366, 768), (1440, 900), (1536, 864),
    (1280, 720), (1600, 900), (1680, 1050), (2560, 1440),
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
]

LOCALES = ["en-US", "en-GB", "en-CA", "en-AU"]
TIMEZONES = [
    "America/New_York", "America/Chicago", "America/Denver",
    "America/Los_Angeles", "America/Phoenix", "America/Detroit",
]


class StealthDriver:
    """Anti-detection Chrome wrapper for residential proxy automation."""

    def __init__(self, proxy: Optional[str] = None, proxy_user: Optional[str] = None,
                 proxy_pass: Optional[str] = None, headless: bool = True):
        self.proxy = proxy
        self.proxy_user = proxy_user
        self.proxy_pass = proxy_pass
        self.headless = headless
        self.driver = None
        self._init_driver()

    def _build_proxy_auth_ext(self, host: str, port: str, user: str, pwd: str) -> str:
        """
        Build a temporary Chrome extension zip that handles proxy authentication.
        Chrome ignores credentials in --proxy-server; this extension intercepts
        the auth challenge and injects them automatically.
        Returns the path to the .zip file.
        """
        manifest = json.dumps({
            "version": "1.0.0",
            "manifest_version": 2,
            "name": "Proxy Auth",
            "permissions": ["proxy", "tabs", "unlimitedStorage", "storage",
                            "<all_urls>", "webRequest", "webRequestBlocking"],
            "background": {"scripts": ["background.js"]},
            "minimum_chrome_version": "22.0.0"
        })
        background = f"""
var config = {{
    mode: "fixed_servers",
    rules: {{
        singleProxy: {{ scheme: "http", host: "{host}", port: parseInt("{port}") }},
        bypassList: ["localhost"]
    }}
}};
chrome.proxy.settings.set({{value: config, scope: "regular"}}, function(){{}});
chrome.webRequest.onAuthRequired.addListener(
    function(details) {{
        return {{ authCredentials: {{ username: "{user}", password: "{pwd}" }} }};
    }},
    {{urls: ["<all_urls>"]}},
    ["blocking"]
);
"""
        tmpdir = tempfile.mkdtemp()
        ext_path = os.path.join(tmpdir, "proxy_auth.zip")
        with zipfile.ZipFile(ext_path, "w") as zf:
            zf.writestr("manifest.json", manifest)
            zf.writestr("background.js", background)
        return ext_path

    def _init_driver(self):
        options = Options()

        if self.headless:
            options.add_argument("--headless=new")
            options.add_argument("--disable-gpu")

        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-setuid-sandbox")

        w, h = random.choice(VIEWPORTS)
        options.add_argument(f"--window-size={w},{h}")

        ua = random.choice(USER_AGENTS)
        options.add_argument(f"--user-agent={ua}")

        locale = random.choice(LOCALES)
        options.add_argument(f"--lang={locale}")
        options.add_experimental_option("prefs", {"intl.accept_languages": locale})

        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        if self.proxy:
            if self.proxy_user and self.proxy_pass:
                # Parse host:port from proxy string
                parts = self.proxy.split(":")
                host = parts[0]
                port = parts[1] if len(parts) > 1 else "8080"
                ext_path = self._build_proxy_auth_ext(host, port, self.proxy_user, self.proxy_pass)
                options.add_extension(ext_path)
            else:
                options.add_argument(f"--proxy-server={self.proxy}")

        options.add_argument("--disable-web-security")
        options.add_argument("--disable-features=IsolateOrigins,site-per-process")

        chromedriver_path = os.environ.get("CHROMEDRIVER_PATH", "")
        if chromedriver_path and os.path.exists(chromedriver_path):
            self.driver = webdriver.Chrome(service=Service(chromedriver_path), options=options)
        else:
            try:
                from webdriver_manager.chrome import ChromeDriverManager
                self.driver = webdriver.Chrome(
                    service=Service(ChromeDriverManager().install()), options=options
                )
            except Exception:
                self.driver = webdriver.Chrome(options=options)

        # Remove webdriver fingerprint + canvas/WebGL noise
        self.driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": """
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
                Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
                window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){}, app: {} };

                // Canvas noise
                const origGetContext = HTMLCanvasElement.prototype.getContext;
                HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                    const ctx = origGetContext.call(this, type, ...args);
                    if (type === '2d') {
                        const origGetImageData = ctx.getImageData;
                        ctx.getImageData = function(...a) {
                            const d = origGetImageData.apply(this, a);
                            for (let i = 0; i < d.data.length; i += 97)
                                d.data[i] ^= (Math.random() * 3 | 0);
                            return d;
                        };
                    }
                    return ctx;
                };

                // WebGL fingerprint noise
                const origGetParam = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(param) {
                    if (param === 37446) return 'Intel Inc.';
                    if (param === 37445) return 'Intel Iris OpenGL Engine';
                    return origGetParam.call(this, param);
                };
                const origGetParam2 = WebGL2RenderingContext.prototype.getParameter;
                if (origGetParam2) {
                    WebGL2RenderingContext.prototype.getParameter = function(param) {
                        if (param === 37446) return 'Intel Inc.';
                        if (param === 37445) return 'Intel Iris OpenGL Engine';
                        return origGetParam2.call(this, param);
                    };
                }
            """
        })

        self.driver.execute_cdp_cmd(
            "Emulation.setTimezoneOverride",
            {"timezoneId": random.choice(TIMEZONES)}
        )

    def get_driver(self):
        return self.driver

    def human_type(self, element, text: str):
        """Type text character-by-character with randomised delays."""
        for char in text:
            element.send_keys(char)
            time.sleep(random.uniform(0.04, 0.20))
        # Occasional mid-word pause
        if random.random() < 0.15:
            time.sleep(random.uniform(0.3, 0.8))

    def random_mouse_move(self):
        try:
            from selenium.webdriver.common.action_chains import ActionChains
            ac = ActionChains(self.driver)
            ac.move_by_offset(random.randint(50, 600), random.randint(50, 400)).perform()
        except Exception:
            pass

    def random_scroll(self, min_px: int = 200, max_px: int = 800):
        try:
            px = random.randint(min_px, max_px)
            self.driver.execute_script(f"window.scrollBy(0, {px});")
        except Exception:
            pass

    def human_delay(self, min_sec: float = 1.5, max_sec: float = 4.0):
        time.sleep(random.uniform(min_sec, max_sec))

    def quit(self):
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None
