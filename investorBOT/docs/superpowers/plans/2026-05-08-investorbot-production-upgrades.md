# InvestorBot Production Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily loss circuit breaker, fix real-time data auto-detection via dotenv, and add fill-vs-backtest slippage tracking to prepare InvestorBot for live paper trading with Telegram alerts.

**Architecture:** Three isolated features touch four files: `trade_executor.py` gains a `CircuitBreaker` class; `fill_validator.py` is created from scratch; `app.py` and `scanner_alerts.py` each get a two-line dotenv fix and minimal wiring. The `CircuitBreaker` and `FillValidator` own their own JSON state files under `data/`.

**Tech Stack:** Python 3.9+, Streamlit, yfinance (expected price), Alpaca REST API (account value), python-dotenv (env loading), standard library `json`/`datetime`/`pathlib`.

---

## File Map

| File | What Changes |
|------|-------------|
| `requirements.txt` | Add `python-dotenv>=1.0.0` |
| `.env.example` | Add `REALTIME_PROVIDER=` entry |
| `data_providers/provider_manager.py` | Read `REALTIME_PROVIDER` env var in `__init__` |
| `trade_executor.py` | Add `CircuitBreaker` class; update `AlpacaExecutor.__init__` and `_place_order` |
| `fill_validator.py` | New file — `FillValidator` class |
| `scanner_alerts.py` | Add `load_dotenv()` before all other imports |
| `app.py` | Add `load_dotenv()` before all other imports; add sidebar page; wire `FillValidator` into executor on Compounder page |

---

## Task 1: Add python-dotenv and fix env loading

**Files:**
- Modify: `requirements.txt`
- Modify: `.env.example`
- Modify: `data_providers/provider_manager.py`
- Modify: `scanner_alerts.py`
- Modify: `app.py`

- [ ] **Step 1: Add python-dotenv to requirements**

Open `requirements.txt`. It currently reads:
```
streamlit>=1.28.0
yfinance>=0.2.28
pandas>=2.0.0
numpy>=1.24.0
requests>=2.31.0
plotly>=5.17.0
schedule>=1.2.0
```

Replace the full file with:
```
streamlit>=1.28.0
yfinance>=0.2.28
pandas>=2.0.0
numpy>=1.24.0
requests>=2.31.0
plotly>=5.17.0
schedule>=1.2.0
python-dotenv>=1.0.0
```

- [ ] **Step 2: Install the new dependency**

Run inside the activated venv:
```
pip install python-dotenv>=1.0.0
```

Expected output ends with: `Successfully installed python-dotenv-X.X.X`

- [ ] **Step 3: Add REALTIME_PROVIDER to .env.example**

Open `.env.example`. Add this block before `# Scanner settings`:
```
# Optional: pin a real-time data provider ("alpaca", "polygon", "finnhub", "yahoo")
# If unset, auto-selects the first configured provider in priority order.
REALTIME_PROVIDER=
```

- [ ] **Step 4: Wire REALTIME_PROVIDER into ProviderManager**

Open `data_providers/provider_manager.py`. Find `__init__`:
```python
def __init__(self, preferred: Optional[str] = None):
    self.providers: Dict[str, BaseProvider] = {
```

Replace it with:
```python
def __init__(self, preferred: Optional[str] = None):
    if preferred is None:
        preferred = os.getenv("REALTIME_PROVIDER") or None
    self.providers: Dict[str, BaseProvider] = {
```

- [ ] **Step 5: Add load_dotenv to scanner_alerts.py**

Open `scanner_alerts.py`. The file currently starts with a multi-line comment block followed by:
```python
import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
```

Insert two lines immediately before `import argparse`:
```python
from dotenv import load_dotenv
load_dotenv()

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
```

- [ ] **Step 6: Add load_dotenv to app.py**

Open `app.py`. The file currently starts with a docstring then:
```python
import streamlit as st
import plotly.graph_objects as go
```

