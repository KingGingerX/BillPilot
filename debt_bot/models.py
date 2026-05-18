from __future__ import annotations

from datetime import date

from pydantic import BaseModel, field_validator


class DebtAccount(BaseModel):
    creditor_name: str
    account_reference: str
    current_balance: float
    current_monthly_payment: float
    apr_percent: float
    hardship_reason: str
    target_monthly_payment: float
    max_settlement_amount: float

    @field_validator(
        "current_balance",
        "current_monthly_payment",
        "apr_percent",
        "target_monthly_payment",
        "max_settlement_amount",
        mode="before",
    )
    @classmethod
    def non_negative(cls, v: float) -> float:
        if float(v) < 0:
            raise ValueError("must be non-negative")
        return v


class NegotiationOffer(BaseModel):
    creditor_name: str
    requested_payment: float
    settlement_amount: float | None  # None when no lump-sum funds available
    hardship_score: int              # 0–100: higher = stronger negotiating position
    require_no_term_extension: bool
    ask_fee_waiver: bool
    ask_apr_reduction: bool
    months_to_payoff: int | None = None
    total_interest_at_current_plan: float | None = None
    total_interest_at_new_plan: float | None = None


class CreditReportItem(BaseModel):
    bureau: str
    furnisher: str
    account_number_masked: str
    issue_type: str
    details: str
    date_identified: date
