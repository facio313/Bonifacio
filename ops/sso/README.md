# Bonifacio SSO operations

Authelia 4.39.20 provides one shared login at `https://bonifacio.work/sso/`. Authentication and the Node account-administration API run as two supervised processes in one SSO container and one deployment unit. The production image copies Authelia from a pinned Linux ARM64 manifest digest. A dedicated Redis remains separate so sessions survive SSO container replacements, and the persistent SQLite volume retains Authelia state.

## Operator-only files

Keep these paths outside Git with directory mode `0700` and file mode `0600`:

- `userdb/current/users_database.yml`: the complete user directory and Argon2id password digests
- `userdb/backups/`: automatic pre-change copies retained by the administrator process
- `userdb/audit.jsonl`: password-free account management events
- `bootstrap-credentials.txt`: the initial administrator credential handoff; delete it after choosing a private password
- `session-secret`: session encryption material
- `storage-encryption-key`: Authelia storage encryption material

The production host keeps the rootless Docker-readable configuration, user database, and secrets under `/home/cks/.config/portfolio-sso/`. Generate independent random secret files with `authelia crypto rand --length 64 --file ...`; never print them. Generate the first administrator password digest with `authelia crypto hash generate argon2`, then pipe only that digest to `write_user_database.py` and place the resulting file in `userdb/current/`. The bootstrap writer refuses replacement, validates the digest shape, loads `role-contract.json`, and creates a mode-`0600` database without printing it.

Run `sudo python3 ops/sso/sync_edge_secrets.py admin monitor pilgrimage feelmyrythm multtara` once before enabling the dynamic routes. It creates or reuses separate application secrets and atomically writes matching root-only Nginx header snippets without printing their values. The unified SSO container's admin boundary and Monitor use mode `0600`; the three non-root application containers use host-owner/private-group mode `0640`, which rootless Docker presents as `root:root 0640` while the application keeps its non-root UID and effective GID 0. It intentionally has no implicit rotation mode: rotating only one side would lock out a live application, so future rotation must be an explicit two-sided rollout.

## Account administration

`role-contract.json` is the machine-readable authority for the three hierarchy-closed roles `user < developer < admin`. Valid user database lists are exactly `[user]`, `[user, developer]`, or `[user, developer, admin]`; legacy `users`/`owners`, unknown roles, duplicates, and hierarchy gaps are rejected. Authelia returns the list as comma-separated `Remote-Groups`, and consumers accept only the exact strings `user`, `user,developer`, or `user,developer,admin`: whitespace, reordering, empty segments, duplicates, and unknown roles are rejected. Nginx overwrites any caller-provided value, and the administrator requires the forwarded roles to match the locked central database record exactly.

Use `https://bonifacio.work/sso/admin/` after signing in as an enabled `admin`. The signed-in administrator can choose a new password after re-entering the current password; the administrator passes both values only through a non-echoing pseudo-terminal to Authelia's Argon2 verifier/hasher, then commits the new digest through the same locked writer and logs out the current SSO browser session. Other already-issued Authelia sessions remain valid until they expire or are separately logged out. New users receive a 24-character temporary password which is returned once and never written to the audit log or user listing. Send it through a private channel. Administrators also edit central roles and issue later password resets from this screen. Email-based password recovery, anonymous registration, and Authelia's independent file-rewriting password-change flow remain disabled.

The private administrator password form accepts 4–128 characters and rejects terminal control characters. The short lower bound exists only so an operator-provided bootstrap credential can be replaced through this form; administrators should immediately choose a long unique password. Authelia's stricter policy remains configured for any future native recovery flow.

Central usernames and email addresses are immutable through the administrator UI. Downstream applications establish a one-time link to the immutable username (`Remote-User`) and controlled first-link email, so prefer disabling a mistaken account and issuing a corrected one. If an established identity must be corrected by explicit operator request, treat it as a coordinated migration: back up every affected store, stop linked writers, update only exact stable user IDs after collision checks, commit the central record through `UserStore`, invalidate cached SSO sessions, and prove that every linked application reused its existing account. The UI prevents the active administrator from removing their own rights and prevents disabling the last enabled admin.

The unified container mounts `userdb/current/` read-only at Authelia's configured path and the parent `userdb/` read-write at the administrator's path. Only the administrator code writes; Authelia watches the read-only alias and applies atomic replacements without a restart. Because both paths exist in one mount namespace, this is no longer a security boundary between containers: it is an explicit code and path discipline accepted by the unified design. The container runs as root only inside the rootless user namespace with every capability dropped, uses a read-only root filesystem, and has a health probe that requires both Authelia and the administrator endpoint. Every administrator mutation requires the latest list revision, rechecks the acting administrator inside the write lock, serializes expensive password hashing, is spaced beyond Authelia's watcher cooldown, backed up, fsynced, atomically renamed, and recorded as password-free prepared/committed audit events. A post-rename housekeeping failure is logged but never turns an already-applied one-time password change into a misleading failed response.

