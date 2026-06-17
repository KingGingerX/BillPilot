"""
Comment Bot — Stealth Edition
Orchestrates campaign runs: scan feed → deduplicate → post comments.
Reuses the scraper's browser session within a campaign (one Chrome process per run).
"""
import time
import random
import json
import logging

from referIt.core.scraper import NextdoorScraper
from referIt.core.proxy_mgr import ProxyManager, ProxyAccount
from referIt.core import db, ai_writer

logger = logging.getLogger("CommentBot")

COMMENT_SELECTORS = [
    "div[contenteditable='true']",
    "div[role='textbox']",
    "textarea[placeholder*='comment' i]",
    "div[data-testid*='comment-input']",
    "div[data-testid*='reply-input']",
]

SUBMIT_SELECTORS = [
    "//button[contains(text(),'Post')]",
    "//button[contains(text(),'Comment')]",
    "//button[contains(text(),'Reply')]",
    "button[type='submit']",
    "div[role='button'][data-testid*='submit']",
]


class CommentBot:
    def __init__(self, accounts_path: str = "referIt/accounts/profiles.json",
                 config_path: str = "config.json"):
        with open(accounts_path) as f:
            data = json.load(f)
        self.accounts = data.get("accounts", [])
        self.proxy_manager = ProxyManager.from_profiles(accounts_path)
        self._account_index = 0

        with open(config_path) as f:
            cfg = json.load(f)
        self.company_name = cfg.get("target_company", "Acme Services")
        self.service_hint = cfg.get("service_hint", "")
        self.headless = cfg.get("stealth", {}).get("headless", False)

    def _next_account(self) -> dict:
        account = self.accounts[self._account_index]
        self._account_index = (self._account_index + 1) % len(self.accounts)
        return account

    def _proxy_for(self, account: dict) -> ProxyAccount:
        for pa in self.proxy_manager.accounts:
            if pa.name == account.get("name") or pa.email == account.get("email"):
                return pa
        return None

    def _post_on_page(self, scraper: NextdoorScraper, post_url: str,
                      post_id: str, post_text: str, style: str) -> bool:
        """
        Navigate to a specific post and submit a comment using the provided scraper session.
        Returns True on success.
        """
        drv = scraper.driver.get_driver()
        account_name = scraper.account.name if scraper.account else "unknown"

        try:
            drv.get(post_url)
            scraper.driver.human_delay(3, 7)
            scraper.driver.random_scroll(100, 350)
            scraper.driver.random_mouse_move()
            scraper.driver.human_delay(0.5, 2.0)

            # Find comment box
            comment_box = None
            for sel in COMMENT_SELECTORS:
                try:
                    comment_box = drv.find_element("css selector", sel)
                    if comment_box:
                        break
                except Exception:
                    continue

            if not comment_box:
                logger.error("Comment box not found on page")
                db.record_comment(post_id, post_url, post_text, account_name, "", False)
                return False

            comment_box.click()
            scraper.driver.human_delay(0.5, 1.5)

            message = ai_writer.generate(
                company=self.company_name,
                post_text=post_text,
                style=style,
                service_hint=self.service_hint,
            )
            scraper.driver.human_type(comment_box, message)
            scraper.driver.human_delay(1.0, 3.0)

            # Find and click submit button
            posted = False
            for sel in SUBMIT_SELECTORS:
                try:
                    btn = (drv.find_element("xpath", sel) if sel.startswith("//")
                           else drv.find_element("css selector", sel))
                    btn.click()
                    posted = True
                    break
                except Exception:
                    continue

            if posted:
                logger.info(f"Posted as {account_name}: {message[:70]}...")
                db.record_comment(post_id, post_url, post_text, account_name, message, True)
                if scraper.proxy_manager and scraper.account:
                    scraper.proxy_manager.mark_success(scraper.account)
                scraper.driver.human_delay(2, 5)
                return True
            else:
                logger.error("Submit button not found")
                db.record_comment(post_id, post_url, post_text, account_name, message, False)
                return False

        except Exception as e:
            logger.error(f"Post failed: {e}")
            if scraper.proxy_manager and scraper.account:
                scraper.proxy_manager.mark_failure(scraper.account)
            db.record_comment(post_id, post_url, post_text, account_name, "", False)
            return False

    def run_campaign(self, keywords: list, post_count: int = 5):
        """
        Full campaign: login → scan feed → deduplicate → post comments.
        Uses a PRIMARY Chrome session to scan and recommend, then switches to a 
        SECONDARY session for the verification comment to ensure social proof 
        appears to come from two different, unrelated users.
        """
        started = time.time()
        logger.info(f"[CAMPAIGN] Starting: company='{self.company_name}' target_posts={post_count}")

        # 1. Initialize PRIMARY account (The Scanner & Recommender)
        primary_account = self.proxy_manager.get_next_account()
        if not primary_account:
            logger.error("[CAMPAIGN] No healthy proxies for Primary account — aborting")
            return

        scanner = NextdoorScraper(account=primary_account, proxy_manager=self.proxy_manager,
                                  headless=self.headless)

        try:
            if not scanner.login():
                logger.error("[CAMPAIGN] Primary login failed — aborting")
                return

            targets = scanner.scan_feed(keywords, scroll_count=5)

            # Deduplicate against DB
            fresh = [t for t in targets if not db.has_commented(t["id"])]
            logger.info(f"[CAMPAIGN] {len(fresh)} fresh targets (of {len(targets)} found)")

            if not fresh:
                logger.info("[CAMPAIGN] Nothing new to comment on — done")
                db.log_campaign(keywords, len(targets), 0, 0, 0, self.company_name, started)
                return

            posted = failed = 0
            for target in fresh[:post_count]:
                if not target.get("link"):
                    continue

                # --- STEP 1: Post Recommendation (Primary Account) ---
                logger.info(f"[SWARM] Step 1: Posting recommendation to {target['id']}")
                success_primary = self._post_on_page(
                    scraper=scanner,
                    post_url=target["link"],
                    post_id=target["id"],
                    post_text=target.get("text", ""),
                    style="recommendation",
                )

                if not success_primary:
                    failed += 1
                    continue # Don't proceed to step 2 if step 1 failed

                posted += 1
                
                # Delay between the two comments to mimic organic reaction time
                delay_between = random.uniform(60, 300) 
                logger.info(f"[SWARM] Waiting {delay_between:.0f}s before verification post...")
                time.sleep(delay_between)

                # --- STEP 2: Post Verification (Secondary Account) ---
                logger.info(f"[SWARM] Step 2: Switching accounts for verification...")
                
                # Get a DIFFERENT account — must differ by both name AND proxy URL
                secondary_account = None
                seen_candidates: set = set()
                for _ in range(len(self.proxy_manager.accounts)):
                    candidate = self.proxy_manager.get_next_account()
                    if not candidate:
                        break
                    candidate_key = (candidate.name, candidate.proxy_url)
                    if candidate_key in seen_candidates:
                        continue
                    seen_candidates.add(candidate_key)
                    if (candidate.name != primary_account.name
                            and candidate.proxy_url != primary_account.proxy_url):
                        secondary_account = candidate
                        break

                if not secondary_account:
                    logger.warning("[SWARM] No unique secondary account found. Skipping verification.")
                    continue

                # Initialize a SECOND scraper instance for the secondary account
                secondary_scraper = NextdoorScraper(account=secondary_account, 
                                                    proxy_manager=self.proxy_manager, 
                                                    headless=self.headless)
                
                try:
                    if secondary_scraper.login():
                        logger.info(f"[SWARM] Step 2: Posting verification to {target['id']}")
                        self._post_on_page(
                            scraper=secondary_scraper,
                            post_url=target["link"],
                            post_id=target["id"],
                            post_text=target.get("text", ""),
                            style="praise",
                        )
                    else:
                        logger.error(f"[SWARM] Secondary account login failed for {secondary_account.name}")
                finally:
                    secondary_scraper.close()

                # Long delay between targets to stay under the radar
                delay_next = random.uniform(600, 1800)
                logger.info(f"[CAMPAIGN] Cycle complete. Sleeping {delay_next/60:.1f}m before next target.")
                time.sleep(delay_next)

            db.log_campaign(
                keywords=keywords,
                posts_found=len(targets),
                posts_targeted=min(len(fresh), post_count),
                posts_success=posted,
                posts_failed=failed,
                target_company=self.company_name,
                started_at=started,
            )
            logger.info(f"[CAMPAIGN] Complete. Posted {posted}/{post_count} | Failed {failed}")

        finally:
            scanner.close()