Insert two lines immediately before `import streamlit as st`:
```python
from dotenv import load_dotenv
load_dotenv()

import streamlit as st
```

- [ ] **Step 7: Smoke-test env loading**

With your `.env` containing `ALPACA_API_KEY` and `ALPACA_SECRET_KEY`, run:
```
python -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.getenv('ALPACA_API_KEY', 'NOT SET'))"
```

Expected: prints your key (not `NOT SET`).

Then run:
```
python -c "from dotenv import load_dotenv; load_dotenv(); from data_providers.provider_manager import provider_manager; print(provider_manager.active_name)"
```

Expected: `alpaca` (if Alpaca keys are in `.env`), or `yahoo` if they are not.

- [ ] **Step 8: Commit**

```bash
git add requirements.txt .env.example data_providers/provider_manager.py scanner_alerts.py app.py
git commit -m "feat: auto-detect real-time provider via dotenv on startup"
```

---

## Task 2: CircuitBreaker class in trade_executor.py

**Files:**
- Modify: `trade_executor.py`

This task adds the `CircuitBreaker` class and wires it into `AlpacaExecutor`. The breaker owns its state in `data/circuit_breaker_state.json`. It checks daily P&L before every order and fires one Telegram alert when the 5% threshold is crossed.

- [ ] **Step 1: Add the CircuitBreaker class**

Open `trade_executor.py`. After the imports block (after `from datetime import datetime`), add the following new imports and class. Insert them after the existing imports, before the `ALPACA_PAPER_BASE` constant:

```python
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_STATE_FILE = Path(__file__).parent / "data" / "circuit_breaker_state.json"
_LOSS_LIMIT = 0.05  # 5% daily drawdown triggers halt


class CircuitBreaker:
    """
    Tracks daily portfolio drawdown and blocks orders when the 5% loss limit
    is reached. State persists to data/circuit_breaker_state.json so it
    survives app restarts within the same trading day.
    """

    def __init__(self, executor: "AlpacaExecutor", notifier=None):
        self._executor = executor
        self._notifier = notifier
        self._state = self._load_state()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def check(self) -> tuple[bool, str]:
        """
        Returns (allowed, message).
        allowed=True  → order may proceed.
        allowed=False → order is blocked; message explains why.
        """
        if not self._executor.is_configured:
            return True, ""

        today = self._today()

        # Reset if a new day has started
        if self._state.get("date") != today:
            self._state = {"date": today, "start_value": None, "halted": False, "triggered_at": None}
            self._save_state()

        # If already halted today, block immediately
        if self._state.get("halted"):
            return False, "⛔ Circuit breaker active. Daily loss limit reached. No new orders until tomorrow."

        # Fetch current portfolio value
        account = self._executor.get_account()
        if account is None:
            logger.warning("CircuitBreaker: could not fetch account — allowing order through.")
            return True, ""

        current_value = account.portfolio_value

        # Record start-of-day value on first check
        if self._state.get("start_value") is None:
            self._state["start_value"] = current_value
            self._save_state()
            return True, ""

        start_value = self._state["start_value"]
        if start_value <= 0:
            return True, ""

        drawdown = (start_value - current_value) / start_value

        if drawdown >= _LOSS_LIMIT:
            self._trigger(drawdown, current_value, start_value)
            return False, (
                f"⛔ Circuit breaker triggered — daily loss {drawdown * 100:.1f}% "
                f"(${start_value - current_value:.2f}). No new orders until tomorrow."
            )

        return True, ""

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _trigger(self, drawdown: float, current: float, start: float) -> None:
        if self._state.get("halted"):
            return  # already triggered — don't send duplicate alert
        self._state["halted"] = True
        self._state["triggered_at"] = datetime.now().isoformat()
        self._save_state()

        msg = (
            f"⛔ <b>InvestorBot Circuit Breaker Triggered</b>\n"
            f"Daily loss: <b>{drawdown * 100:.1f}%</b> "
            f"(${start - current:.2f} lost)\n"
            f"Start value: ${start:.2f} → Current: ${current:.2f}\n"
            f"No new orders will be placed until tomorrow.\n"
            f"Open positions are untouched — manage manually."
        )
        if self._notifier:
            try:
                self._notifier.send_telegram(msg)
            except Exception as exc:
                logger.warning("CircuitBreaker alert failed: %s", exc)

    def _load_state(self) -> dict:
        try:
            if _STATE_FILE.exists():
                with open(_STATE_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return {"date": None, "start_value": None, "halted": False, "triggered_at": None}

    def _save_state(self) -> None:
        try:
            _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(_STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(self._state, f, indent=2)
        except Exception as exc:
            logger.warning("CircuitBreaker: could not save state: %s", exc)

    @staticmethod
    def _today() -> str:
        return datetime.now().strftime("%Y-%m-%d")
```

