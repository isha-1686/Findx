import sqlite3
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path

from fastapi import HTTPException

from app.api import matching


class ConfirmItemMatchTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test.db"
        self._original_get_db = matching.get_db
        matching.get_db = self._connect
        with self._database() as conn:
            conn.executescript(
                """
                CREATE TABLE items (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    updated_at TEXT
                );
                INSERT INTO items VALUES ('lost-1', 'owner-1', 'lost', 'open', NULL);
                INSERT INTO items VALUES ('found-1', 'owner-2', 'found', 'open', NULL);
                """
            )

    def tearDown(self):
        matching.get_db = self._original_get_db
        self.temp_dir.cleanup()

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    @contextmanager
    def _database(self):
        conn = self._connect()
        try:
            yield conn
        finally:
            conn.commit()
            conn.close()

    def _statuses(self):
        with self._database() as conn:
            return dict(conn.execute("SELECT id, status FROM items").fetchall())

    def test_confirm_resolves_both_reports(self):
        result = matching.confirm_item_match(
            "lost-1", "found-1", user={"id": "owner-1"}
        )

        self.assertEqual(result["resolved_item_ids"], ["lost-1", "found-1"])
        self.assertEqual(self._statuses(), {"lost-1": "resolved", "found-1": "resolved"})

    def test_only_source_report_owner_can_confirm(self):
        with self.assertRaises(HTTPException) as error:
            matching.confirm_item_match(
                "lost-1", "found-1", user={"id": "someone-else"}
            )

        self.assertEqual(error.exception.status_code, 403)
        self.assertEqual(self._statuses(), {"lost-1": "open", "found-1": "open"})

    def test_same_type_reports_cannot_be_confirmed_as_a_match(self):
        with self._database() as conn:
            conn.execute("UPDATE items SET type = 'lost' WHERE id = 'found-1'")

        with self.assertRaises(HTTPException) as error:
            matching.confirm_item_match("lost-1", "found-1", user={"id": "owner-1"})

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(self._statuses(), {"lost-1": "open", "found-1": "open"})

    def test_already_resolved_reports_cannot_be_confirmed_again(self):
        with self._database() as conn:
            conn.execute("UPDATE items SET status = 'resolved' WHERE id = 'found-1'")

        with self.assertRaises(HTTPException) as error:
            matching.confirm_item_match("lost-1", "found-1", user={"id": "owner-1"})

        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self._statuses(), {"lost-1": "open", "found-1": "resolved"})


if __name__ == "__main__":
    unittest.main()
