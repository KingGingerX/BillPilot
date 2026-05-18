from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import date
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from .credit_repair import dispute_letter, escalation_letter, remediation_steps
from .models import CreditReportItem, DebtAccount
from .negotiation import (
    build_closing_script,
    build_counter_offer_script,
    build_opening_script,
    call_checklist,
    propose_offer,
)
from .storage import SecureTaskStore

_store: SecureTaskStore | None = None


def _get_store() -> SecureTaskStore:
    global _store
    if _store is None:
        _store = SecureTaskStore()
    return _store


def _write_output(text: str, output_path: str | None) -> None:
    if output_path:
        Path(output_path).write_text(text, encoding="utf-8")
        print(f"Output saved to {output_path}")
    else:
        print(text)


def cmd_negotiate(args: argparse.Namespace) -> None:
    account = DebtAccount(
        creditor_name=args.creditor,
        account_reference=args.account,
        current_balance=args.balance,
        current_monthly_payment=args.payment,
        apr_percent=args.apr,
        hardship_reason=args.hardship,
        target_monthly_payment=args.target_payment,
        max_settlement_amount=args.max_settlement,
    )

    store = _get_store()
    store.log_request(
        task_type="negotiate",
        details={"creditor_name": account.creditor_name, "account_reference": account.account_reference},
    )

    offer = propose_offer(account)
    opening = build_opening_script(account)
    counter = build_counter_offer_script(account, offer)

    lines: list[str] = []
    lines.append("=== Call opening ===")
    lines.append(opening)

    lines.append("\n=== Suggested offer ===")
    lines.append(f"  Hardship score            : {offer.hardship_score}/100")
    lines.append(f"  Requested monthly payment : ${offer.requested_payment:,.2f}")
    if offer.settlement_amount is not None:
        lines.append(f"  Settlement lump sum       : ${offer.settlement_amount:,.2f}")
    else:
        lines.append("  Settlement lump sum       : N/A (no lump-sum funds entered)")
    if offer.months_to_payoff:
        lines.append(f"  Months to pay off         : {offer.months_to_payoff}")
    if offer.total_interest_at_current_plan is not None and offer.total_interest_at_new_plan is not None:
        diff = offer.total_interest_at_current_plan - offer.total_interest_at_new_plan
        lines.append(f"  Interest (current plan)   : ${offer.total_interest_at_current_plan:,.2f}")
        lines.append(f"  Interest (new plan)       : ${offer.total_interest_at_new_plan:,.2f}")
        label = "Interest savings" if diff >= 0 else "Extra interest cost"
        sign = "-" if diff >= 0 else "+"
        lines.append(f"  {label:<26}: {sign}${abs(diff):,.2f}")
    lines.append(f"  Ask APR reduction         : {offer.ask_apr_reduction}")
    lines.append(f"  Ask fee waiver            : {offer.ask_fee_waiver}")

    lines.append("\n=== Call checklist ===")
    for step in call_checklist():
        lines.append(f"- {step}")

    lines.append("\n=== If they say no — counter-offer ===")
    lines.append(counter)

    lines.append("\n=== Natural closing line ===")
    lines.append(build_closing_script())

    output = "\n".join(lines)
    _write_output(output, getattr(args, "output", None))

    store.log_task_completed(
        task_type="negotiate",
        details={"requested_payment": offer.requested_payment, "settlement_amount": offer.settlement_amount},
    )


def cmd_dispute(args: argparse.Namespace) -> None:
    store = _get_store()
    pii_record_id = store.store_pii(
        task_type="dispute",
        pii_data={"consumer_name": args.name, "consumer_address": args.address},
    )
    store.log_request(
        task_type="dispute",
        details={
            "bureau": args.bureau,
            "furnisher": args.furnisher,
            "account_number_masked": args.account,
            "pii_record_id": pii_record_id,
        },
    )

    item = CreditReportItem(
        bureau=args.bureau,
        furnisher=args.furnisher,
        account_number_masked=args.account,
        issue_type=args.issue,
        details=args.details,
        date_identified=date.today(),
    )

    letter = dispute_letter(item=item, consumer_name=args.name, consumer_address=args.address)

    lines: list[str] = [letter, "\n=== Remediation workflow ==="]
    for step in remediation_steps():
        lines.append(f"- {step}")

    output = "\n".join(lines)
    _write_output(output, getattr(args, "output", None))

    store.log_task_completed(
        task_type="dispute",
        details={"bureau": args.bureau, "issue_type": args.issue, "pii_record_id": pii_record_id},
    )


