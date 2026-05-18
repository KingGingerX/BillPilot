from __future__ import annotations

import base64
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from cryptography.fernet import Fernet, InvalidToken
from pydantic import BaseModel


class HistoryEvent(BaseModel):
    event_id: str
    created_at_utc: str
    event_type: str
    task_type: str
    details: dict[str, Any]


class SecureTaskStore:
    def __init__(self, data_dir: str = "data") -> None:
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.history_path = self.data_dir / "history.jsonl"
        self.pii_path = self.data_dir / "pii_store.jsonl"
        self.key_path = self.data_dir / "encryption.key"
        self.key = self._get_or_create_key()

    def _get_or_create_key(self) -> bytes:
        env_key = os.getenv("DEBT_BOT_ENCRYPTION_KEY")
        if env_key:
            return self._coerce_fernet_key(env_key.encode())

        if self.key_path.exists():
            stored = self.key_path.read_bytes().strip()
            # Regenerate if the key is in the old XOR format (not a valid Fernet key)
            try:
                Fernet(stored)
                return stored
            except Exception:
                pass

        key = Fernet.generate_key()
        self.key_path.write_bytes(key)
        try:
            os.chmod(self.key_path, 0o600)
        except PermissionError:
            pass
        return key

    @staticmethod
    def _coerce_fernet_key(raw: bytes) -> bytes:
        try:
            Fernet(raw)
            return raw
        except Exception:
            digest = hashlib.sha256(raw).digest()
            return base64.urlsafe_b64encode(digest)

    @staticmethod
    def _utc_now_iso() -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    def _fernet(self) -> Fernet:
        return Fernet(self.key)

    def log_event(self, event_type: str, task_type: str, details: dict[str, Any]) -> str:
        event = HistoryEvent(
            event_id=str(uuid4()),
            created_at_utc=self._utc_now_iso(),
            event_type=event_type,
            task_type=task_type,
            details=details,
        )
        with self.history_path.open("a", encoding="utf-8") as f:
            f.write(event.model_dump_json() + "\n")
        return event.event_id

    def log_request(self, task_type: str, details: dict[str, Any]) -> str:
        return self.log_event(event_type="request_received", task_type=task_type, details=details)

    def log_task_completed(self, task_type: str, details: dict[str, Any]) -> str:
        return self.log_event(event_type="task_completed", task_type=task_type, details=details)

    def store_pii(self, task_type: str, pii_data: dict[str, Any]) -> str:
        record_id = str(uuid4())
        token = self._fernet().encrypt(json.dumps(pii_data).encode())
        record = {
            "record_id": record_id,
            "task_type": task_type,
            "created_at_utc": self._utc_now_iso(),
            "encrypted_payload": token.decode(),
        }
        with self.pii_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
        return record_id

    def retrieve_pii(self, record_id: str) -> dict[str, Any] | None:
        if not self.pii_path.exists():
            return None
        for line in self.pii_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            record = json.loads(line)
            if record["record_id"] == record_id:
                try:
                    plaintext = self._fernet().decrypt(record["encrypted_payload"].encode())
                    return json.loads(plaintext)
                except InvalidToken:
                    return None
        return None

    def delete_pii(self, record_id: str) -> bool:
        if not self.pii_path.exists():
            return False
        lines = self.pii_path.read_text(encoding="utf-8").splitlines()
        kept = [ln for ln in lines if ln.strip() and json.loads(ln).get("record_id") != record_id]
        if len(kept) == len([ln for ln in lines if ln.strip()]):
            return False
        self.pii_path.write_text("\n".join(kept) + ("\n" if kept else ""), encoding="utf-8")
        return True

    def get_recent_history(self, limit: int = 20) -> list[dict[str, Any]]:
        if not self.history_path.exists():
            return []
        lines = self.history_path.read_text(encoding="utf-8").splitlines()
        rows = [json.loads(line) for line in lines if line.strip()]
        return rows[-limit:]

    def capture_email_lead(self, email: str, source: str) -> str:
        """Encrypt and persist a marketing lead email. Returns record_id."""
        return self.store_pii(
            task_type="email_lead",
            pii_data={"email": email.strip().lower(), "source": source},
        )

    def get_email_leads(self) -> list[dict[str, Any]]:
        """Return all decrypted email leads (admin use only)."""
        if not self.pii_path.exists():
            return []
        leads = []
        for line in self.pii_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            record = json.loads(line)
            if record.get("task_type") != "email_lead":
                continue
            try:
                plaintext = self._fernet().decrypt(record["encrypted_payload"].encode())
                data = json.loads(plaintext)
                data["record_id"] = record["record_id"]
                data["created_at_utc"] = record["created_at_utc"]
                leads.append(data)
            except Exception:
                pass
        return leads
