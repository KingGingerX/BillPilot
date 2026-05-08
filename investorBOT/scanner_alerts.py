# InvestorBot — Headless Scanner with Alerts
#
# Run manually:   python scanner_alerts.py
# Run dry-run:    python scanner_alerts.py --dry-run
# Override score: python scanner_alerts.py --min-score 6
#
# Schedule daily (Windows Task Scheduler):
#   schtasks /create /tn "InvestorBot Scan" /tr "C:\users\goods\investorbot\venv\Scripts\python.exe C:\users\goods\investorbot\scanner_alerts.py" /sc daily /st 09:25
#
# The scheduled task runs the venv Python directly so no activation needed.
# Set environment variables in the task's "Edit Action > Start in" and via
# System Environment Variables or a wrapper .bat that sets them before calling python.

from dotenv import load_dotenv
load_dotenv()

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# ANSI colour helpers (work on Windows 10+ with ANSI enabled, safe to ignore)
# ---------------------------------------------------------------------------
RESET  = "\033[0m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BOLD   = "\033[1m"
DIM    = "\033[2m"


def _colour(text: str, code: str) -> str:
    """Wrap text in an ANSI escape code."""
    return f"{code}{text}{RESET}"


# ---------------------------------------------------------------------------
# Enable ANSI on Windows consoles (no-op on other platforms)
# ---------------------------------------------------------------------------
def _enable_ansi_windows() -> None:
    if sys.platform != "win32":
        return
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        # Enable ENABLE_VIRTUAL_TERMINAL_PROCESSING (0x0004)
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    _enable_ansi_windows()

    parser = argparse.ArgumentParser(
        description="InvestorBot headless scanner — scans watchlist and sends alerts."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print results but skip Telegram/email alerts.",
    )
    parser.add_argument(
        "--min-score",
        type=int,
        default=None,
        help="Minimum signal score (1-9). Overrides MIN_SCORE env var.",
    )
    args = parser.parse_args()

    # ------------------------------------------------------------------
    # Resolve min_score: CLI flag > env var > default 7
    # ------------------------------------------------------------------
    if args.min_score is not None:
        min_score = args.min_score
    else:
        try:
            min_score = int(os.getenv("MIN_SCORE", "7"))
        except ValueError:
            min_score = 7

    # ------------------------------------------------------------------
    # Build ticker list: DEFAULT_WATCHLIST + EXTRA_TICKERS env var
    # ------------------------------------------------------------------
    try:
        from config import DEFAULT_WATCHLIST
    except ImportError as exc:
        print(_colour(f"[ERROR] Cannot import config: {exc}", RED))
        sys.exit(1)

    extra_raw = os.getenv("EXTRA_TICKERS", "").strip()
    extra_tickers = [t.strip().upper() for t in extra_raw.split(",") if t.strip()]
    all_tickers = list(dict.fromkeys(DEFAULT_WATCHLIST + extra_tickers))  # deduplicate, preserve order

    # ------------------------------------------------------------------
    # Import scanner
    # ------------------------------------------------------------------
    try:
        from signal_scorer import scan_watchlist
    except ImportError as exc:
        print(_colour(f"[ERROR] Cannot import signal_scorer: {exc}", RED))
        sys.exit(1)

    # ------------------------------------------------------------------
    # Run scan
    # ------------------------------------------------------------------
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(_colour(f"\n{'='*60}", DIM))
    print(_colour(f"  InvestorBot Daily Scan — {now_str}", BOLD))
    print(_colour(f"  Tickers: {len(all_tickers)}  |  Min score: {min_score}/9", DIM))
    if args.dry_run:
        print(_colour("  DRY-RUN mode — alerts will NOT be sent", YELLOW))
    print(_colour(f"{'='*60}\n", DIM))

    try:
        results = scan_watchlist(tickers=all_tickers, min_score=min_score)
    except Exception as exc:
        print(_colour(f"[ERROR] scan_watchlist failed: {exc}", RED))
        sys.exit(1)

    # ------------------------------------------------------------------
    # Print results to console
    # ------------------------------------------------------------------
    if not results:
        print(_colour("  No setups met the min-score threshold today.", DIM))
    else:
        print(_colour(f"  Found {len(results)} setup(s):\n", BOLD))
        for scored in results:
            if scored.conviction in ("EXTREME", "HIGH"):
                colour = GREEN
            elif scored.conviction == "MEDIUM":
                colour = YELLOW
            else:
                colour = RESET

            passing = [name for name, passed in scored.signals.items() if passed]
            signal_str = ", ".join(passing) if passing else "—"

            from compound_engine import TAKE_PROFIT_PCT, STOP_LOSS_PCT
            tp = round(scored.price * (1 + TAKE_PROFIT_PCT), 2)
            sl = round(scored.price * (1 - STOP_LOSS_PCT), 2)

            print(_colour(
                f"  {scored.ticker:<6}  {scored.score}/{scored.max_score}  "
                f"({scored.conviction:<7})  @ ${scored.price:<8.2f}  "
                f"TP ${tp:.2f}  SL ${sl:.2f}",
                colour,
            ))
            print(_colour(f"         Signals: {signal_str}", DIM))
            print()

    # ------------------------------------------------------------------
    # Save results to data/scan_results.json
    # ------------------------------------------------------------------
    data_dir = Path(__file__).parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    results_path = data_dir / "scan_results.json"

    scan_record = {
        "timestamp": now_str,
        "min_score": min_score,
        "tickers_scanned": len(all_tickers),
        "results_count": len(results),
        "results": [
            {
                "ticker": s.ticker,
                "score": s.score,
                "max_score": s.max_score,
                "price": s.price,
                "conviction": s.conviction,
                "passing_signals": [name for name, v in s.signals.items() if v],
            }
            for s in results
        ],
    }

    try:
        # Keep a rolling history: load existing, prepend new record, cap at 30 runs
        history = []
        if results_path.exists():
            with open(results_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
            if isinstance(existing, list):
                history = existing
            elif isinstance(existing, dict):
                history = [existing]
        history.insert(0, scan_record)
        history = history[:30]  # keep last 30 runs
        with open(results_path, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)
        print(_colour(f"  Results saved -> {results_path}", DIM))
    except Exception as exc:
        print(_colour(f"[WARNING] Could not save results: {exc}", YELLOW))

    # ------------------------------------------------------------------
    # Send alerts (skipped in dry-run mode)
    # ------------------------------------------------------------------
    if results and not args.dry_run:
        try:
            from notifier import Notifier
            notifier = Notifier()
            notifier.alert_scan_results(results)
            print(_colour("  Telegram/email alerts sent.", GREEN))
        except Exception as exc:
            print(_colour(f"[WARNING] Alert send failed: {exc}", YELLOW))
    elif args.dry_run and results:
        print(_colour("  [DRY-RUN] Skipping alerts.", YELLOW))

    print(_colour(f"\n{'='*60}\n", DIM))
    sys.exit(0)


if __name__ == "__main__":
    main()
