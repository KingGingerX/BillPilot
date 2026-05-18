from debt_bot.main import build_parser


def test_ui_subcommand_exists() -> None:
    parser = build_parser()
    args = parser.parse_args(["ui"])
    assert args.func.__name__ == "cmd_ui"


def test_history_subcommand_exists() -> None:
    parser = build_parser()
    args = parser.parse_args(["history"])
    assert args.func.__name__ == "cmd_history"


def test_negotiate_defaults() -> None:
    parser = build_parser()
    args = parser.parse_args(["negotiate"])
    assert args.creditor == "Sample Bank"
    assert args.balance == 8400.0
    assert args.apr == 24.99
    assert args.target_payment == 180.0


def test_negotiate_custom_args() -> None:
    parser = build_parser()
    args = parser.parse_args([
        "negotiate",
        "--creditor", "Chase",
        "--balance", "5000",
        "--payment", "200",
        "--apr", "19.99",
        "--target-payment", "120",
        "--max-settlement", "2500",
    ])
    assert args.creditor == "Chase"
    assert args.balance == 5000.0
    assert args.target_payment == 120.0
    assert args.max_settlement == 2500.0


def test_negotiate_output_flag() -> None:
    parser = build_parser()
    args = parser.parse_args(["negotiate", "--output", "plan.txt"])
    assert args.output == "plan.txt"


def test_escalate_subcommand_parses() -> None:
    parser = build_parser()
    args = parser.parse_args([
        "escalate",
        "--bureau", "Equifax",
        "--furnisher", "Debt Co",
        "--account", "****0000",
        "--issue", "Wrong balance",
        "--details", "Balance doubled after payment.",
        "--name", "John Smith",
        "--address", "456 Oak Ave",
        "--prior-dispute-date", "2026-03-01",
    ])
    assert args.func.__name__ == "cmd_escalate"
    assert args.prior_dispute_date == "2026-03-01"
    assert args.bureau == "Equifax"
