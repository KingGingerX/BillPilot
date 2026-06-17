"""
ReferIt Flask API + Web Dashboard
"""
import os
import json
import threading
from pathlib import Path
from flask import Flask, render_template, request, jsonify, redirect, url_for, session

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "referit-dev-secret")

CONFIG_PATH   = Path("config.json")
PROFILES_PATH = Path("referIt/accounts/profiles.json")
LOG_PATH      = Path("logs/referit.log")

_status = {
    "running":       False,
    "last_campaign": None,
    "next_campaign": None,
    "last_error":    None,
}
_trigger_event = threading.Event()


def set_status(updates: dict):
    _status.update(updates)


def get_trigger_event() -> threading.Event:
    return _trigger_event


def _load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def _save_config(data: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)


# Register Stripe / auth blueprint
from referIt.ui.stripe_routes import stripe_bp
from referIt.ui.auth import login_required
app.register_blueprint(stripe_bp)


# ── Public routes ──────────────────────────────────────────────────────────

@app.route("/")
def index():
    if session.get("license_key"):
        from referIt.core.db import validate_license
        if validate_license(session["license_key"]):
            return redirect(url_for("dashboard"))
    return render_template("landing.html",
                           publishable_key=os.environ.get("STRIPE_PUBLISHABLE_KEY", ""))


# ── Protected dashboard ────────────────────────────────────────────────────

@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("index.html")


# ── Config API ─────────────────────────────────────────────────────────────

@app.route("/api/config", methods=["GET"])
@login_required
def get_config():
    return jsonify(_load_config())


@app.route("/api/config", methods=["POST"])
@login_required
def update_config():
    data = request.json
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid config: must be a JSON object"}), 400
    _save_config(data)
    return jsonify({"status": "saved"})


# ── Stats API ──────────────────────────────────────────────────────────────

@app.route("/api/stats")
@login_required
def get_stats():
    from referIt.core.db import get_stats as _db_stats
    stats = _db_stats()
    try:
        from referIt.core.proxy_mgr import ProxyManager
        pm = ProxyManager.from_profiles(str(PROFILES_PATH))
        proxy_stats = pm.stats()
    except Exception:
        proxy_stats = {"total": 0, "healthy": 0, "unhealthy": 0}
    return jsonify({**stats, **proxy_stats, **_status})


# ── Campaigns API ──────────────────────────────────────────────────────────

@app.route("/api/campaigns")
@login_required
def get_campaigns():
    from referIt.core.db import get_recent_campaigns
    return jsonify(get_recent_campaigns(25))


@app.route("/api/comments")
@login_required
def get_comments():
    from referIt.core.db import get_recent_comments
    return jsonify(get_recent_comments(50))


# ── Proxy API ──────────────────────────────────────────────────────────────

@app.route("/api/proxies")
@login_required
def get_proxies():
    try:
        from referIt.core.proxy_mgr import ProxyManager
        pm = ProxyManager.from_profiles(str(PROFILES_PATH))
        return jsonify([
            {
                "name":       a.name,
                "email":      a.email,
                "healthy":    a.healthy,
                "fail_count": a.fail_count,
                "provider":   a.provider,
                "country":    a.country_code,
            }
            for a in pm.accounts
        ])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/profiles", methods=["GET"])
@login_required
def get_profiles():
    try:
        with open(PROFILES_PATH) as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/profiles", methods=["POST"])
@login_required
def update_profiles():
    try:
        data = request.json
        if not isinstance(data, dict) or "accounts" not in data:
            return jsonify({"error": "Invalid profiles: must be JSON object with 'accounts' key"}), 400
        with open(PROFILES_PATH, "w") as f:
            json.dump(data, f, indent=2)
        return jsonify({"status": "saved"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Logs API ───────────────────────────────────────────────────────────────

@app.route("/api/logs")
@login_required
def get_logs():
    n = int(request.args.get("lines", 150))
    try:
        with open(LOG_PATH) as f:
            lines = f.readlines()
        return jsonify({"lines": lines[-n:]})
    except Exception:
        return jsonify({"lines": []})


# ── Control API ────────────────────────────────────────────────────────────

@app.route("/api/trigger", methods=["POST"])
@login_required
def trigger_campaign():
    _trigger_event.set()
    return jsonify({"status": "triggered"})


@app.route("/api/status")
@login_required
def get_status():
    return jsonify(_status)
