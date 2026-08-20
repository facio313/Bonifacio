from __future__ import annotations

import os
import stat
import tempfile
import unittest
from pathlib import Path

from sync_edge_secrets import SECRET_PATTERN, read_or_create_secret


class EdgeSecretTests(unittest.TestCase):
    def test_creates_mode_0600_secret_and_reuses_it(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory) / "secrets"
            path = parent / "edge-secret"
            value = read_or_create_secret(path, os.getuid(), os.getgid())

            self.assertRegex(value, SECRET_PATTERN)
            self.assertEqual(stat.S_IMODE(parent.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(read_or_create_secret(path, os.getuid(), os.getgid()), value)

    def test_creates_rootless_group_readable_secret_when_requested(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory) / "secrets"
            path = parent / "edge-secret"
            value = read_or_create_secret(
                path,
                os.getuid(),
                os.getgid(),
                0o640,
            )

            self.assertRegex(value, SECRET_PATTERN)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o640)
            self.assertEqual(
                read_or_create_secret(path, os.getuid(), os.getgid(), 0o640),
                value,
            )

    def test_rejects_symlink_and_broad_permissions(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory) / "secrets"
            parent.mkdir(mode=0o700)
            real = parent / "real"
            real.write_text("A" * 64, encoding="ascii")
            real.chmod(0o600)
            link = parent / "edge-secret"
            link.symlink_to(real)
            with self.assertRaises(OSError):
                read_or_create_secret(link, os.getuid(), os.getgid())

            link.unlink()
            real.rename(link)
            link.chmod(0o640)
            with self.assertRaises(RuntimeError):
                read_or_create_secret(link, os.getuid(), os.getgid())


if __name__ == "__main__":
    unittest.main()
