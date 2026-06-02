"""SQLite data layer for Rita's Rewards outreach engine."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional

from .config import DATABASE_PATH

_SCHEMA = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS areas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    city         TEXT,
    state        TEXT,
    lat          REAL,
    lng          REAL,
    radius_miles REAL DEFAULT 5.0,
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurants (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    area_id            INTEGER REFERENCES areas(id) ON DELETE SET NULL,
    external_id        TEXT,
    name               TEXT NOT NULL,
    address            TEXT,
    city               TEXT,
    state              TEXT,
    zip_code           TEXT,
    lat                REAL,
    lng                REAL,
    phone              TEXT,
    email              TEXT,
    website            TEXT,
    cuisine_type       TEXT,
    price_level        INTEGER,
    rating             REAL,
    review_count       INTEGER,
    contact_name       TEXT,
    interest_score     INTEGER DEFAULT 0,
    status             TEXT DEFAULT 'uncontacted',
    current_stage      TEXT,
    last_contact_at    TEXT,
    human_assigned_to  TEXT,
    human_assigned_at  TEXT,
    nearby_qualified   INTEGER DEFAULT 0,
    notes              TEXT,
    source             TEXT DEFAULT 'manual',
    created_at         TEXT DEFAULT (datetime('now')),
    updated_at         TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_contacts (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id        INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    stage                TEXT NOT NULL,
    subject              TEXT,
    body                 TEXT,
    sent_at              TEXT,
    sent_by              TEXT DEFAULT 'system',
    opened_at            TEXT,
    clicked_at           TEXT,
    response_at          TEXT,
    response_text        TEXT,
    response_sentiment   TEXT,
    created_at           TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS handoffs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id     INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    email_contact_id  INTEGER REFERENCES email_contacts(id),
    priority          INTEGER DEFAULT 5,
    reason            TEXT,
    assigned_to       TEXT,
    status            TEXT DEFAULT 'pending',
    notes             TEXT,
    created_at        TEXT DEFAULT (datetime('now')),
    completed_at      TEXT
);

CREATE TABLE IF NOT EXISTS interest_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    event_type    TEXT NOT NULL,
    points        INTEGER DEFAULT 0,
    description   TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rest_area    ON restaurants(area_id);
CREATE INDEX IF NOT EXISTS idx_rest_status  ON restaurants(status);
CREATE INDEX IF NOT EXISTS idx_rest_score   ON restaurants(interest_score DESC);
CREATE INDEX IF NOT EXISTS idx_email_rest   ON email_contacts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_handoff_stat ON handoffs(status);
"""


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(str(DATABASE_PATH), detect_types=sqlite3.PARSE_DECLTYPES)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    return c


def init_db() -> None:
    with _conn() as c:
        c.executescript(_SCHEMA)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Areas ─────────────────────────────────────────────────────────────────────

def create_area(name: str, city: str, state: str, lat: float, lng: float,
                radius_miles: float = 5.0) -> int:
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO areas (name,city,state,lat,lng,radius_miles) VALUES (?,?,?,?,?,?)",
            (name, city, state, lat, lng, radius_miles),
        )
        return cur.lastrowid  # type: ignore[return-value]


def get_areas() -> list[dict]:
    with _conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM areas ORDER BY name").fetchall()]


def get_area(area_id: int) -> Optional[dict]:
    with _conn() as c:
        r = c.execute("SELECT * FROM areas WHERE id=?", (area_id,)).fetchone()
        return dict(r) if r else None


def update_area(area_id: int, **kwargs: Any) -> None:
    clause = ", ".join(f"{k}=?" for k in kwargs)
    with _conn() as c:
        c.execute(f"UPDATE areas SET {clause} WHERE id=?", [*kwargs.values(), area_id])


def delete_area(area_id: int) -> None:
    with _conn() as c:
        c.execute("DELETE FROM areas WHERE id=?", (area_id,))


# ── Restaurants ───────────────────────────────────────────────────────────────

_REST_FIELDS = [
    "area_id", "external_id", "name", "address", "city", "state", "zip_code",
    "lat", "lng", "phone", "email", "website", "cuisine_type", "price_level",
    "rating", "review_count", "contact_name", "notes", "source",
]


