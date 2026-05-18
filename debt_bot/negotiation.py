from __future__ import annotations

import math

from .models import DebtAccount, NegotiationOffer


_STRONG_HARDSHIP_KEYWORDS = (
    "job loss", "unemployment", "layoff", "disability",
    "medical", "illness", "divorce", "bankruptcy",
)


def disclosure_line() -> str:
    return (
        "Quick disclosure: I'm using an automated assistant to help organize this request, "
        "and I can confirm details as needed."
    )


def build_opening_script(account: DebtAccount) -> str:
    return (
        f"{disclosure_line()} "
        f"Hi, thanks for taking my call. I'm reaching out about account {account.account_reference}. "
        f"I want to stay on track, but I'm dealing with {account.hardship_reason}. "
        f"Right now I can realistically pay ${account.target_monthly_payment:,.2f} per month. "
        "I'm looking for a plan that lowers my payment without extending the overall payoff timeline. "
        "If possible, I'd also appreciate help with lowering the APR and removing fees so I can catch up faster."
    )


def build_counter_offer_script(account: DebtAccount, offer: NegotiationOffer) -> str:
    lines = [
        "I understand that may not be possible right away. Let me share what I can realistically do:",
        f"  - My absolute maximum monthly payment is ${offer.requested_payment:,.2f}.",
    ]
    if offer.settlement_amount:
        lines.append(
            f"  - If a lump-sum settlement is an option, I can put together ${offer.settlement_amount:,.2f}."
        )
    if offer.ask_apr_reduction:
        lines.append(
            "  - Even a temporary APR reduction to 0% for 12 months would help me avoid falling further behind."
        )
    lines += [
        "I'd really like to resolve this without going further delinquent or needing to pursue other options.",
        "Is there a supervisor or hardship department I can speak with who has more authority to help?",
    ]
    return "\n".join(lines)


def build_closing_script() -> str:
    return (
        "Thanks again for working with me today. Before we wrap up, could you send the terms in writing "
        "so I can review and make sure I follow everything correctly?"
    )


def _hardship_score(account: DebtAccount) -> int:
    """0-100 composite score of negotiating leverage; higher = stronger position."""
    score = 50
    reason_lower = account.hardship_reason.lower()
    if any(kw in reason_lower for kw in _STRONG_HARDSHIP_KEYWORDS):
        score += 20
    if account.apr_percent > 24:
        score += 10
    if account.current_balance > 10_000:
        score += 10
    if account.current_monthly_payment > 0:
        gap_ratio = (account.current_monthly_payment - account.target_monthly_payment) / account.current_monthly_payment
        if gap_ratio > 0.40:
            score += 10
    return min(score, 100)


def _settlement_pct(account: DebtAccount) -> float:
    """Fraction of balance to offer as lump-sum settlement; lower = better deal for consumer."""
    base = 0.55 if account.apr_percent <= 20 else 0.50
    # Large balances give more negotiating room
    if account.current_balance > 15_000:
        base -= 0.05
    elif account.current_balance < 2_000:
        base += 0.05
    # Documented hardship events push creditors to accept lower settlements
    if any(kw in account.hardship_reason.lower() for kw in _STRONG_HARDSHIP_KEYWORDS):
        base -= 0.05
    return max(0.30, min(0.70, base))


def _months_to_payoff(balance: float, monthly_payment: float, monthly_rate: float) -> int | None:
    if monthly_rate <= 0:
        return math.ceil(balance / monthly_payment) if monthly_payment > 0 else None
    if monthly_payment <= balance * monthly_rate:
        return None  # payment doesn't cover interest — never pays off
    n = math.log(monthly_payment / (monthly_payment - balance * monthly_rate)) / math.log(1 + monthly_rate)
    return math.ceil(n)


def _total_interest(balance: float, monthly_payment: float, months: int | None) -> float | None:
    if months is None:
        return None
    return max(0.0, round(monthly_payment * months - balance, 2))


def propose_offer(account: DebtAccount) -> NegotiationOffer:
    monthly_rate = account.apr_percent / 100 / 12

    settlement_amount: float | None = None
    if account.max_settlement_amount > 0:
        pct = _settlement_pct(account)
        settlement_amount = round(min(account.current_balance * pct, account.max_settlement_amount), 2)

    requested_payment = min(account.current_monthly_payment, account.target_monthly_payment)

    current_months = _months_to_payoff(account.current_balance, account.current_monthly_payment, monthly_rate)
    new_months = _months_to_payoff(account.current_balance, requested_payment, monthly_rate)
    current_interest = _total_interest(account.current_balance, account.current_monthly_payment, current_months)
    new_interest = _total_interest(account.current_balance, requested_payment, new_months)

    return NegotiationOffer(
        creditor_name=account.creditor_name,
        requested_payment=round(requested_payment, 2),
        settlement_amount=settlement_amount,
        hardship_score=_hardship_score(account),
        require_no_term_extension=True,
        ask_fee_waiver=True,
        ask_apr_reduction=account.apr_percent > 12,
        months_to_payoff=new_months,
        total_interest_at_current_plan=current_interest,
        total_interest_at_new_plan=new_interest,
    )


def payoff_comparison(
    balance: float,
    apr_percent: float,
    monthly_payment: float,
    extra_payment: float,
) -> dict:
    """Compare base payoff vs accelerated payoff when extra_payment is added each month.

    Returns a dict with base_months, base_interest, fast_months, fast_interest,
    months_saved, and interest_saved (all may be None if payment < interest).
    """
    monthly_rate = apr_percent / 100 / 12
    fast_payment = monthly_payment + extra_payment

    base_months = _months_to_payoff(balance, monthly_payment, monthly_rate)
    fast_months = _months_to_payoff(balance, fast_payment, monthly_rate)
    base_interest = _total_interest(balance, monthly_payment, base_months)
    fast_interest = _total_interest(balance, fast_payment, fast_months)

    months_saved: int | None = None
    interest_saved: float | None = None
    if base_months is not None and fast_months is not None:
        months_saved = base_months - fast_months
    if base_interest is not None and fast_interest is not None:
        interest_saved = round(base_interest - fast_interest, 2)

    return {
        "base_months": base_months,
        "base_interest": base_interest,
        "fast_months": fast_months,
        "fast_interest": fast_interest,
        "months_saved": months_saved,
        "interest_saved": interest_saved,
    }


def call_checklist() -> list[str]:
    return [
        "Confirm the representative's name, department, and call reference number.",
        "Disclose automation use clearly at the start of the interaction.",
        "Ask for hardship support that lowers monthly payment without adding extra months.",
        "Request APR reduction and any possible fee reversals.",
        "Ask for settlement options and request written confirmation.",
        "Avoid sharing full SSN unless on a verified secure line.",
        "Document every promise with date, amount, and due date.",
    ]
