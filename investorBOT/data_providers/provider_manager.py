"""
Provider Manager - orchestrates multiple data sources.
Tries real-time providers first, falls back to Yahoo Finance.
"""

import os
from typing import Optional, Dict, List
import pandas as pd

from .base_provider import BaseProvider, Quote
from .yahoo_provider import YahooProvider
from .alpaca_provider import AlpacaProvider
from .polygon_provider import PolygonProvider
from .finnhub_provider import FinnhubProvider


class ProviderManager:
    """
    Manages multiple data providers with automatic fallback.
    Priority: Alpaca -> Polygon -> Finnhub -> Yahoo (free fallback)
    """
    
    def __init__(self, preferred: Optional[str] = None):
        if preferred is None:
            preferred = os.getenv("REALTIME_PROVIDER") or None
        self.providers: Dict[str, BaseProvider] = {
            "alpaca": AlpacaProvider(),
            "polygon": PolygonProvider(),
            "finnhub": FinnhubProvider(),
            "yahoo": YahooProvider(),
        }
        self._preferred = preferred
        self._active = self._determine_active()
    
    def _determine_active(self) -> BaseProvider:
        if self._preferred:
            p = self.providers.get(self._preferred)
            if p and p.is_configured():
                return p
        
        for name in ["alpaca", "polygon", "finnhub", "yahoo"]:
            p = self.providers[name]
            if p.is_configured():
                return p
        
        return self.providers["yahoo"]  # Always works
    
    @property
    def active_provider(self) -> BaseProvider:
        return self._active
    
    @property
    def active_name(self) -> str:
        return self._active.name
    
    def is_realtime(self) -> bool:
        return self._active.supports_realtime
    
    def get_quote(self, symbol: str) -> Optional[Quote]:
        quote = self._active.get_quote(symbol)
        if quote is None and self._active.name != "yahoo":
            quote = self.providers["yahoo"].get_quote(symbol)
        return quote
    
    def get_quotes(self, symbols: List[str]) -> Dict[str, Quote]:
        results = self._active.get_quotes(symbols)
        # Fill any missing from Yahoo
        missing = [s for s in symbols if s.upper() not in results]
        if missing and self._active.name != "yahoo":
            yahoo_results = self.providers["yahoo"].get_quotes(missing)
            results.update(yahoo_results)
        return results
    
    def get_history(self, symbol: str, period: str = "3mo", interval: str = "1d") -> Optional[pd.DataFrame]:
        df = self._active.get_history(symbol, period, interval)
        if df is None and self._active.name != "yahoo":
            df = self.providers["yahoo"].get_history(symbol, period, interval)
        return df
    
    def get_options_chain(self, symbol: str) -> Optional[Dict]:
        # yfinance currently has the best free options support
        return self.providers["yahoo"].get_options_chain(symbol)
    
    def list_configured_providers(self) -> List[str]:
        return [name for name, p in self.providers.items() if p.is_configured()]
    
    def set_provider(self, name: str):
        if name in self.providers:
            self._preferred = name
            self._active = self.providers[name]


# Global instance
provider_manager = ProviderManager()
