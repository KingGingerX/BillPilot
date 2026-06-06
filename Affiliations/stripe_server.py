"""
Stripe Checkout backend for AFF LAUNCHER monetization.
Usage:
  pip install flask stripe python-dotenv
  python stripe_server.py
"""
import json
import logging
import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request, send_from_directory

load_dotenv()

_logger = logging.getLogger("stripe_server")

app = Flask(__name__, static_folder=".")
LEADS_PATH = Path("leads.jsonl")

STRIPE_SECRET_KEY = os.getenv("STRIPE_TEST_SECRET_KEY") or os.getenv(
    "STRIPE_LIVE_SECRET_KEY", ""
)
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_TEST_PUBLISHABLE_KEY") or os.getenv(
    "STRIPE_LIVE_PUBLISHABLE_KEY", ""
)
PRICE_MAP = {
    "starter": os.getenv("STRIPE_PRICE_STARTER", ""),
    "pro": os.getenv("STRIPE_PRICE_PRO", ""),
    "agency": os.getenv("STRIPE_PRICE_AGENCY", ""),
    "maintenance": os.getenv("STRIPE_PRICE_MAINTENANCE", ""),
}

if not STRIPE_SECRET_KEY:
    print("[WARNING] STRIPE_SECRET_KEY not set. Checkout will fail.")

try:
    import stripe

    stripe.api_key = STRIPE_SECRET_KEY
except ImportError:
    stripe = None  # type: ignore


@app.route("/")
def index():
    return send_from_directory(".", "landing_page.html")


@app.route("/config")
def config():
    return jsonify({"publishableKey": STRIPE_PUBLISHABLE_KEY})


@app.route("/create-checkout-session", methods=["POST"])
def create_checkout_session():
    if not stripe:
        abort(500, description="Stripe library not installed")
    if not STRIPE_SECRET_KEY:
        abort(500, description="Stripe secret key not configured")

    data = request.get_json(force=True, silent=True) or {}
    tier = data.get("tier", "starter")
    price_id = PRICE_MAP.get(tier)
    if not price_id:
        abort(400, description=f"Invalid tier: {tier}")

    base_url = request.host_url.rstrip("/")
    try:
        is_sub = tier == "maintenance"
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                }
            ],
            mode="subscription" if is_sub else "payment",
            success_url=f"{base_url}/success.html",
            cancel_url=f"{base_url}/cancel.html",
            automatic_tax={"enabled": False},
        )
        return jsonify({"id": session.id, "url": session.url})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/capture-lead", methods=["POST"])
def capture_lead():
    data = request.get_json(force=True, silent=True) or {}
    email = data.get("email", "").strip().lower()
    if not email or "@" not in email:
        abort(400, description="Invalid email")
    entry = {"email": email, "captured_at": datetime.now().isoformat()}
    with LEADS_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    return jsonify({"status": "captured"})


@app.route("/create-upsell-session", methods=["POST"])
def create_upsell_session():
    """Create a checkout session for an upsell after an initial purchase."""
    if not stripe:
        abort(500, description="Stripe library not installed")
    if not STRIPE_SECRET_KEY:
        abort(500, description="Stripe secret key not configured")

    data = request.get_json(force=True, silent=True) or {}
    tier = data.get("tier", "pro")
    price_id = PRICE_MAP.get(tier)
    if not price_id:
        abort(400, description=f"Invalid upsell tier: {tier}")

    base_url = request.host_url.rstrip("/")
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="payment",
            success_url=f"{base_url}/success.html?upsell=1",
            cancel_url=f"{base_url}/cancel.html",
        )
        return jsonify({"id": session.id, "url": session.url})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/webhook", methods=["POST"])