def upsert_restaurant(data: dict) -> int:
    row = {f: data.get(f) for f in _REST_FIELDS}
    row["updated_at"] = _now()

    with _conn() as c:
        if data.get("external_id"):
            existing = c.execute(
                "SELECT id FROM restaurants WHERE external_id=?", (data["external_id"],)
            ).fetchone()
            if existing:
                clause = ", ".join(f"{k}=?" for k in row)
                c.execute(f"UPDATE restaurants SET {clause} WHERE id=?",
                          [*row.values(), existing["id"]])
                return existing["id"]  # type: ignore[return-value]

        cols = ", ".join(row.keys())
        ph = ", ".join("?" * len(row))
        cur = c.execute(f"INSERT INTO restaurants ({cols}) VALUES ({ph})", list(row.values()))
        return cur.lastrowid  # type: ignore[return-value]


def get_restaurants(area_id: Optional[int] = None, status: Optional[str] = None,
                    stage: Optional[str] = None, search: Optional[str] = None) -> list[dict]:
    q = "SELECT * FROM restaurants WHERE 1=1"
    p: list[Any] = []
    if area_id is not None:
        q += " AND area_id=?"; p.append(area_id)
    if status:
        q += " AND status=?"; p.append(status)
    if stage:
        q += " AND current_stage=?"; p.append(stage)
    if search:
        q += " AND (name LIKE ? OR city LIKE ? OR cuisine_type LIKE ?)"
        t = f"%{search}%"; p += [t, t, t]
    q += " ORDER BY interest_score DESC, name"
    with _conn() as c:
        return [dict(r) for r in c.execute(q, p).fetchall()]


def get_restaurant(rid: int) -> Optional[dict]:
    with _conn() as c:
        r = c.execute("SELECT * FROM restaurants WHERE id=?", (rid,)).fetchone()
        return dict(r) if r else None


def update_restaurant(rid: int, **kwargs: Any) -> None:
    kwargs["updated_at"] = _now()
    clause = ", ".join(f"{k}=?" for k in kwargs)
    with _conn() as c:
        c.execute(f"UPDATE restaurants SET {clause} WHERE id=?", [*kwargs.values(), rid])


def delete_restaurant(rid: int) -> None:
    with _conn() as c:
        c.execute("DELETE FROM restaurants WHERE id=?", (rid,))


def mark_nearby_qualified(restaurant_ids: list[int]) -> None:
    if not restaurant_ids:
        return
    ph = ",".join("?" * len(restaurant_ids))
    with _conn() as c:
        c.execute(f"UPDATE restaurants SET nearby_qualified=1 WHERE id IN ({ph})", restaurant_ids)


# ── Email Contacts ─────────────────────────────────────────────────────────────

def log_email(restaurant_id: int, stage: str, subject: str, body: str,
              sent_by: str = "system") -> int:
    now = _now()
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO email_contacts (restaurant_id,stage,subject,body,sent_at,sent_by) "
            "VALUES (?,?,?,?,?,?)",
            (restaurant_id, stage, subject, body, now, sent_by),
        )
        c.execute(
            "UPDATE restaurants SET last_contact_at=?,current_stage=?,status='contacted',"
            "updated_at=? WHERE id=?",
            (now, stage, now, restaurant_id),
        )
        return cur.lastrowid  # type: ignore[return-value]


def get_email_history(restaurant_id: int) -> list[dict]:
    with _conn() as c:
        return [dict(r) for r in c.execute(
            "SELECT * FROM email_contacts WHERE restaurant_id=? ORDER BY created_at DESC",
            (restaurant_id,),
        ).fetchall()]


def record_response(email_id: int, response_text: str, sentiment: str) -> None:
    with _conn() as c:
        c.execute(
            "UPDATE email_contacts SET response_at=?,response_text=?,response_sentiment=? WHERE id=?",
            (_now(), response_text, sentiment, email_id),
        )


def record_open(email_id: int) -> None:
    with _conn() as c:
        c.execute("UPDATE email_contacts SET opened_at=? WHERE id=? AND opened_at IS NULL",
                  (_now(), email_id))


def record_click(email_id: int) -> None:
    with _conn() as c:
        c.execute("UPDATE email_contacts SET clicked_at=? WHERE id=? AND clicked_at IS NULL",
                  (_now(), email_id))


# ── Interest Events ────────────────────────────────────────────────────────────

def add_interest_event(restaurant_id: int, event_type: str, points: int,
                       description: str = "") -> None:
    with _conn() as c:
        c.execute(
            "INSERT INTO interest_events (restaurant_id,event_type,points,description) VALUES (?,?,?,?)",
            (restaurant_id, event_type, points, description),
        )
        c.execute(
            "UPDATE restaurants SET interest_score=MAX(0,interest_score+?),updated_at=? WHERE id=?",
            (points, _now(), restaurant_id),
        )


