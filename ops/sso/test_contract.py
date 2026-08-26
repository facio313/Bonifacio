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
        account_proxy = (ROOT / "ops/sso/nginx/sso-admin.conf").read_text(
            encoding="utf-8"
        )

        self.assertIn("location = /internal/authelia/authz", location)
        self.assertIn("internal;", location)
        self.assertIn("location ^~ /sso/", portal)
        self.assertIn("location = /sso/user {", account_proxy)
        self.assertIn("return 308 /sso/user/;", account_proxy)
        self.assertIn("location ^~ /sso/user/ {", account_proxy)
        self.assertIn("location = /sso/admin {", account_proxy)
        self.assertIn("return 308 /sso/admin/;", account_proxy)
        self.assertIn("location ^~ /sso/admin/ {", account_proxy)
        user_location = account_proxy.split("location ^~ /sso/user/ {", 1)[1].split(
            "\n}", 1
        )[0]
        admin_location = account_proxy.split("location ^~ /sso/admin/ {", 1)[1].split(
            "\n}", 1
        )[0]
        for protected_location in (user_location, admin_location):
            self.assertIn(
                "include /etc/nginx/snippets/bonifacio-sso-authrequest.conf;",
                protected_location,
            )
            self.assertIn(
                "include /etc/nginx/snippets/bonifacio-sso-admin-edge-secret.conf;",
                protected_location,
            )
            self.assertIn(
                "proxy_pass http://127.0.0.1:9092;", protected_location
            )
        self.assertEqual(
            account_proxy.count(
                "include /etc/nginx/snippets/bonifacio-sso-authrequest.conf;"
            ),
            2,
        )
        self.assertEqual(
            account_proxy.count(
                "include /etc/nginx/snippets/bonifacio-sso-admin-edge-secret.conf;"
            ),
            2,
        )
        self.assertEqual(
            account_proxy.count("proxy_pass http://127.0.0.1:9092;"), 2
        )
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

    def test_feelmyrythm_api_preserves_application_authentication_failures(self) -> None:
        api = (ROOT / "ops/sso/nginx/feelmyrythm-api.conf").read_text(
            encoding="utf-8"
        )

        self.assertIn("location ^~ /feelmyrythm/api/ {", api)
        self.assertIn(
            "include /etc/nginx/snippets/bonifacio-sso-authrequest.conf;", api
        )
        self.assertIn(
            "include /etc/nginx/snippets/feelmyrythm-edge-secret.conf;", api
        )
        self.assertEqual(api.count("proxy_pass "), 1)
        self.assertIn("proxy_pass http://127.0.0.1:5175;", api)
        self.assertIn("proxy_intercept_errors off;", api)
        self.assertNotIn("error_page 401", api)
        self.assertNotIn('proxy_set_header Authorization "";', api)
        for directive in (
            "proxy_set_header Host $host;",
            "proxy_set_header X-Real-IP $remote_addr;",
            "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
            "proxy_set_header X-Forwarded-Proto https;",
            "proxy_set_header X-Forwarded-Prefix /feelmyrythm;",
            "client_max_body_size 50m;",
        ):
            self.assertIn(directive, api)

    def test_account_surfaces_acl_and_password_change_are_separated(self) -> None:
        configuration = (ROOT / "ops/sso/configuration.yml").read_text(encoding="utf-8")
        server = (ROOT / "ops/sso/admin/server.mjs").read_text(encoding="utf-8")
        library = (ROOT / "ops/sso/admin/lib.mjs").read_text(encoding="utf-8")
        admin_page = (ROOT / "ops/sso/admin/public/index.html").read_text(
            encoding="utf-8"
        )
        user_page = (ROOT / "ops/sso/admin/public/user.html").read_text(
            encoding="utf-8"
        )
        user_script = (ROOT / "ops/sso/admin/public/user.js").read_text(
            encoding="utf-8"
        )
        rule_blocks = [
            "    - " + block
            for block in configuration.split("  rules:\n", 1)[1].split("\n    - ")
        ]
        self_service_block, editor_block, admin_allow_block, admin_deny_block = (
            rule_blocks[:4]
        )
        self.assertIn("'^/sso/user(?:[/?].*)?$'", self_service_block)
        self.assertIn("subject: group:user", self_service_block)
        self.assertIn("policy: one_factor", self_service_block)
        self.assertIn("'^/sso/admin/api/editor-access", editor_block)
        self.assertIn("subject: group:user", editor_block)
        self.assertIn("policy: one_factor", editor_block)
        self.assertIn("'^/sso/admin(?:[/?].*)?$'", admin_allow_block)
        self.assertIn("subject: group:admin", admin_allow_block)
        self.assertIn("policy: one_factor", admin_allow_block)
        self.assertIn("'^/sso/admin(?:[/?].*)?$'", admin_deny_block)
        self.assertNotIn("subject:", admin_deny_block)
        self.assertIn("policy: deny", admin_deny_block)
        self_service_rule = configuration.index("'^/sso/user(?:[/?].*)?$'")
        self_service_user_rule = configuration.index(
            "subject: group:user", self_service_rule
        )
        editor_rule = configuration.index("'^/sso/admin/api/editor-access")
        editor_user_rule = configuration.index("subject: group:user", editor_rule)
        admin_rule = configuration.index("subject: group:admin", editor_user_rule)
        admin_deny = configuration.index("policy: deny", admin_rule)
        chief_rule = configuration.index("subject: group:chief-admin", admin_deny)
        user_rule = configuration.index("subject: group:user", chief_rule)
        product_deny = configuration.index("resources: *protected-app-resources")

        self.assertLess(self_service_rule, self_service_user_rule)
        self.assertLess(self_service_user_rule, editor_rule)
        self.assertLess(editor_rule, admin_rule)
        self.assertLess(editor_user_rule, admin_rule)
        self.assertLess(admin_rule, admin_deny)
        self.assertLess(admin_deny, chief_rule)
        self.assertLess(chief_rule, user_rule)
        self.assertLess(user_rule, product_deny)
        self.assertNotIn("subject: group:developer", configuration)
        for group in (
            "access-react",
            "access-vue",
            "access-dukkeobi",
            "access-ddit-finalproject",
            "access-monitor",
            "access-pilgrimage",
            "access-multtara",
            "access-feelmyrythm",
            "access-garak",
        ):
            self.assertIn(f"subject: group:{group}", configuration)
        pilgrimage_rule = configuration.index("subject: group:access-pilgrimage")
        pilgrimage_block = configuration[configuration.rfind("    - domain:", 0, pilgrimage_rule):pilgrimage_rule]
        self.assertIn("'^/pilgrimage(?:[/?].*)?$'", pilgrimage_block)
        self.assertIn("'^/api(?:[/?].*)?$'", pilgrimage_block)
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
            "garak",
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
        self.assertIn('id="user-profile"', user_page)
        self.assertIn('id="password-form"', user_page)
        self.assertEqual(user_page.count('minlength="14"'), 2)
        for administrator_control in (
            'id="open-create"',
            'id="users"',
            'id="user-form"',
            'id="reset-password"',
        ):
            self.assertNotIn(administrator_control, user_page)
        self.assertNotIn("/sso/admin/api", user_script)
        self.assertIn(
            "adminLink.hidden = payload.canManageUsers !== true;", user_script
        )
        self.assertIn("error.code === 'stale_revision'", user_script)
        self.assertIn("state.revision = payload.revision;", user_script)
        self.assertNotIn('id="password-form"', admin_page)
        self.assertIn('href="/sso/user/"', admin_page)

    def test_landing_links_to_role_appropriate_self_service(self) -> None:
        profile = (ROOT / "src/components/sections/Profile.tsx").read_text(
            encoding="utf-8"
        )

        self.assertIn('href="/sso/user/"', profile)
        self.assertIn('aria-label="내 정보 열기"', profile)
        self.assertIn('defaultValue="내 정보"', profile)
        self.assertNotIn('href="/sso/admin/"', profile)

    def test_canonical_role_contract_is_shared_by_bootstrap_and_admin(self) -> None:
        contract = json.loads(
            (ROOT / "ops/sso/role-contract.json").read_text(encoding="utf-8")
        )
        self.assertEqual(contract["version"], 2)
        self.assertEqual(contract["header"], "Remote-Groups")
        self.assertEqual(contract["separator"], ",")
        self.assertEqual(contract["roles"], ["user", "admin", "chief-admin"])
        self.assertEqual(contract["administratorRole"], "admin")
        self.assertEqual(contract["globalAdministratorRole"], "chief-admin")
        self.assertEqual(contract["hierarchy"], "prefix")
        self.assertEqual(contract["markerGroup"], "portfolio-v2")
        self.assertEqual(contract["applicationGroupPrefix"], "access-")
        self.assertEqual(
            [(app["id"], app["group"]) for app in contract["applications"]],
            [
                ("react", "access-react"),
                ("vue", "access-vue"),
                ("dukkeobi", "access-dukkeobi"),
                ("ddit-finalproject", "access-ddit-finalproject"),
                ("monitor", "access-monitor"),
                ("pilgrimage", "access-pilgrimage"),
                ("multtara", "access-multtara"),
                ("feelmyrythm", "access-feelmyrythm"),
                ("garak", "access-garak"),
            ],
        )
        example = (ROOT / "ops/sso/users_database.example.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn(
            "      - user\n      - admin\n      - chief-admin\n      - portfolio-v2\n",
            example,
        )
        self.assertNotIn("      - developer\n", example)
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