- [ ] **Step 2: Update AlpacaExecutor.__init__ to own a CircuitBreaker**

Find the existing `__init__`:
```python
    def __init__(self, paper: bool = True):
        self.paper = paper
        self.base_url = ALPACA_PAPER_BASE if paper else ALPACA_LIVE_BASE
        self.api_key = os.getenv("ALPACA_API_KEY", "")
        self.secret_key = os.getenv("ALPACA_SECRET_KEY", "")
```

Replace it with:
```python
    def __init__(self, paper: bool = True, notifier=None):
        self.paper = paper
        self.base_url = ALPACA_PAPER_BASE if paper else ALPACA_LIVE_BASE
        self.api_key = os.getenv("ALPACA_API_KEY", "")
        self.secret_key = os.getenv("ALPACA_SECRET_KEY", "")
        self._breaker = CircuitBreaker(self, notifier=notifier)
```

- [ ] **Step 3: Call the circuit breaker inside _place_order**

Find the existing `_place_order` method. It currently starts with:
```python
    def _place_order(self, symbol: str, notional: float, side: str) -> OrderResult:
        if not self.is_configured:
            return self._unconfigured(symbol, side, notional)

        if notional < 1.0:
            return OrderResult(
```

Insert the breaker check after the `is_configured` guard:
```python
    def _place_order(self, symbol: str, notional: float, side: str) -> OrderResult:
        if not self.is_configured:
            return self._unconfigured(symbol, side, notional)

        allowed, reason = self._breaker.check()
        if not allowed:
            return OrderResult(
                success=False, order_id=None, symbol=symbol, side=side,
                notional=notional, status="CIRCUIT_BREAKER",
                message=reason, filled_price=None, filled_qty=None
            )

        if notional < 1.0:
            return OrderResult(
```

- [ ] **Step 4: Manual smoke test**

Run the following to verify the breaker loads without errors:
```
python -c "
from dotenv import load_dotenv; load_dotenv()
from trade_executor import AlpacaExecutor
ex = AlpacaExecutor(paper=True)
print('CircuitBreaker initialized:', ex._breaker)
print('Breaker state:', ex._breaker._state)
"
```

Expected: prints the executor and a state dict with `halted: false`.

- [ ] **Step 5: Commit**

```bash
git add trade_executor.py
git commit -m "feat: daily loss circuit breaker — halts orders at 5% drawdown with Telegram alert"
```

---

## Task 3: FillValidator — slippage tracking

**Files:**
- Create: `fill_validator.py`
- Modify: `trade_executor.py` (wire validator into `_place_order`)

- [ ] **Step 1: Create fill_validator.py**

Create a new file at `fill_validator.py` with the full content below:

