from __future__ import annotations

import stat
import tempfile
import unittest
from pathlib import Path

from write_user_database import write_database


DIGEST = "$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$ZGlnZXN0"


class WriteUserDatabaseTests(unittest.TestCase):
    def test_writes_exclusive_mode_0600_database(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "users.yml"
            write_database(
                output,
                username="cks",
                display_name="cks",
                email="cks@bonifacio.work",
                digest=DIGEST,
            )

            source = output.read_text(encoding="utf-8")
            self.assertIn("cks@bonifacio.work", source)
            self.assertIn(DIGEST, source)
            self.assertIn("      - owners\n      - users\n", source)
            self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o600)
            with self.assertRaises(FileExistsError):
                write_database(
                    output,
                    username="cks",
                    display_name="cks",
                    email="cks@bonifacio.work",
                    digest=DIGEST,
                )

    def test_rejects_invalid_identity_or_digest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "users.yml"
            with self.assertRaises(ValueError):
                write_database(
                    output,
                    username="Owner",
                    display_name="Owner",
                    email="owner@bonifacio.work",
                    digest="not-a-digest",
                )
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