def get_interest_events(restaurant_id: int) -> list[dict]:
    with _conn() as c:
        return [dict(r) for r in c.execute(
            "SELECT * FROM interest_events WHERE restaurant_id=? ORDER BY created_at DESC",
            (restaurant_id,),
        ).fetchall()]


# ── Handoffs ──────────────────────────────────────────────────────────────────

def create_handoff(restaurant_id: int, email_contact_id: Optional[int],
                   priority: int, reason: str, assigned_to: str = "") -> int:
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO handoffs (restaurant_id,email_contact_id,priority,reason,assigned_to) "
            "VALUES (?,?,?,?,?)",
            (restaurant_id, email_contact_id, priority, reason, assigned_to),
        )
        c.execute(
            "UPDATE restaurants SET human_assigned_to=?,human_assigned_at=?,current_stage='human_handoff',"
            "updated_at=? WHERE id=?",
            (assigned_to, _now(), _now(), restaurant_id),
        )
        return cur.lastrowid  # type: ignore[return-value]


def get_handoffs(status: str = "pending") -> list[dict]:
    with _conn() as c:
        return [dict(r) for r in c.execute(
            """
            SELECT h.*, r.name AS restaurant_name, r.cuisine_type, r.city, r.state,
                   r.phone, r.email AS restaurant_email, r.interest_score
            FROM handoffs h
            JOIN restaurants r ON h.restaurant_id = r.id
            WHERE h.status=?
            ORDER BY h.priority DESC, h.created_at
            """,
            (status,),
        ).fetchall()]


def update_handoff(handoff_id: int, **kwargs: Any) -> None:
    if kwargs.get("status") == "completed":
        kwargs["completed_at"] = _now()
    clause = ", ".join(f"{k}=?" for k in kwargs)
    with _conn() as c:
        c.execute(f"UPDATE handoffs SET {clause} WHERE id=?", [*kwargs.values(), handoff_id])


# ── Analytics ─────────────────────────────────────────────────────────────────

def get_area_stats(area_id: Optional[int] = None) -> dict:
    where = "WHERE 1=1"
    p: list[Any] = []
    if area_id is not None:
        where += " AND area_id=?"; p.append(area_id)

    with _conn() as c:
        total     = c.execute(f"SELECT COUNT(*) FROM restaurants {where}", p).fetchone()[0]
        contacted = c.execute(f"SELECT COUNT(*) FROM restaurants {where} AND status!='uncontacted'", p).fetchone()[0]
        interested = c.execute(f"SELECT COUNT(*) FROM restaurants {where} AND interest_score>=50", p).fetchone()[0]
        converted  = c.execute(f"SELECT COUNT(*) FROM restaurants {where} AND status='converted'", p).fetchone()[0]
        pending_ho = c.execute("SELECT COUNT(*) FROM handoffs WHERE status='pending'").fetchone()[0]
        stages     = c.execute(
            f"SELECT current_stage, COUNT(*) as cnt FROM restaurants {where} "
            "AND current_stage IS NOT NULL GROUP BY current_stage", p
        ).fetchall()
        recent     = c.execute(
            """
            SELECT e.sent_at, e.stage, r.name, r.city
            FROM email_contacts e JOIN restaurants r ON e.restaurant_id=r.id
            ORDER BY e.sent_at DESC LIMIT 10
            """
        ).fetchall()
    return {
        "total": total,
        "contacted": contacted,
        "interested": interested,
        "converted": converted,
        "handoffs_pending": pending_ho,
        "stage_breakdown": {r["current_stage"]: r["cnt"] for r in stages},
        "recent_activity": [dict(r) for r in recent],
    }


def restaurants_due_for_followup() -> list[dict]:
    """Returns restaurants whose last email is past its follow-up window."""
    with _conn() as c:
        return [dict(r) for r in c.execute(
            """
            SELECT r.*, e.id AS last_email_id, e.stage AS last_email_stage, e.sent_at AS last_email_sent
            FROM restaurants r
            JOIN email_contacts e ON e.id = (
                SELECT id FROM email_contacts WHERE restaurant_id=r.id
                ORDER BY sent_at DESC LIMIT 1
            )
            WHERE r.status='contacted'
            AND r.current_stage IN ('cold_outreach','follow_up_1')
            AND e.response_at IS NULL
            AND (
                (r.current_stage='cold_outreach' AND e.sent_at < datetime('now','-3 days'))
                OR
                (r.current_stage='follow_up_1'   AND e.sent_at < datetime('now','-5 days'))
            )
            """
        ).fetchall()]
