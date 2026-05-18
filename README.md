# BillPilot

Debt negotiation scripts and FCRA credit dispute letters — generated from your real numbers, stored locally with encrypted PII.

## What it does

1. **Negotiate** — generates a personalized creditor call script, offer targets (lower payment, APR/fee waivers, settlement), a counter-offer script for when they say no, and a call checklist.
2. **Dispute** — drafts an FCRA § 611-compliant bureau dispute letter with a 30-day investigation deadline, certified-mail guidance, and full consumer rights language.
3. **Escalate** — generates a CFPB complaint letter if the bureau failed to respond to a prior dispute within 30 days.
4. **History** — stores all requests/completions with UTC timestamps; PII encrypted at rest with AES-Fernet.
5. **Web UI** — Streamlit app with all the above plus a usage tracker, resource sidebar, and (Pro) AI-enhanced letters via Claude API.

> **Disclaimer:** Educational and workflow-support only. Not legal advice. Review your state's laws before contacting creditors.

---

## CLI quick start

```bash
# Negotiate with defaults
python -m debt_bot.main negotiate

# Negotiate with your real numbers and save output
python -m debt_bot.main negotiate \
  --creditor "Chase" --balance 7500 --payment 280 \
  --apr 22.99 --hardship "job loss" \
  --target-payment 150 --max-settlement 3500 \
  --output my_plan.txt

# Dispute a bureau item
python -m debt_bot.main dispute \
  --bureau Experian \
  --furnisher "ABC Collections" \
  --account "****1234" \
  --issue "Duplicate collection" \
  --details "Same debt appears twice with different open dates." \
  --name "Your Name" \
  --address "123 Main St, City, ST 00000"

# Escalate an unresolved dispute to CFPB
python -m debt_bot.main escalate \
  --bureau Experian \
  --furnisher "ABC Collections" \
  --account "****1234" \
  --issue "Duplicate collection" \
  --details "Same debt appears twice with different open dates." \
  --name "Your Name" \
  --address "123 Main St, City, ST 00000" \
  --prior-dispute-date 2026-03-15

# View activity history
python -m debt_bot.main history
```

---

## Web UI

```bash
streamlit run debt_bot/ui.py
```

The UI includes:
- **Negotiation tab** — full script + counter-offer + checklist + offer metrics (monthly savings, settlement target, months to payoff, interest saved, hardship score)
- **Credit Dispute tab** — FCRA dispute letter + escalation letter (if prior dispute date provided) + remediation checklist + AI-enhance button (Pro)
- **History tab** — recent events dataframe with clear button
- **Sidebar** — usage tracker, upgrade CTA, free resource links

---

## Monetization / Plans

| Feature | Free | Pro |
|---|---|---|
| Negotiation plans | 5/month | Unlimited |
| Dispute letters | 5/month | Unlimited |
| Counter-offer scripts | Included | Included |
| CFPB escalation letters | Included | Included |
| AI-enhanced letters (Claude) | — | ✓ |

### Enabling Pro

```bash
# Set in your .env file
BILLPILOT_TIER=pro
```

Replace `STRIPE_UPGRADE_LINK` in `debt_bot/tier.py` with your real Stripe payment link. Use a Stripe webhook to set `BILLPILOT_TIER=pro` in the user's session after a successful charge.

### AI-enhanced letters

```bash
pip install "billpilot[ai]"
# Then set ANTHROPIC_API_KEY in your .env
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Data storage and security

- History stored in `data/history.jsonl`
- PII encrypted at rest with Fernet (AES-128-CBC + HMAC-SHA256) in `data/pii_store.jsonl`
- Key source order:
  1. `DEBT_BOT_ENCRYPTION_KEY` env var (recommended for production)
  2. Auto-generated key at `data/encryption.key` (back this file up — losing it means losing all stored PII)

---

## Install and run tests

```bash
pip install -e ".[dev]"
python -m pytest -q
```

---

## Roadmap

- Stripe webhook integration to activate Pro programmatically
- Telephony integration (Twilio) to place and transcribe calls with consent logging
- Credit bureau API ingestion for automated dispute item detection
- Negotiation outcome analytics and 30-day follow-up scheduler
- Multi-account debt dashboard (manage several creditors in one view)