def cmd_escalate(args: argparse.Namespace) -> None:
    item = CreditReportItem(
        bureau=args.bureau,
        furnisher=args.furnisher,
        account_number_masked=args.account,
        issue_type=args.issue,
        details=args.details,
        date_identified=date.today(),
    )
    prior_date = date.fromisoformat(args.prior_dispute_date)
    letter = escalation_letter(
        item=item,
        consumer_name=args.name,
        consumer_address=args.address,
        prior_dispute_date=prior_date,
    )
    _write_output(letter, getattr(args, "output", None))


def cmd_ui(_: argparse.Namespace) -> None:
    ui_module = str(Path(__file__).parent / "ui.py")
    try:
        subprocess.run([sys.executable, "-m", "streamlit", "run", ui_module], check=True)
    except FileNotFoundError:
        print("streamlit not found. Install it with:  pip install streamlit")
    except KeyboardInterrupt:
        pass


def cmd_history(_: argparse.Namespace) -> None:
    rows = _get_store().get_recent_history(limit=25)
    if not rows:
        print("No history found yet.")
        return
    for row in rows:
        print(
            f"[{row['created_at_utc']}] {row['event_type']} | "
            f"task={row['task_type']} | details={row['details']}"
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="billpilot",
        description="BillPilot — debt negotiation and credit-dispute assistant",
    )
    sub = parser.add_subparsers(required=True)

    negotiate = sub.add_parser("negotiate", help="Generate a creditor negotiation plan")
    negotiate.add_argument("--creditor", default="Sample Bank", metavar="NAME")
    negotiate.add_argument("--account", default="****1234", metavar="REF")
    negotiate.add_argument("--balance", type=float, default=8400.0, metavar="DOLLARS")
    negotiate.add_argument("--payment", type=float, default=320.0, metavar="DOLLARS",
                           help="Current monthly payment")
    negotiate.add_argument("--apr", type=float, default=24.99, metavar="PERCENT")
    negotiate.add_argument("--hardship", default="temporary income reduction", metavar="REASON")
    negotiate.add_argument("--target-payment", type=float, default=180.0,
                           dest="target_payment", metavar="DOLLARS")
    negotiate.add_argument("--max-settlement", type=float, default=4200.0,
                           dest="max_settlement", metavar="DOLLARS")
    negotiate.add_argument("--output", metavar="FILE", help="Save output to file instead of stdout")
    negotiate.set_defaults(func=cmd_negotiate)

    dispute = sub.add_parser("dispute", help="Draft a bureau dispute letter")
    dispute.add_argument("--bureau", required=True, choices=["Experian", "Equifax", "TransUnion"])
    dispute.add_argument("--furnisher", required=True)
    dispute.add_argument("--account", required=True)
    dispute.add_argument("--issue", required=True)
    dispute.add_argument("--details", required=True)
    dispute.add_argument("--name", required=True)
    dispute.add_argument("--address", required=True)
    dispute.add_argument("--output", metavar="FILE", help="Save output to file instead of stdout")
    dispute.set_defaults(func=cmd_dispute)

    escalate = sub.add_parser("escalate", help="Draft a CFPB escalation letter for an unresolved dispute")
    escalate.add_argument("--bureau", required=True, choices=["Experian", "Equifax", "TransUnion"])
    escalate.add_argument("--furnisher", required=True)
    escalate.add_argument("--account", required=True)
    escalate.add_argument("--issue", required=True)
    escalate.add_argument("--details", required=True)
    escalate.add_argument("--name", required=True)
    escalate.add_argument("--address", required=True)
    escalate.add_argument("--prior-dispute-date", required=True, metavar="YYYY-MM-DD",
                          dest="prior_dispute_date", help="Date you submitted the original bureau dispute")
    escalate.add_argument("--output", metavar="FILE", help="Save output to file instead of stdout")
    escalate.set_defaults(func=cmd_escalate)

    ui_cmd = sub.add_parser("ui", help="Show UI launch instructions")
    ui_cmd.set_defaults(func=cmd_ui)

    history = sub.add_parser("history", help="Show recent request/task history")
    history.set_defaults(func=cmd_history)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
