"""
Alpaca Trade Executor.

Places and monitors orders via the Alpaca Broker API.
Supports PAPER mode (fake money, safe practice) and LIVE mode (real money).

Paper endpoint: https://paper-api.alpaca.markets
Live  endpoint: https://api.alpaca.markets

WARNING: Switching to live mode executes real trades with real money.
         Always validate extensively in paper mode first.
"""

import os
import json
import logging
import requests
from typing import Optional, Dict, List
from dataclasses import dataclass
from datetime import datetime
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


ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets"
ALPACA_LIVE_BASE = "https://api.alpaca.markets"


@dataclass
class OrderResult:
    success: bool
    order_id: Optional[str]
    symbol: str
    side: str
    notional: float
    status: str
    message: str
    filled_price: Optional[float]
    filled_qty: Optional[float]
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


@dataclass
class AlpacaPosition:
    symbol: str
    qty: float
    avg_entry_price: float
    current_price: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    market_value: float


@dataclass
class AccountInfo:
    portfolio_value: float
    buying_power: float
    cash: float
    equity: float
    daytrade_count: int
    pattern_day_trader: bool
    trading_blocked: bool
    account_blocked: bool
    status: str


class AlpacaExecutor:
    def __init__(self, paper: bool = True, notifier=None, validator=None):
        self.paper = paper
        self.base_url = ALPACA_PAPER_BASE if paper else ALPACA_LIVE_BASE
        self.api_key = os.getenv("ALPACA_API_KEY", "")
        self.secret_key = os.getenv("ALPACA_SECRET_KEY", "")
        self._breaker = CircuitBreaker(self, notifier=notifier)
        self._validator = validator

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.secret_key)

    @property
    def mode_label(self) -> str:
        return "PAPER" if self.paper else "LIVE"

    @property
    def _headers(self) -> Dict:
        return {
            "APCA-API-KEY-ID": self.api_key,
            "APCA-API-SECRET-KEY": self.secret_key,
            "Content-Type": "application/json"
        }

    def _get(self, path: str, params: Dict = None) -> Optional[Dict]:
        if not self.is_configured:
            return None
        try:
            resp = requests.get(
                f"{self.base_url}{path}",
                headers=self._headers,
                params=params or {},
                timeout=10
            )
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass
        return None

    def get_account(self) -> Optional[AccountInfo]:
        data = self._get("/v2/account")
        if not data:
            return None
        return AccountInfo(
            portfolio_value=float(data.get("portfolio_value", 0)),
            buying_power=float(data.get("buying_power", 0)),
            cash=float(data.get("cash", 0)),
            equity=float(data.get("equity", 0)),
            daytrade_count=int(data.get("daytrade_count", 0)),
            pattern_day_trader=data.get("pattern_day_trader", False),
            trading_blocked=data.get("trading_blocked", False),
            account_blocked=data.get("account_blocked", False),
            status=data.get("status", "unknown")
        )

    def get_positions(self) -> List[AlpacaPosition]:
        data = self._get("/v2/positions")
        if not data:
            return []
        positions = []
        for p in data:
            try:
                positions.append(AlpacaPosition(
                    symbol=p["symbol"],
                    qty=float(p["qty"]),
                    avg_entry_price=float(p["avg_entry_price"]),
                    current_price=float(p["current_price"]),
                    unrealized_pnl=float(p["unrealized_pl"]),
                    unrealized_pnl_pct=float(p["unrealized_plpc"]) * 100,
                    market_value=float(p["market_value"])
                ))
            except Exception:
                continue
        return positions

    def get_open_orders(self) -> List[Dict]:
        return self._get("/v2/orders", {"status": "open", "limit": 50}) or []

    def is_market_open(self) -> bool:
        data = self._get("/v2/clock")
        return bool(data and data.get("is_open", False))

    def place_buy(self, symbol: str, notional: float) -> OrderResult:
        """
        Buy a fractional share position by dollar amount (notional).
        Minimum notional: $1.00.
        """
        return self._place_order(symbol, notional, "buy")

    def place_sell_notional(self, symbol: str, notional: float) -> OrderResult:
        """Close a position by selling a dollar amount (notional)."""
        return self._place_order(symbol, notional, "sell")

    def close_position(self, symbol: str) -> OrderResult:
        """Close an entire open position by symbol."""
        if not self.is_configured:
            return self._unconfigured(symbol, "sell", 0)
        try:
            resp = requests.delete(
                f"{self.base_url}/v2/positions/{symbol}",
                headers=self._headers,
                timeout=10
            )
            if resp.status_code in (200, 204):
                data = resp.json() if resp.content else {}
                return OrderResult(
                    success=True,
                    order_id=data.get("id"),
                    symbol=symbol,
                    side="sell",
                    notional=0,
                    status="closed",
                    message=f"{symbol} position closed.",
                    filled_price=float(data["filled_avg_price"]) if data.get("filled_avg_price") else None,
                    filled_qty=float(data["filled_qty"]) if data.get("filled_qty") else None
                )
            return OrderResult(
                success=False, order_id=None, symbol=symbol, side="sell",
                notional=0, status="ERROR",
                message=f"Close failed — HTTP {resp.status_code}: {resp.text[:200]}",
                filled_price=None, filled_qty=None
            )
        except Exception as e:
            return OrderResult(
                success=False, order_id=None, symbol=symbol, side="sell",
                notional=0, status="ERROR", message=str(e),
                filled_price=None, filled_qty=None
            )

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
                success=False, order_id=None, symbol=symbol, side=side,
                notional=notional, status="ERROR",
                message=f"Minimum order is $1.00 — attempted ${notional:.2f}",
                filled_price=None, filled_qty=None
            )

        payload = {
            "symbol": symbol,
            "notional": str(round(notional, 2)),
            "side": side,
            "type": "market",
            "time_in_force": "day"
        }

        try:
            resp = requests.post(
                f"{self.base_url}/v2/orders",
                json=payload,
                headers=self._headers,
                timeout=10
            )
            data = resp.json()

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

            return OrderResult(
                success=False, order_id=None, symbol=symbol, side=side,
                notional=notional, status="REJECTED",
                message=data.get("message", f"Rejected — HTTP {resp.status_code}"),
                filled_price=None, filled_qty=None
            )

        except Exception as e:
            return OrderResult(
                success=False, order_id=None, symbol=symbol, side=side,
                notional=notional, status="ERROR",
                message=f"Request failed: {str(e)}",
                filled_price=None, filled_qty=None
            )

    def _unconfigured(self, symbol: str, side: str, notional: float) -> OrderResult:
        return OrderResult(
            success=False, order_id=None, symbol=symbol, side=side,
            notional=notional, status="ERROR",
            message="Alpaca API keys not set. Add ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables.",
            filled_price=None, filled_qty=None
        )
