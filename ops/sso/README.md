# Bonifacio SSO operations

Authelia 4.39.20 provides one shared login at `https://bonifacio.work/sso/`. The production image is pinned to the Linux ARM64 manifest digest. A dedicated Redis keeps sessions across portal restarts and SQLite retains Authelia state.

## Operator-only files

Keep these paths outside Git with directory mode `0700` and file mode `0600`:

- `users_database.yml`: the owner profile and an Argon2id password digest
- `session-secret`: session encryption material
- `storage-encryption-key`: Authelia storage encryption material

The production host keeps the rootless Docker-readable configuration, user database, and secrets under `/home/cks/.config/portfolio-sso/`. Generate independent random secret files with `authelia crypto rand --length 64 --file ...`; never print them. Generate the user password digest with `authelia crypto hash generate argon2`, then pipe only that digest to `write_user_database.py`. The writer refuses replacement, validates the digest shape, and creates a mode-`0600` database without printing it.

## Nginx boundary

Install `nginx/authelia-location.conf` and `nginx/authelia-portal.conf` once in the `bonifacio.work` server block. Include `nginx/authelia-authrequest.conf` in every protected product location. The include overwrites caller-provided `Remote-*` headers with values returned by Authelia.

Do not protect `/sso/` with its own auth request. Keep `/internal/authelia/authz` internal. Product health checks used by the restricted local deployer must use loopback-only locations or direct origin ports rather than bypassing authentication on public endpoints.

## Safe rollout

1. Validate the configuration with the exact pinned image.
2. Start `bonifacioSsoRedis` and `bonifacioSso` without changing product routes.
3. Verify the portal and auth endpoint through loopback.
4. Add the auth include to one product at a time and verify redirect, login, trusted headers, and logout.
5. Enable the corresponding app-native SSO exchange before removing its old login UI.
6. Preserve the SSO containers, volumes, and every unrelated container ID during each rollout.

The restricted Bonifacio deployer records the SSO and Redis container IDs before replacing the landing page and requires the same healthy IDs afterward. Application deploys must not recreate either authentication service.

Never run stack-wide `down -v` or remove either `bonifacio-sso-*` volume.
