import os
from pathlib import Path

import pytest

from debt_bot.storage import SecureTaskStore
from debt_bot.tier import FREE_MONTHLY_LIMIT, Tier, check_usage, get_tier


def test_get_tier_defaults_to_free(monkeypatch) -> None:
    monkeypatch.delenv("BILLPILOT_TIER", raising=False)
    assert get_tier() == Tier.FREE


def test_get_tier_pro_from_env(monkeypatch) -> None:
    monkeypatch.setenv("BILLPILOT_TIER", "pro")
    assert get_tier() == Tier.PRO


def test_check_usage_free_tier_allows_within_limit(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("BILLPILOT_TIER", raising=False)
    store = SecureTaskStore(data_dir=str(tmp_path))
    allowed, remaining = check_usage("negotiate", store)
    assert allowed is True
    assert remaining == FREE_MONTHLY_LIMIT


def test_check_usage_free_tier_counts_requests(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("BILLPILOT_TIER", raising=False)
    store = SecureTaskStore(data_dir=str(tmp_path))

    for _ in range(FREE_MONTHLY_LIMIT):
        store.log_request(task_type="negotiate", details={})

    allowed, remaining = check_usage("negotiate", store)
    assert allowed is False
    assert remaining == 0


def test_check_usage_pro_always_allowed(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("BILLPILOT_TIER", "pro")
    store = SecureTaskStore(data_dir=str(tmp_path))

    for _ in range(FREE_MONTHLY_LIMIT + 10):
        store.log_request(task_type="negotiate", details={})

    allowed, remaining = check_usage("negotiate", store)
    assert allowed is True
    assert remaining == 9999


def test_check_usage_dispute_and_negotiate_counted_separately(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("BILLPILOT_TIER", raising=False)
    store = SecureTaskStore(data_dir=str(tmp_path))

    for _ in range(FREE_MONTHLY_LIMIT):
        store.log_request(task_type="negotiate", details={})

    # Dispute quota should still be full
    allowed, remaining = check_usage("dispute", store)
    assert allowed is True
    assert remaining == FREE_MONTHLY_LIMIT
