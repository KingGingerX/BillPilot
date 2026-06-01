import sqlite3
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "owl.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS devices (
                mac          TEXT PRIMARY KEY,
                ip           TEXT,
                hostname     TEXT,
                vendor       TEXT,
                description  TEXT,
                open_ports   TEXT DEFAULT '[]',
                first_seen   TEXT,
                last_seen    TEXT,
                label        TEXT DEFAULT '',
                acknowledged INTEGER DEFAULT 0
            )
        """)
        conn.commit()


def upsert_device(mac, ip, hostname, vendor, description, open_ports):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT mac FROM devices WHERE mac = ?", (mac,)
        ).fetchone()

        if existing:
            conn.execute("""
                UPDATE devices
                SET ip=?, hostname=?, vendor=?, description=?, open_ports=?, last_seen=?
                WHERE mac=?
            """, (ip, hostname, vendor, description, json.dumps(open_ports), now, mac))
            is_new = False
        else:
            conn.execute("""
                INSERT INTO devices
                    (mac, ip, hostname, vendor, description, open_ports, first_seen, last_seen, acknowledged)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            """, (mac, ip, hostname, vendor, description, json.dumps(open_ports), now, now))
            is_new = True

        conn.commit()
    return is_new


def get_all_devices():
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM devices ORDER BY last_seen DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_device(mac):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM devices WHERE mac = ?", (mac,)
        ).fetchone()
    return dict(row) if row else None


def acknowledge_device(mac):
    with get_conn() as conn:
        conn.execute(
            "UPDATE devices SET acknowledged=1 WHERE mac=?", (mac,)
        )
        conn.commit()


def set_label(mac, label):
    with get_conn() as conn:
        conn.execute(
            "UPDATE devices SET label=?, acknowledged=1 WHERE mac=?", (label, mac)
        )
        conn.commit()


def get_unacknowledged_count():
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM devices WHERE acknowledged=0"
        ).fetchone()
    return row["cnt"]