def stripe_webhook():
    if not stripe:
        abort(500)
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get("Stripe-Signature", "")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    if not webhook_secret:
        abort(500, description="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        abort(400, description="Invalid payload")
    except stripe.error.SignatureVerificationError:
        abort(400, description="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        _logger.info("Payment completed for session %s", session["id"])
        _fulfill_order(session)

    return jsonify({"status": "success"})


def _fulfill_order(session: dict) -> None:
    customer_email = (
        session.get("customer_details", {}).get("email")
        or session.get("customer_email")
        or ""
    )
    tier = "unknown"
    try:
        line_items = stripe.checkout.Session.list_line_items(session["id"])
        if line_items.data:
            desc = line_items.data[0].get("description", "")
            for t in ("agency", "pro", "starter", "maintenance"):
                if t in desc.lower():
                    tier = t
                    break
    except Exception as exc:
        _logger.warning("Could not retrieve line items: %s", exc)

    orders_path = Path("orders.jsonl")
    entry = {
        "session_id": session["id"],
        "customer_email": customer_email,
        "tier": tier,
        "amount_total": session.get("amount_total"),
        "currency": session.get("currency"),
        "fulfilled_at": datetime.now().isoformat(),
    }
    with orders_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    _logger.info("Order recorded: %s (%s) tier=%s", customer_email, session["id"], tier)

    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    from_email = os.getenv("SMTP_FROM", smtp_user)

    if not all([smtp_host, smtp_user, smtp_pass, customer_email]):
        _logger.warning("SMTP not configured or no customer email — skipping delivery email")
        return

    try:
        download_url = os.getenv("PRODUCT_DOWNLOAD_URL", "https://afflauncher.com/download")
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Your AFF LAUNCHER {tier.title()} License"
        msg["From"] = from_email
        msg["To"] = customer_email
        body = (
            f"Welcome to AFF LAUNCHER {tier.title()}!\n\n"
            f"Download your license here:\n{download_url}?session={session['id']}\n\n"
            "Setup instructions: https://afflauncher.com/docs/quickstart\n\n"
            "Reply to this email if you need help.\n"
        )
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, customer_email, msg.as_string())
        _logger.info("Delivery email sent to %s", customer_email)
    except Exception as exc:
        _logger.error("Failed to send delivery email to %s: %s", customer_email, exc)


@app.route("/orders")
def list_orders():
    """Return all fulfilled orders (internal admin endpoint)."""
    orders_path = Path("orders.jsonl")
    if not orders_path.exists():
        return jsonify([])
    orders = []
    for line in orders_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            orders.append(json.loads(line))
    return jsonify(orders)


@app.route("/success.html")
def success():
    html = (
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        '<title>Payment Successful</title>'
        '<style>body{background:#0a0a0a;color:#e5e5e5;font-family:system-ui,'
        'sans-serif;display:flex;align-items:center;justify-content:center;'
        'height:100vh;margin:0;text-align:center}'
        '.card{background:#111;border:1px solid #333;padding:2rem 3rem;'
        'border-radius:12px;max-width:420px}'
        'h1{color:#00d084}p{color:#aaa}a{color:#fff}</style></head><body>'
        '<div class="card"><h1>Payment Successful</h1>'
        '<p>Welcome. Check your email for next steps.</p>'
        '<p><a href="/">Back to home</a></p></div></body></html>'
    )
    return html


@app.route("/cancel.html")
def cancel():
    html = (
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        '<title>Payment Cancelled</title>'
        '<style>body{background:#0a0a0a;color:#e5e5e5;font-family:system-ui,'
        'sans-serif;display:flex;align-items:center;justify-content:center;'
        'height:100vh;margin:0;text-align:center}'
        '.card{background:#111;border:1px solid #333;padding:2rem 3rem;'
        'border-radius:12px;max-width:420px}'
        'h1{color:#ff4757}p{color:#aaa}a{color:#fff}</style></head><body>'
        '<div class="card"><h1>Payment Cancelled</h1>'
        '<p>No worries. Return anytime to complete your purchase.</p>'
        '<p><a href="/">Back to home</a></p></div></body></html>'
    )
    return html


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
