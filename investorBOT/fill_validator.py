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
