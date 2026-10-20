from __future__ import annotations

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent
NGINX = shutil.which("nginx")


class BlogNginxTests(unittest.TestCase):
    @unittest.skipUnless(NGINX, "nginx is not installed; run nginx -t before rollout")
    def test_public_and_author_locations_parse_with_an_isolated_secret_fixture(self) -> None:
        with tempfile.TemporaryDirectory(prefix="blog-nginx-") as directory:
            prefix = Path(directory)
            (prefix / "logs").mkdir()
            (prefix / "blog-edge-secret.conf").write_text(
                'proxy_set_header X-Portfolio-Edge-Secret "test-fixture-only";\n',
                encoding="utf-8",
            )
            source = (ROOT / "nginx/blog-public.conf").read_text(encoding="utf-8")
            rendered = source.replace(
                "/etc/nginx/snippets/blog-edge-secret.conf",
                "blog-edge-secret.conf",
            )
            (prefix / "blog-public.test.rendered.conf").write_text(
                rendered, encoding="utf-8"
            )
            configuration = (ROOT / "nginx/blog-public.test.conf").read_text(
                encoding="utf-8"
            )
            (prefix / "nginx.conf").write_text(configuration, encoding="utf-8")
            result = subprocess.run(
                [str(NGINX), "-t", "-p", f"{prefix}/", "-c", "nginx.conf"],
                check=False,
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
