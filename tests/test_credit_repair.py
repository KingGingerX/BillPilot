from datetime import date

from debt_bot.credit_repair import dispute_letter, escalation_letter, remediation_steps
from debt_bot.models import CreditReportItem


def _item() -> CreditReportItem:
    return CreditReportItem(
        bureau="Experian",
        furnisher="Example Lender",
        account_number_masked="****9999",
        issue_type="Incorrect late payment",
        details="Late mark was reported after account was closed.",
        date_identified=date(2026, 3, 20),
    )


def test_dispute_letter_contains_key_fields() -> None:
    letter = dispute_letter(_item(), "Jane Doe", "123 Main St, Dallas TX")

    assert "Experian" in letter
    assert "Example Lender" in letter
    assert "****9999" in letter
    assert "Jane Doe" in letter


def test_dispute_letter_contains_fcra_citations() -> None:
    letter = dispute_letter(_item(), "Jane Doe", "123 Main St, Dallas TX")

    assert "FCRA" in letter
    assert "611" in letter  # § 611 investigation deadline
    assert "30 days" in letter.lower() or "30-day" in letter.lower()


def test_dispute_letter_contains_deadline() -> None:
    letter = dispute_letter(_item(), "Jane Doe", "123 Main St, Dallas TX")
    # The letter should reference a 30-day deadline date
    assert "2026" in letter  # generated deadline year


def test_escalation_letter_contains_key_fields() -> None:
    letter = escalation_letter(
        _item(),
        "Jane Doe",
        "123 Main St, Dallas TX",
        prior_dispute_date=date(2026, 2, 1),
    )

    assert "CFPB" in letter
    assert "Experian" in letter
    assert "Example Lender" in letter
    assert "February 01, 2026" in letter


def test_remediation_steps_returns_list() -> None:
    steps = remediation_steps()
    assert len(steps) >= 5
    assert all(isinstance(s, str) for s in steps)
