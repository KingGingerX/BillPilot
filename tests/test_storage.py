import json
from pathlib import Path

from debt_bot.storage import SecureTaskStore


def test_history_records_include_timestamp(tmp_path: Path) -> None:
    store = SecureTaskStore(data_dir=str(tmp_path))

    store.log_request(task_type="negotiate", details={"creditor_name": "A"})
    store.log_task_completed(task_type="negotiate", details={"status": "done"})

    rows = store.get_recent_history(limit=10)
    assert len(rows) == 2
    assert rows[0]["created_at_utc"]
    assert rows[1]["created_at_utc"]
    assert rows[0]["event_type"] == "request_received"
    assert rows[1]["event_type"] == "task_completed"


def test_pii_is_encrypted_at_rest(tmp_path: Path) -> None:
    store = SecureTaskStore(data_dir=str(tmp_path))

    store.store_pii(task_type="dispute", pii_data={"consumer_name": "Jane Doe", "address": "123 Main"})

    raw = (tmp_path / "pii_store.jsonl").read_text(encoding="utf-8")
    record = json.loads(raw.strip())

    assert "Jane Doe" not in raw
    assert "123 Main" not in raw
    assert record["encrypted_payload"]


def test_pii_round_trip(tmp_path: Path) -> None:
    store = SecureTaskStore(data_dir=str(tmp_path))

    pii = {"consumer_name": "John Smith", "address": "456 Elm Ave"}
    record_id = store.store_pii(task_type="dispute", pii_data=pii)

    retrieved = store.retrieve_pii(record_id)
    assert retrieved == pii


def test_retrieve_pii_missing_record_returns_none(tmp_path: Path) -> None:
    store = SecureTaskStore(data_dir=str(tmp_path))
    assert store.retrieve_pii("nonexistent-id") is None


def test_delete_pii(tmp_path: Path) -> None:
    store = SecureTaskStore(data_dir=str(tmp_path))

    record_id = store.store_pii(task_type="dispute", pii_data={"consumer_name": "Jane Doe"})
    assert store.retrieve_pii(record_id) is not None

    deleted = store.delete_pii(record_id)
    assert deleted is True
    assert store.retrieve_pii(record_id) is None
