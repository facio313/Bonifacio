# Bonifacio SSO operations

Authelia 4.39.20 provides one shared login at `https://bonifacio.work/sso/`. The production image is pinned to the Linux ARM64 manifest digest. A dedicated Redis keeps sessions across portal restarts and SQLite retains Authelia state.

## Operator-only files

Keep these paths outside Git with directory mode `0700` and file mode `0600`:

- `userdb/current/users_database.yml`: the complete user directory and Argon2id password digests
- `userdb/backups/`: automatic pre-change copies retained by the administrator service
- `userdb/audit.jsonl`: password-free account management events
- `bootstrap-credentials.txt`: the initial administrator credential handoff; delete it after choosing a private password
- `session-secret`: session encryption material
- `storage-encryption-key`: Authelia storage encryption material

The production host keeps the rootless Docker-readable configuration, user database, and secrets under `/home/cks/.config/portfolio-sso/`. Generate independent random secret files with `authelia crypto rand --length 64 --file ...`; never print them. Generate the first owner password digest with `authelia crypto hash generate argon2`, then pipe only that digest to `write_user_database.py` and place the resulting file in `userdb/current/`. The bootstrap writer refuses replacement, validates the digest shape, and creates a mode-`0600` database without printing it.

Run `sudo python3 ops/sso/sync_edge_secrets.py admin monitor pilgrimage feelmyrythm multtara` once before enabling the dynamic routes. It creates or reuses separate application secrets and atomically writes matching root-only Nginx header snippets without printing their values. Admin and Monitor use mode `0600`; the three non-root application containers use host-owner/private-group mode `0640`, which rootless Docker presents as `root:root 0640` while the application keeps its non-root UID and effective GID 0. It intentionally has no implicit rotation mode: rotating only one side would lock out a live application, so future rotation must be an explicit two-sided rollout.

## Account administration

Use `https://bonifacio.work/sso/admin/` after signing in as an enabled member of `owners`. The signed-in owner can choose a new password after re-entering the current password; the administrator passes both values only through a non-echoing pseudo-terminal to Authelia's Argon2 verifier/hasher, then commits the new digest through the same locked writer and logs out the current SSO browser session. Other already-issued Authelia sessions remain valid until they expire or are separately logged out. New users receive a 24-character temporary password which is returned once and never written to the audit log or user listing. Send it through a private channel. Owners also issue later password resets from this screen. Email-based password recovery, anonymous registration, and Authelia's independent file-rewriting password-change flow remain disabled.

The private owner-change form accepts 4–128 characters and rejects terminal control characters. The short lower bound exists only so an operator-provided bootstrap credential can be replaced through this form; owners should immediately choose a long unique password. Authelia's stricter policy remains configured for any future native recovery flow.

Central usernames and email addresses are immutable through the administrator UI. Downstream applications establish a one-time link to the immutable username (`Remote-User`) and controlled first-link email, so prefer disabling a mistaken account and issuing a corrected one. If an established identity must be corrected by explicit operator request, treat it as a coordinated migration: back up every affected store, stop linked writers, update only exact stable user IDs after collision checks, commit the central record through `UserStore`, invalidate cached SSO sessions, and prove that every linked application reused its existing account. The UI prevents the active administrator from removing their own rights and prevents disabling the last enabled owner.

The administrator service holds write access only to `userdb/`. Authelia mounts `userdb/current/` read-only and watches it, leaving exactly one writer. The Authelia service bypasses the image's recursive-chown entrypoint, runs as root only inside the rootless user namespace with every capability dropped, disables the image's writable healthcheck state, and uses an explicit HTTP health probe; this preserves a read-only root filesystem and read-only directory bind. File watching applies changes without a restart. Every administrator mutation requires the latest list revision, rechecks the acting owner inside the write lock, serializes expensive password hashing, is spaced beyond Authelia's watcher cooldown, backed up, fsynced, atomically renamed, and recorded as password-free prepared/committed audit events. A post-rename housekeeping failure is logged but never turns an already-applied one-time password change into a misleading failed response.

## Nginx boundary

Install `nginx/authelia-location.conf`, `nginx/authelia-portal.conf`, and `nginx/sso-admin.conf` once in the `bonifacio.work` server block. Generate `bonifacio-sso-admin-edge-secret.conf` from its example with the same random value mounted into the admin container. Include `nginx/authelia-authrequest.conf` in every protected product location. The include overwrites caller-provided `Remote-*` headers with values returned by Authelia. The administrator path is protected three ways: Authelia's ordered resource ACL admits `owners`, Nginx overwrites the private edge secret, and the admin service checks both.

Do not protect the general `/sso/` portal with its own auth request. The more-specific `/sso/admin/` location is protected. Keep `/internal/authelia/authz` internal. Product health checks used by the restricted local deployer should use loopback origins. The explicitly documented Pilgrimage and FeelMyRythm public health routes are narrow exceptions and must strip identity headers.

## Safe rollout

1. Validate the configuration with the exact pinned image.
2. Start `bonifacioSsoRedis` and `bonifacioSso` without changing product routes.
3. Verify the portal and auth endpoint through loopback.
4. Add the auth include to one product at a time and verify redirect, login, trusted headers, and logout.
5. Enable the corresponding app-native SSO exchange before removing its old login UI.
6. Verify `/sso/admin/` and a one-time test account create/login/reset/disable cycle.
7. Preserve the SSO containers, volumes, and every unrelated container ID during each rollout.

The restricted Bonifacio deployer records the SSO and Redis container IDs before replacing the landing page and administrator service and requires the same healthy IDs afterward. Application deploys must not recreate either authentication service.

Never run stack-wide `down -v` or remove either `bonifacio-sso-*` volume.
