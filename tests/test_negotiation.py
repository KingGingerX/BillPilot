import pytest

from debt_bot.models import DebtAccount
from debt_bot.negotiation import (
    build_counter_offer_script,
    build_opening_script,
    disclosure_line,
    propose_offer,
)


def _account(**overrides) -> DebtAccount:
    defaults = dict(
        creditor_name="CardCo",
        account_reference="*1111",
        current_balance=10000,
        current_monthly_payment=350,
        apr_percent=19.9,
        hardship_reason="medical leave",
        target_monthly_payment=200,
        max_settlement_amount=4500,
    )
    defaults.update(overrides)
    return DebtAccount(**defaults)


def test_offer_lowers_payment_and_flags_term_rule() -> None:
    offer = propose_offer(_account())

    assert offer.requested_payment == 200
    assert offer.require_no_term_extension is True
    assert offer.ask_apr_reduction is True
    assert offer.settlement_amount == 4500


def test_offer_no_settlement_when_max_is_zero() -> None:
    offer = propose_offer(_account(max_settlement_amount=0))

    assert offer.settlement_amount is None


def test_offer_hardship_score_medical() -> None:
    offer = propose_offer(_account(hardship_reason="medical leave"))
    assert offer.hardship_score >= 70  # medical keyword boosts score


def test_offer_hardship_score_generic() -> None:
    offer = propose_offer(_account(hardship_reason="temporarily short on cash"))
    # No strong keyword — score should be lower
    assert offer.hardship_score < 90


def test_total_interest_never_negative() -> None:
    # Small payment near the boundary — ceil rounding should not produce negative interest
    account = _account(current_balance=100, current_monthly_payment=50, apr_percent=0)
    offer = propose_offer(account)
    if offer.total_interest_at_current_plan is not None:
        assert offer.total_interest_at_current_plan >= 0
    if offer.total_interest_at_new_plan is not None:
        assert offer.total_interest_at_new_plan >= 0


def test_opening_script_uses_human_tone_with_disclosure() -> None:
    script = build_opening_script(_account())

    assert "thanks for taking my call" in script.lower()
    assert "i'd also appreciate" in script.lower()
    assert disclosure_line().lower() in script.lower()


def test_counter_offer_script_includes_payment() -> None:
    account = _account()
    offer = propose_offer(account)
    counter = build_counter_offer_script(account, offer)

    assert f"${offer.requested_payment:,.2f}" in counter
    assert "supervisor" in counter.lower()


def test_counter_offer_includes_settlement_when_available() -> None:
    account = _account()
    offer = propose_offer(account)
    counter = build_counter_offer_script(account, offer)

    assert f"${offer.settlement_amount:,.2f}" in counter


def test_counter_offer_omits_settlement_when_none() -> None:
    account = _account(max_settlement_amount=0)
    offer = propose_offer(account)
    counter = build_counter_offer_script(account, offer)

    assert "lump-sum" not in counter.lower()