### One-shot legacy role migration

The strict administrator intentionally cannot parse legacy `owners`/`users` records. Before deploying this contract, run the dedicated migration against the operator-owned database. It requires a mode-`0600` regular file, the exact expected SHA-256, exactly one enabled `cks` record with email `cks@bonifacio.work`, and the exact old group list `[owners, users]`. It preserves the existing password digest and every non-role field as opaque values. Dry-run is the default and performs no lock, backup, audit, or database write:

```sh
portfolio_userdb=/home/cks/.config/portfolio-sso/userdb/current/users_database.yml
portfolio_userdb_sha=f7756c6456f20227ab89c8a138c79a1b1430cc9fbae0d617c2355d58b043f165
node ops/sso/admin/migrate-role-contract.mjs \
  --database "$portfolio_userdb" \
  --expected-sha256 "$portfolio_userdb_sha"
```

Do not replace the audited expected SHA with an on-the-fly value: any mismatch means stop and investigate without exposing the database or its digest. The expected dry-run target revision for this one-shot record is `2e32c3e7c48b93060ecdfbca9f17fbd3a560b08ecc305020e6ffceed474d8985`. Only after reviewing both revisions, repeat the identical command with `--apply`. Apply rechecks the revision under the shared administrator lock, creates and fsyncs a mode-`0600` backup, fsyncs a same-directory temporary file, appends password-free prepared/committed audit events, and atomically renames the candidate. Coordinate the database change with installation of the matching `configuration.yml` and administrator image under the deployment lock, then invalidate the old Authelia session and sign in again so `Remote-Groups` is refreshed.

## Nginx boundary

Install `nginx/authelia-location.conf`, `nginx/authelia-portal.conf`, and `nginx/sso-admin.conf` once in the `bonifacio.work` server block. Generate `bonifacio-sso-admin-edge-secret.conf` from its example with the same random value mounted into the unified SSO container. Include `nginx/authelia-authrequest.conf` in every protected product location. The include overwrites caller-provided `Remote-*` headers with values returned by Authelia. The ordered Authelia ACL requires `admin` for `/sso/admin/`, `developer` for `/monitor/`, and `user` for every other protected product plus the landing page's `/index.html` and `/assets/` requests, with a deny rule immediately after each grant tier. The administrator path additionally requires the private edge secret and exact header-to-database role revalidation.

Blog is the intentional public read-only exception. Install `nginx/blog-public.conf` as `/etc/nginx/snippets/bonifacio-blog-public.conf`, then include that installed snippet once in the TLS `bonifacio.work` server block. It redirects `/blog` to `/blog/` and proxies only to the loopback Blog web origin on port `5176`. It does not run `auth_request`; it removes caller identity, authorization, cookie, and edge-secret headers and reconstructs forwarded headers from trusted Nginx values. The source-controlled installation sequence is:

```sh
install -o root -g root -m 0644 \
  ops/sso/nginx/blog-public.conf \
  /etc/nginx/snippets/bonifacio-blog-public.conf
```

Add this line beside the other `bonifacio-*.conf` includes without copying the snippet body into the site file:

```nginx
include /etc/nginx/snippets/bonifacio-blog-public.conf;
```

Before a controlled Nginx reload, require `curl --fail --silent --show-error http://127.0.0.1:5176/healthz` and `nginx -t` to pass. The Blog origin must remain loopback-bound; do not add a public origin port or an application-local account system.

Do not protect the general `/sso/` portal with its own auth request. The more-specific `/sso/admin/` location is protected. Keep `/internal/authelia/authz` internal. Product health checks used by the restricted local deployer should use loopback origins. The explicitly documented Pilgrimage and FeelMyRythm public health routes are narrow exceptions and must strip identity headers.

## Safe rollout

1. Validate the configuration and supervisor tests against the exact pinned build inputs.
2. Start `bonifacioSsoRedis`, then start the unified `bonifacioSso` container with both loopback ports.
3. Verify the portal/auth endpoint on port 9091 and administrator health on port 9092.
4. Add the auth include to one product at a time and verify redirect, login, trusted headers, and logout.
5. Enable the corresponding app-native SSO exchange before removing its old login UI.
6. Verify `/sso/admin/` and a one-time test account create/login/reset/disable cycle, including Authelia's live file watcher.
7. Preserve Redis, both named volumes, and every unrelated container ID during each rollout.

The first split-to-unified conversion is a structural migration: preserve the former Compose layout and both prior images for rollback, remove the old administrator container that owns port 9092, and then replace the former Authelia-only container with the unified image under the fleet deployment lock. After that migration, the restricted deployer replaces the unified SSO and landing containers together, verifies both SSO endpoints, and requires the Redis container ID to remain unchanged.

Never run stack-wide `down -v` or remove either `bonifacio-sso-*` volume.
