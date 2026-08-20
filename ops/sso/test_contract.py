from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class PortfolioSsoContractTests(unittest.TestCase):
    def test_compose_pins_private_sso_services_and_persistent_state(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        redis = compose.split("  bonifacioSsoRedis:\n", 1)[1].split(
            "\n  bonifacioSso:\n", 1
        )[0]
        authelia = compose.split("  bonifacioSso:\n", 1)[1].split("\n  bonifacio:\n", 1)[0]

        self.assertIn("127.0.0.1:${BONIFACIO_SSO_PORT:-9091}:9091", authelia)
        self.assertNotIn("ports:", redis)
        self.assertIn("bonifacio_sso_data:/data", authelia)
        self.assertIn("bonifacio_sso_redis_data:/data", redis)
        self.assertIn("cap_drop:\n      - ALL", authelia)
        self.assertIn(
            "authelia/authelia:4.39.20@sha256:"
            "68277b28658a69bb3f512c2c23c41c7df7d9311d0e506e64e26c96dcd75d0539",
            authelia,
        )
        self.assertIn(
            "redis:8.2.7-alpine@sha256:"
            "223b183cbc49f5ff48728e1fc52ccf101f05072decad2bd9867281a3c9bf75fd",
            redis,
        )

    def test_nginx_auth_request_overwrites_identity_headers(self) -> None:
        location = (ROOT / "ops/sso/nginx/authelia-location.conf").read_text(encoding="utf-8")
        auth = (ROOT / "ops/sso/nginx/authelia-authrequest.conf").read_text(encoding="utf-8")
        portal = (ROOT / "ops/sso/nginx/authelia-portal.conf").read_text(encoding="utf-8")

        self.assertIn("location = /internal/authelia/authz", location)
        self.assertIn("internal;", location)
        self.assertIn("location ^~ /sso/", portal)
        self.assertIn("auth_request /internal/authelia/authz;", auth)
        for header in ("Remote-User", "Remote-Email", "Remote-Name", "Remote-Groups"):
            self.assertIn(f"proxy_set_header {header} $bonifacio_sso_", auth)


if __name__ == "__main__":
    unittest.main()