```python
"""
FillValidator — records actual Alpaca fill prices vs expected (last bar close).

Slippage is the % difference between what you paid and what the backtester
would have assumed. Positive slippage = overpaid (bad for buys, good for sells).

State file: data/fill_validation.json (append-only list of fill records)
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import yfinance as yf

logger = logging.getLogger(__name__)

_VALIDATION_FILE = Path(__file__).parent / "data" / "fill_validation.json"


class FillValidator:
    """Records fill-vs-expected slippage after each Alpaca paper trade."""

    def record(self, order_result, symbol: str) -> Optional[Dict]:
        """
        Fetch last daily bar close for symbol and record slippage.

        order_result: OrderResult from AlpacaExecutor._place_order
        symbol:       Ticker (e.g. "PLTR")

        Returns the recorded dict, or None if skipped (no fill price).
        """
        if order_result.filled_price is None:
            return None

        expected = self._fetch_last_close(symbol)
        if expected is None or expected <= 0:
            logger.warning("FillValidator: could not get expected price for %s", symbol)
            return None

        fill_price = order_result.filled_price
        slippage_pct = (fill_price - expected) / expected * 100

        record = {
            "timestamp": datetime.now().isoformat(),
            "symbol": symbol.upper(),
            "side": order_result.side,
            "notional": order_result.notional,
            "fill_price": round(fill_price, 4),
            "expected_price": round(expected, 4),
            "slippage_pct": round(slippage_pct, 4),
            "order_id": order_result.order_id or "",
        }

        self._append(record)
        return record

    def load_records(self) -> List[Dict]:
        """Return all fill records, most recent first."""
        try:
            if _VALIDATION_FILE.exists():
                with open(_VALIDATION_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    return list(reversed(data))
        except Exception as exc:
            logger.warning("FillValidator: could not load records: %s", exc)
        return []

    def summary(self) -> Dict:
        """Return aggregate stats across all fill records."""
        records = self.load_records()
        if not records:
            return {"total_fills": 0, "avg_slippage_pct": 0.0, "positive_slippage": 0, "negative_slippage": 0}

        slippages = [r["slippage_pct"] for r in records]
        return {
            "total_fills": len(records),
            "avg_slippage_pct": round(sum(slippages) / len(slippages), 4),
            "positive_slippage": sum(1 for s in slippages if s > 0),
            "negative_slippage": sum(1 for s in slippages if s <= 0),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _fetch_last_close(self, symbol: str) -> Optional[float]:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="2d", interval="1d")
            if hist.empty:
                return None
            return float(hist["Close"].iloc[-1])
        except Exception as exc:
            logger.warning("FillValidator: yfinance error for %s: %s", symbol, exc)
            return None

    def _append(self, record: Dict) -> None:
        try:
            _VALIDATION_FILE.parent.mkdir(parents=True, exist_ok=True)
            records = []
            if _VALIDATION_FILE.exists():
                with open(_VALIDATION_FILE, "r", encoding="utf-8") as f:
                    existing = json.load(f)
                if isinstance(existing, list):
                    records = existing
            records.append(record)
            with open(_VALIDATION_FILE, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)
        except Exception as exc:
            logger.warning("FillValidator: could not save record: %s", exc)
```

- [ ] **Step 2: Wire FillValidator into AlpacaExecutor**

Open `trade_executor.py`. Update `AlpacaExecutor.__init__` to accept a validator:
```python
    def __init__(self, paper: bool = True, notifier=None, validator=None):
        self.paper = paper
        self.base_url = ALPACA_PAPER_BASE if paper else ALPACA_LIVE_BASE
        self.api_key = os.getenv("ALPACA_API_KEY", "")
        self.secret_key = os.getenv("ALPACA_SECRET_KEY", "")
        self._breaker = CircuitBreaker(self, notifier=notifier)
        self._validator = validator
```

