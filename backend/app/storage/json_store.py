import json
import os
import threading
import uuid
from typing import Any, Callable

from app.core.time_utils import now_iso


class JsonStore:
    """Thread-safe, atomic-write JSON collection store.

    File layout: {"items": [...], "version": 1}
    """

    _locks: dict[str, threading.RLock] = {}
    _locks_guard = threading.Lock()

    def __init__(self, data_dir: str, name: str):
        self.path = os.path.join(data_dir, f"{name}.json")
        os.makedirs(data_dir, exist_ok=True)
        with JsonStore._locks_guard:
            if self.path not in JsonStore._locks:
                JsonStore._locks[self.path] = threading.RLock()
            self._lock = JsonStore._locks[self.path]
        if not os.path.exists(self.path):
            self._write({"items": [], "version": 1})

    def _read(self) -> dict:
        with self._lock:
            if not os.path.exists(self.path):
                return {"items": [], "version": 1}
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)

    def _write(self, data: dict) -> None:
        with self._lock:
            tmp_path = f"{self.path}.tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False, default=str)
            os.replace(tmp_path, self.path)

    def all(self) -> list[dict]:
        with self._lock:
            return list(self._read()["items"])

    def get(self, id: str) -> dict | None:
        with self._lock:
            for item in self._read()["items"]:
                if item.get("id") == id:
                    return item
            return None

    def find(self, **filters) -> list[dict]:
        with self._lock:
            items = self._read()["items"]
            result = []
            for item in items:
                if all(item.get(k) == v for k, v in filters.items()):
                    result.append(item)
            return result

    def find_one(self, **filters) -> dict | None:
        results = self.find(**filters)
        return results[0] if results else None

    def insert(self, obj: dict) -> dict:
        with self._lock:
            data = self._read()
            obj = dict(obj)
            obj.setdefault("id", str(uuid.uuid4()))
            obj.setdefault("created_at", now_iso())
            obj["updated_at"] = now_iso()
            data["items"].append(obj)
            self._write(data)
            return obj

    def update(self, id: str, patch: dict) -> dict | None:
        with self._lock:
            data = self._read()
            for i, item in enumerate(data["items"]):
                if item.get("id") == id:
                    item.update(patch)
                    item["updated_at"] = now_iso()
                    data["items"][i] = item
                    self._write(data)
                    return item
            return None

    def delete(self, id: str) -> bool:
        with self._lock:
            data = self._read()
            new_items = [i for i in data["items"] if i.get("id") != id]
            if len(new_items) == len(data["items"]):
                return False
            data["items"] = new_items
            self._write(data)
            return True

    def replace_all(self, items: list[dict]) -> None:
        with self._lock:
            self._write({"items": items, "version": 1})

    def upsert_by(self, match: Callable[[dict], bool], obj: dict) -> dict:
        with self._lock:
            data = self._read()
            for i, item in enumerate(data["items"]):
                if match(item):
                    item.update(obj)
                    item["updated_at"] = now_iso()
                    data["items"][i] = item
                    self._write(data)
                    return item
            obj = dict(obj)
            obj.setdefault("id", str(uuid.uuid4()))
            obj.setdefault("created_at", now_iso())
            obj["updated_at"] = now_iso()
            data["items"].append(obj)
            self._write(data)
            return obj
