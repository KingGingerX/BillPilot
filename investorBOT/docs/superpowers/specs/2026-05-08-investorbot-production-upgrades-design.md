# InvestorBot Production Upgrades — Design Spec
**Date:** 2026-05-08  
**Status:** Approved  

## Goal

Three targeted upgrades to make InvestorBot ready for live paper trading with Telegram alerts: a daily loss circuit breaker, real-time data auto-detection via dotenv, and fill-vs-backtest validation tracking.

---

## Feature 1: Daily Loss Circuit Breaker

### What It Does

Blocks new buy/sell orders for the remainder of the trading day when the account's portfolio value drops 5% below its opening value. Fires one Telegram alert when triggered. Leaves open positions untouched (user manages manually).

### Implementation

**New class:** `CircuitBreaker` added to `trade_executor.py` (same file, no new module needed).

**State file:** `data/circuit_breaker_state.json`
```json
{
  "date": "2026-05-08",
  "start_value": 1000.00,
  "halted": false,
  "triggered_at": null
}
```

**Logic:**
1. On first `place_buy` or `place_sell_notional` call of the day, fetch `portfolio_value` from Alpaca account and write it as `start_value` for today's date.
2. Before each order, re-fetch current `portfolio_value`.
3. Compute `drawdown = (start_value - current_value) / start_value`.
4. If `drawdown >= 0.05`:
   - Set `halted = True` and `triggered_at` timestamp in state file.
   - Send one Telegram alert: "⛔ Circuit breaker triggered. Daily loss reached X%. No new orders until tomorrow."
   - Return a failed `OrderResult` with `status = "CIRCUIT_BREAKER"` and a clear message.
5. State resets automatically when the date in the JSON no longer matches today.
6. If Alpaca is not configured, breaker is skipped (no-op).

**Integration:** `AlpacaExecutor._place_order()` calls `self._breaker.check()` before submitting. `AlpacaExecutor` owns a `CircuitBreaker` instance (initialized in `__init__`). The notifier is passed in optionally: `AlpacaExecutor(paper=True, notifier=None)`.

### Error Handling

- If fetching account fails during breaker check, log a warning and allow the order through (fail-open, not fail-closed — avoids blocking trades due to a network hiccup).
- If writing state file fails, operate in-memory only (don't crash).

---

## Feature 2: Real-Time Data Auto-Detection

### Problem

`ProviderManager` is instantiated as a module-level singleton (`provider_manager = ProviderManager()`) when `provider_manager.py` is imported. At that point, `.env` has not been loaded yet, so `os.environ.get("ALPACA_API_KEY")` returns `""` even if keys are present in `.env`. The provider always falls back to Yahoo Finance.

### Fix

Add `python-dotenv` to `requirements.txt` and call `load_dotenv()` at the top of:
- `app.py` (before all other imports)
- `scanner_alerts.py` (before all other imports)

This ensures env vars are populated before any provider or executor reads them.

### New Config Option

Add `REALTIME_PROVIDER` to `.env.example` (optional). When set, `ProviderManager` uses it as the preferred provider instead of auto-detecting by priority.

```
# Optional: pin a data provider ("alpaca", "polygon", "finnhub", "yahoo")
REALTIME_PROVIDER=alpaca
```

`ProviderManager.__init__` already accepts a `preferred` param — just read `os.getenv("REALTIME_PROVIDER")` and pass it in.

### Requirements Change

Add to `requirements.txt`:
```
python-dotenv>=1.0.0
```

---

## Feature 3: Fill Validation (Backtest vs. Actual Fills)

### What It Does

After every successful Alpaca paper trade, records the actual fill price alongside the "expected" price (last daily bar close from Yahoo Finance). Tracks slippage over time to answer: *Is the backtest realistic?*

### New File: `fill_validator.py`

**Class:** `FillValidator`

**Methods:**
- `record(order_result, symbol)` — fetches last close price, computes slippage, appends to JSON log
- `load_records()` → `List[Dict]` — returns all logged fills
- `summary()` → `Dict` — avg slippage %, win/loss count, total fills

**Slippage calculation:**
```
expected_price = last daily bar close (from Yahoo, always available)
slippage_pct = (fill_price - expected_price) / expected_price * 100
```
Positive slippage = paid more than expected (bad for buys, good for sells).

**State file:** `data/fill_validation.json` — append-only list of records:
```json
[
  {
    "timestamp": "2026-05-08T10:32:11",
    "symbol": "PLTR",
    "side": "buy",
    "notional": 40.00,
    "fill_price": 18.45,
    "expected_price": 18.31,
    "slippage_pct": 0.76,
    "order_id": "abc123"
  }
]
```

**Integration:** `AlpacaExecutor` accepts an optional `validator: FillValidator = None` in `__init__`. After a successful `_place_order` that returns `filled_price`, calls `self.validator.record(result)` if validator is set.

**UI:** New sidebar page "📊 Fill Validation" in `app.py`:
- Table showing all fill records (most recent first)
- Summary row: avg slippage %, total fills, fills with positive vs negative slippage
- No charts needed — a clean dataframe is sufficient for now

### Notes

- Only records fills where `filled_price` is not None (market orders sometimes return fill price immediately, sometimes after a poll — only log confirmed fills)
- If `filled_price` is None on the result, skip recording (don't log pending orders)
- Yahoo fallback for expected price is always available and consistent

---

## Files Changed / Created

| File | Change |
|------|--------|
| `trade_executor.py` | Add `CircuitBreaker` class; update `AlpacaExecutor.__init__` and `_place_order` |
| `fill_validator.py` | New file — `FillValidator` class |
| `app.py` | Add `load_dotenv()` at top; wire `FillValidator` into executor; add Fill Validation page |
| `scanner_alerts.py` | Add `load_dotenv()` at top |
| `requirements.txt` | Add `python-dotenv>=1.0.0` |
| `.env.example` | Add `REALTIME_PROVIDER=` entry |
| `data/` | Runtime files: `circuit_breaker_state.json`, `fill_validation.json` |

---

## Out of Scope

- PDT rule enforcement (future phase)
- Live (non-paper) trading automation
- Options execution via API
- Tax tracking
- Trailing stop enforcement in the executor