Then find the end of `_place_order`, specifically the successful branch that returns an `OrderResult` with `success=True`:
```python
            if resp.status_code in (200, 201):
                return OrderResult(
                    success=True,
                    order_id=data.get("id"),
                    symbol=symbol,
                    side=side,
                    notional=notional,
                    status=data.get("status", "submitted"),
                    message=f"[{self.mode_label}] Order placed. ID: {data.get('id', 'N/A')}",
                    filled_price=float(data["filled_avg_price"]) if data.get("filled_avg_price") else None,
                    filled_qty=float(data["filled_qty"]) if data.get("filled_qty") else None
                )
```

Replace with:
```python
            if resp.status_code in (200, 201):
                result = OrderResult(
                    success=True,
                    order_id=data.get("id"),
                    symbol=symbol,
                    side=side,
                    notional=notional,
                    status=data.get("status", "submitted"),
                    message=f"[{self.mode_label}] Order placed. ID: {data.get('id', 'N/A')}",
                    filled_price=float(data["filled_avg_price"]) if data.get("filled_avg_price") else None,
                    filled_qty=float(data["filled_qty"]) if data.get("filled_qty") else None
                )
                if self._validator is not None:
                    try:
                        self._validator.record(result, symbol)
                    except Exception as exc:
                        logger.warning("FillValidator.record failed: %s", exc)
                return result
```

- [ ] **Step 3: Smoke test FillValidator standalone**

```
python -c "
from fill_validator import FillValidator
v = FillValidator()
price = v._fetch_last_close('PLTR')
print('PLTR last close:', price)
print('Summary:', v.summary())
"
```

Expected: prints a price like `17.83` and a summary dict with `total_fills: 0`.

- [ ] **Step 4: Commit**

```bash
git add fill_validator.py trade_executor.py
git commit -m "feat: fill validator — record actual vs expected fill price slippage after each trade"
```

---

## Task 4: Fill Validation page in app.py

**Files:**
- Modify: `app.py`

This task adds the "📊 Fill Validation" sidebar page and wires `FillValidator` into the executor on the Compounder page.

- [ ] **Step 1: Add Fill Validation to the sidebar page list**

Find the `page = st.sidebar.radio(...)` call in `app.py`. The current list ends with:
```python
        "🚀 Compounder",
        "📚 Education"
```

Replace with:
```python
        "🚀 Compounder",
        "📊 Fill Validation",
        "📚 Education"
```

- [ ] **Step 2: Import FillValidator at the top of app.py**

Find the existing import block in `app.py`. After the `from trade_executor import AlpacaExecutor` line, add:
```python
from fill_validator import FillValidator
```

- [ ] **Step 3: Initialize a shared FillValidator in session state**

Find the session state initialization block near the top of `app.py`:
```python
if "portfolio" not in st.session_state:
    st.session_state.portfolio = PaperPortfolio()
if "compounder" not in st.session_state:
    st.session_state.compounder = CompoundEngine()
if "scan_results" not in st.session_state:
    st.session_state.scan_results = []
```

Add one more line after those three:
```python
if "fill_validator" not in st.session_state:
    st.session_state.fill_validator = FillValidator()
```

- [ ] **Step 4: Wire validator into the Compounder page executor**

Find this line in the Compounder page section (around line 815):
```python
    executor = AlpacaExecutor(paper=engine.state.is_paper)
```

Replace with:
```python
    executor = AlpacaExecutor(
        paper=engine.state.is_paper,
        validator=st.session_state.fill_validator,
    )
```

- [ ] **Step 5: Add the Fill Validation page handler**

Find the Education page handler:
```python
# --- EDUCATION PAGE ---
elif page == "📚 Education":
```

