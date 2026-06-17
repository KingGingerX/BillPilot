"""
SQLite persistence layer.
Tracks commented posts (deduplication), campaign history, and licenses.
"""
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path("data/referit.db")


def init_db():
    DB_PATH.parent.mkdir(exist_ok=True)
    with _db() as c:
        c.executescript("""
            CREATE TABLE IF NOT EXISTS commented_posts (
                post_id      TEXT PRIMARY KEY,
                post_url     TEXT,
                post_text    TEXT,
                commented_at REAL,
                account_name TEXT,
                comment_text TEXT,
                success      INTEGER DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS campaign_runs (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at     REAL,
                completed_at   REAL,
                keywords       TEXT,
                posts_found    INTEGER DEFAULT 0,
                posts_targeted INTEGER DEFAULT 0,
                posts_success  INTEGER DEFAULT 0,
                posts_failed   INTEGER DEFAULT 0,
                target_company TEXT
            );
            CREATE TABLE IF NOT EXISTS licenses (
                key                TEXT PRIMARY KEY,
                stripe_customer_id TEXT UNIQUE,
                email              TEXT,
                tier               TEXT DEFAULT 'core',
                created_at         REAL,
                active             INTEGER DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS download_tokens (
                token      TEXT PRIMARY KEY,
                license_key TEXT NOT NULL,
                tier       TEXT NOT NULL,
                created_at REAL NOT NULL,
                expires_at REAL NOT NULL,
                used       INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_commented_at
                ON commented_posts (commented_at);
            CREATE INDEX IF NOT EXISTS idx_campaign_started
                ON campaign_runs (started_at DESC);
        """)


@contextmanager
def _db():
    """Open, yield, commit/rollback, and CLOSE the connection every time."""
    conn = sqlite3.connect(str(DB_PATH), timeout=15)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def has_commented(post_id: str) -> bool:
    with _db() as c:
        row = c.execute(
            "SELECT 1 FROM commented_posts WHERE post_id = ?", (post_id,)
        ).fetchone()
    return row is not None


def record_comment(post_id: str, post_url: str, post_text: str,
                   account_name: str, comment_text: str, success: bool):
    with _db() as c:
        c.execute("""
            INSERT OR IGNORE INTO commented_posts
              (post_id, post_url, post_text, commented_at, account_name, comment_text, success)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (post_id, post_url, post_text[:300], time.time(),
              account_name, comment_text, 1 if success else 0))


def log_campaign(keywords: list, posts_found: int, posts_targeted: int,
                 posts_success: int, posts_failed: int,
                 target_company: str, started_at: float):
    with _db() as c:
        c.execute("""
            INSERT INTO campaign_runs
              (started_at, completed_at, keywords, posts_found, posts_targeted,
               posts_success, posts_failed, target_company)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (started_at, time.time(), ",".join(keywords),
              posts_found, posts_targeted, posts_success, posts_failed, target_company))


def get_recent_campaigns(limit: int = 20) -> list:
    with _db() as c:
        rows = c.execute("""
            SELECT id, started_at, completed_at, keywords, posts_found,
                   posts_targeted, posts_success, posts_failed, target_company
            FROM campaign_runs ORDER BY started_at DESC LIMIT ?
        """, (limit,)).fetchall()
    keys = ["id", "started_at", "completed_at", "keywords", "posts_found",
            "posts_targeted", "posts_success", "posts_failed", "company"]
    return [dict(zip(keys, r)) for r in rows]


def get_recent_comments(limit: int = 50) -> list:
    with _db() as c:
        rows = c.execute("""
            SELECT post_id, post_url, commented_at, account_name, comment_text, success
            FROM commented_posts ORDER BY commented_at DESC LIMIT ?
        """, (limit,)).fetchall()
    keys = ["post_id", "post_url", "commented_at", "account_name", "comment_text", "success"]
    return [dict(zip(keys, r)) for r in rows]


def create_license(stripe_customer_id: str, email: str = None, tier: str = "core") -> str:
    with _db() as c:
        existing = c.execute(
            "SELECT key FROM licenses WHERE stripe_customer_id = ?", (stripe_customer_id,)
        ).fetchone()
        if existing:
            c.execute(
                "UPDATE licenses SET active=1, tier=? WHERE stripe_customer_id=?",
                (tier, stripe_customer_id),
            )
            return existing[0]
        key = str(uuid.uuid4()).replace("-", "").upper()[:32]
        c.execute(
            "INSERT INTO licenses (key, stripe_customer_id, email, tier, created_at, active) VALUES (?,?,?,?,?,1)",
            (key, stripe_customer_id, email, tier, time.time()),
        )
    return key


def create_download_token(license_key: str, tier: str) -> str:
    token = str(uuid.uuid4()).replace("-", "")
    now = time.time()
    with _db() as c:
        c.execute(
            "INSERT INTO download_tokens (token, license_key, tier, created_at, expires_at, used) VALUES (?,?,?,?,?,0)",
            (token, license_key, tier, now, now + 7 * 86400),
        )
    return token


def consume_download_token(token: str):
    """Return tier string if token is valid and unused, else None. Marks token used."""
    now = time.time()
    with _db() as c:
        row = c.execute(
            "SELECT tier, expires_at, used FROM download_tokens WHERE token=?", (token,)
        ).fetchone()
        if not row:
            return None
        tier, expires_at, used = row
        if used or now > expires_at:
            return None
        c.execute("UPDATE download_tokens SET used=1 WHERE token=?", (token,))
    return tier


def validate_license(key: str) -> bool:
    with _db() as c:
        row = c.execute(
            "SELECT active FROM licenses WHERE key=?", (key,)
        ).fetchone()
    return bool(row and row[0] == 1)


def deactivate_license_by_customer(stripe_customer_id: str):
    with _db() as c:
        c.execute("UPDATE licenses SET active=0 WHERE stripe_customer_id=?", (stripe_customer_id,))


def get_stats() -> dict:
    with _db() as c:
        total     = c.execute("SELECT COUNT(*) FROM commented_posts WHERE success=1").fetchone()[0]
        today     = c.execute(
            "SELECT COUNT(*) FROM commented_posts WHERE commented_at>? AND success=1",
            (time.time() - 86400,)).fetchone()[0]
        week      = c.execute(
            "SELECT COUNT(*) FROM commented_posts WHERE commented_at>? AND success=1",
            (time.time() - 604800,)).fetchone()[0]
        campaigns = c.execute("SELECT COUNT(*) FROM campaign_runs").fetchone()[0]
        s_total   = c.execute("SELECT SUM(posts_success) FROM campaign_runs").fetchone()[0] or 0
        f_total   = c.execute("SELECT SUM(posts_failed)  FROM campaign_runs").fetchone()[0] or 0
    denom = s_total + f_total
    rate = round(s_total / denom * 100, 1) if denom > 0 else 0
    return {
        "total_comments":  total,
        "today_comments":  today,
        "week_comments":   week,
        "total_campaigns": campaigns,
        "success_rate":    rate,
    }
