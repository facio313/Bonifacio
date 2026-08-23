from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class PortfolioSsoContractTests(unittest.TestCase):
    def test_compose_runs_authentication_and_administration_as_one_service(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        redis = compose.split("  bonifacioSsoRedis:\n", 1)[1].split(
            "\n  bonifacioSso:\n", 1
        )[0]
        sso = compose.split("  bonifacioSso:\n", 1)[1].split(
            "\n  bonifacio:\n", 1
        )[0]
        landing = compose.split("\n  bonifacio:\n", 1)[1]

        self.assertNotIn("\n  bonifacioSsoAdmin:\n", compose)
        self.assertIn("image: ${BONIFACIO_IMAGE", sso)
        self.assertIn('command: ["node", "ops/sso/combined.mjs"]', sso)
        self.assertIn("127.0.0.1:${BONIFACIO_SSO_PORT:-9091}:9091", sso)
        self.assertIn("127.0.0.1:${BONIFACIO_SSO_ADMIN_PORT:-9092}:9092", sso)
        self.assertNotIn("ports:", redis)
        self.assertIn("bonifacio_sso_data:/data", sso)
        self.assertIn("bonifacio_sso_redis_data:/data", redis)
        self.assertIn("cap_drop:\n      - ALL", sso)
        self.assertNotIn("cap_add:", sso)
        self.assertIn("read_only: true", sso)
        self.assertIn('user: "0:0"', sso)
        self.assertIn("http://127.0.0.1:9091/sso/api/health", sso)
        self.assertIn("http://127.0.0.1:9092/healthz", sso)
        self.assertIn("target: /config/users", sso)
        self.assertIn("read_only: true", sso.split("target: /config/users", 1)[1])
        self.assertIn("USERS_DATABASE_PATH: /data/users/current/users_database.yml", sso)
        self.assertIn("SSO_AUTHELIA_BINARY: /usr/local/bin/authelia", sso)
        self.assertNotIn("\n      AUTHELIA_BINARY:", sso)
        self.assertIn("target: /data/users", sso)
        self.assertIn("ADMIN_EDGE_SECRET_FILE: /run/secrets/bonifacio_sso_admin_edge_secret", sso)
        for secret in (
            "authelia_session_secret",
            "authelia_storage_encryption_key",
            "bonifacio_sso_admin_edge_secret",
        ):
            self.assertIn(secret, sso)
        self.assertIn("fetch('http://127.0.0.1:80/')", landing)
        self.assertNotIn("wget", landing)
        self.assertIn(
            "redis:8.2.7-alpine@sha256:"
            "223b183cbc49f5ff48728e1fc52ccf101f05072decad2bd9867281a3c9bf75fd",
            redis,
        )

    def test_nginx_auth_request_overwrites_identity_headers(self) -> None:
        location = (ROOT / "ops/sso/nginx/authelia-location.conf").read_text(encoding="utf-8")
        auth = (ROOT / "ops/sso/nginx/authelia-authrequest.conf").read_text(encoding="utf-8")
        portal = (ROOT / "ops/sso/nginx/authelia-portal.conf").read_text(encoding="utf-8")
        admin = (ROOT / "ops/sso/nginx/sso-admin.conf").read_text(encoding="utf-8")

        self.assertIn("location = /internal/authelia/authz", location)
        self.assertIn("internal;", location)
        self.assertIn("location ^~ /sso/", portal)
        self.assertIn("location ^~ /sso/admin/", admin)
        self.assertIn("include /etc/nginx/snippets/bonifacio-sso-authrequest.conf;", admin)
        self.assertIn("include /etc/nginx/snippets/bonifacio-sso-admin-edge-secret.conf;", admin)
        self.assertIn("proxy_pass http://127.0.0.1:9092;", admin)
        self.assertIn("auth_request /internal/authelia/authz;", auth)
        for header in ("Remote-User", "Remote-Email", "Remote-Name", "Remote-Groups"):
            self.assertIn(f"proxy_set_header {header} $bonifacio_sso_", auth)

    def test_public_blog_proxy_strips_identity_and_rebuilds_forwarded_headers(self) -> None:
        blog = (ROOT / "ops/sso/nginx/blog-public.conf").read_text(encoding="utf-8")
        landing = (ROOT / "src/components/sections/Blog.tsx").read_text(encoding="utf-8")

        self.assertIn("location = /blog {", blog)
        self.assertIn("return 308 /blog/;", blog)
        self.assertIn("location ^~ /blog/ {", blog)
        self.assertEqual(blog.count("proxy_pass "), 1)
        self.assertIn("proxy_pass http://127.0.0.1:5176;", blog)
        self.assertNotIn("auth_request", blog)
        self.assertNotIn("$proxy_add_x_forwarded_for", blog)
        self.assertNotIn("0.0.0.0", blog)
        for header in ("Remote-User", "Remote-Email", "Remote-Name", "Remote-Groups"):
            self.assertIn(f'proxy_set_header {header} "";', blog)
        for directive in (
            "proxy_set_header Host $host;",
            "proxy_set_header X-Real-IP $remote_addr;",
            "proxy_set_header X-Forwarded-For $remote_addr;",
            "proxy_set_header X-Forwarded-Proto https;",
            "proxy_set_header X-Forwarded-Host $host;",
            "proxy_set_header X-Forwarded-Port 443;",
            'proxy_set_header Forwarded "";',
            'proxy_set_header Authorization "";',
            'proxy_set_header Cookie "";',
        ):
            self.assertIn(directive, blog)

        self.assertIn("Blog app · now open", landing)
        self.assertNotIn("opening soon", landing)

    def test_admin_acl_precedes_general_access_and_password_change_is_local(self) -> None:
        configuration = (ROOT / "ops/sso/configuration.yml").read_text(encoding="utf-8")
        server = (ROOT / "ops/sso/admin/server.mjs").read_text(encoding="utf-8")
        library = (ROOT / "ops/sso/admin/lib.mjs").read_text(encoding="utf-8")
        page = (ROOT / "ops/sso/admin/public/index.html").read_text(encoding="utf-8")
        admin_rule = configuration.index("subject: group:admin")
        admin_deny = configuration.index("policy: deny", admin_rule)
        developer_rule = configuration.index("subject: group:developer", admin_deny)
        developer_deny = configuration.index("policy: deny", developer_rule)
        user_rule = configuration.index("subject: group:user", developer_deny)
        user_deny = configuration.index("policy: deny", user_rule)

        self.assertLess(admin_rule, admin_deny)
        self.assertLess(admin_deny, developer_rule)
        self.assertLess(developer_rule, developer_deny)
        self.assertLess(developer_deny, user_rule)
        self.assertLess(user_rule, user_deny)
        self.assertIn("'^/monitor(?:[/?].*)?$'", configuration)
        self.assertIn("'^/(?:\\?.*)?$'", configuration)
        self.assertIn("'^/index\\.html(?:\\?.*)?$'", configuration)
        self.assertIn("'^/assets(?:[/?].*)?$'", configuration)
        for route in (
            "react",
            "vue",
            "dukkeobi",
            "ddit-finalproject",
            "pilgrimage",
            "api",
            "multtara",
            "feelmyrythm",
        ):
            self.assertIn(f"'^/{route}(?:[/?].*)?$'", configuration)
        self.assertIn("password_change:\n    disable: true", configuration)
        self.assertIn("disable_healthcheck: true", configuration)
        self.assertIn("password_reset:\n    disable: true", configuration)
        self.assertIn("min_length: 14", configuration)
        self.assertIn("require_special: true", configuration)
        self.assertIn("/api/account/password", server)
        self.assertIn("currentPassword", server)
        self.assertIn("verifyCredential(currentPassword, current.password)", server)
        self.assertIn("current.password = await dependencies.hashCredential(newPassword)", server)
        self.assertIn("'change_own_password'", server)
        self.assertIn("['-q', '-e', '-E', 'never', '-c', command, '/dev/null']", library)
        self.assertIn("child.stdin.end(`${password}\\n`)", library)
        self.assertNotIn("'--password'", library)
        self.assertIn('id="password-form"', page)

    def test_canonical_role_contract_is_shared_by_bootstrap_and_admin(self) -> None:
        contract = json.loads(
            (ROOT / "ops/sso/role-contract.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            contract,
            {
                "version": 1,
                "header": "Remote-Groups",
                "separator": ",",
                "roles": ["user", "developer", "admin"],
                "administratorRole": "admin",
                "hierarchy": "prefix",
            },
        )
        example = (ROOT / "ops/sso/users_database.example.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("      - user\n      - developer\n      - admin\n", example)
        self.assertNotIn("      - owners\n", example)
        self.assertNotIn("      - users\n", example)

    def test_runtime_image_is_pinned_and_contains_admin_runtime(self) -> None:
        dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
        self.assertEqual(dockerfile.count("node:22-bookworm-slim@sha256:"), 2)
        self.assertIn(
            "authelia/authelia:4.39.20@sha256:"
            "68277b28658a69bb3f512c2c23c41c7df7d9311d0e506e64e26c96dcd75d0539",
            dockerfile,
        )
        self.assertIn("COPY --from=authelia /app/authelia /usr/local/bin/authelia", dockerfile)
        self.assertIn("COPY ops/sso/combined.mjs ./ops/sso/combined.mjs", dockerfile)
        self.assertIn(
            "COPY ops/sso/role-contract.json ./ops/sso/role-contract.json",
            dockerfile,
        )
        self.assertIn("RUN test -x /usr/bin/script", dockerfile)
        self.assertIn("EXPOSE 80 9091 9092", dockerfile)
        self.assertIn('CMD ["node", "ops/sso/admin/landing.mjs"]', dockerfile)


if __name__ == "__main__":
    unittest.main()