Insert the new page block immediately before it:
```python
# --- FILL VALIDATION PAGE ---
elif page == "📊 Fill Validation":
    st.title("📊 Fill Validation — Backtest vs. Actual")
    st.info(
        "Every Alpaca paper trade records the actual fill price vs the expected price "
        "(last daily bar close). Slippage shows how realistic your backtests are. "
        "Positive slippage = you paid more than the backtest assumed (bad for buys)."
    )

    validator = st.session_state.fill_validator
    summary = validator.summary()
    records = validator.load_records()

    # Summary metrics
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Total Fills", summary["total_fills"])
    m2.metric("Avg Slippage", f"{summary['avg_slippage_pct']:+.2f}%")
    m3.metric("Overpaid Fills", summary["positive_slippage"])
    m4.metric("At/Under Expected", summary["negative_slippage"])

    st.markdown("---")

    if not records:
        st.info("No fill records yet. Place a paper trade via the Compounder page to start tracking.")
    else:
        import pandas as pd
        df = pd.DataFrame(records)
        df["slippage_pct"] = df["slippage_pct"].map(lambda x: f"{x:+.3f}%")
        df["fill_price"] = df["fill_price"].map(lambda x: f"${x:.4f}")
        df["expected_price"] = df["expected_price"].map(lambda x: f"${x:.4f}")
        df["notional"] = df["notional"].map(lambda x: f"${x:.2f}")
        df = df.rename(columns={
            "timestamp": "Time",
            "symbol": "Ticker",
            "side": "Side",
            "notional": "$ Amount",
            "fill_price": "Fill Price",
            "expected_price": "Expected",
            "slippage_pct": "Slippage",
            "order_id": "Order ID",
        })
        st.dataframe(df, use_container_width=True)

    st.markdown("---")
    st.caption("Expected price = last daily bar close from Yahoo Finance at time of trade.")

```

- [ ] **Step 6: Run the app and verify the new page loads**

```
streamlit run app.py
```

Navigate to "📊 Fill Validation" in the sidebar. Expected: page renders with summary metrics showing zeros and the "No fill records yet" message. No Python errors in the terminal.

- [ ] **Step 7: Commit**

```bash
git add app.py
git commit -m "feat: fill validation page — display fill vs expected slippage in sidebar"
```

---

## Task 5: End-to-end verification

**Files:** None — verification only.

- [ ] **Step 1: Verify dotenv loads provider correctly**

```
python -c "
from dotenv import load_dotenv; load_dotenv()
from data_providers.provider_manager import provider_manager
print('Active provider:', provider_manager.active_name)
print('Is real-time:', provider_manager.is_realtime())
print('Configured providers:', provider_manager.list_configured_providers())
"
```

Expected if Alpaca keys present: `Active provider: alpaca`, `Is real-time: True`.
Expected if no keys: `Active provider: yahoo`, `Is real-time: False`.

- [ ] **Step 2: Verify circuit breaker state file path**

```
python -c "
from dotenv import load_dotenv; load_dotenv()
from trade_executor import AlpacaExecutor
ex = AlpacaExecutor(paper=True)
print('State file:', ex._breaker._state)
print('Halted:', ex._breaker._state.get('halted'))
"
```

Expected: `Halted: False` and state dict with today's date if Alpaca is configured.

- [ ] **Step 3: Verify FillValidator file structure**

```
python -c "
from fill_validator import FillValidator
v = FillValidator()
print('Records:', v.load_records())
print('Summary:', v.summary())
"
```

Expected: `Records: []`, `Summary: {'total_fills': 0, ...}`.

- [ ] **Step 4: Run headless scanner with dry-run to confirm no import errors**

```
python scanner_alerts.py --dry-run
```

Expected: scans watchlist, prints results (or "No setups"), exits 0. No `ImportError` or `ModuleNotFoundError`.

- [ ] **Step 5: Launch the Streamlit app and navigate all three affected areas**

```
streamlit run app.py
```

Check:
- Sidebar shows correct active provider (not always "Yahoo" if keys are set)
- "🚀 Compounder" page loads without error
- "📊 Fill Validation" page loads and shows summary metrics at zero

- [ ] **Step 6: Final commit if any loose changes**

```bash
git status
# If clean, nothing to do. If any stray edits:
git add -A
git commit -m "chore: final wiring and cleanup for production upgrades"
```
