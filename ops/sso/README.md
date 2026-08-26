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

## Self-service and account administration

`role-contract.json` is the machine-readable authority for the hierarchy-closed roles `user < admin < chief-admin` and the ordered application catalog. Every v2 group list is the role prefix, the mandatory `portfolio-v2` marker, then selected `access-*` grants in catalog order. For example, a user with only FeelMyRythm is `user,portfolio-v2,access-feelmyrythm`; an app-limited administrator with Monitor is `user,admin,portfolio-v2,access-monitor`; and a chief is exactly `user,admin,chief-admin,portfolio-v2`. A chief receives every product implicitly. Missing markers, whitespace, reordering, empty segments, duplicates, hierarchy gaps, and unknown grants are rejected. Nginx overwrites caller-provided values, and the administrator requires the forwarded groups to match the locked central database record exactly.

Every enabled account uses `https://bonifacio.work/sso/user/` for self-service. The page is intentionally task-focused: it shows only the signed-in account's own sanitized identity and lets that account choose a new password after re-entering the current password. It has no subscriber list, account-issuance form, role or application-grant controls, activation controls, or access to another account. The account service revalidates the forwarded identity and exact groups against the locked central record before reading or writing, passes both password values only through a non-echoing pseudo-terminal to Authelia's Argon2 verifier/hasher, commits the new digest through the serialized writer, and logs out the current SSO browser session. Other already-issued Authelia sessions remain valid until they expire or are separately logged out.

Use the separate `https://bonifacio.work/sso/admin/` console after signing in as an enabled `admin` or `chief-admin`. It presents the subscriber overview and management tasks together, but has no current-user password panel; administrators use `/sso/user/` for their own identity and password just like ordinary users. New users receive a 24-character temporary password which is returned once and never written to the audit log or user listing. Send it through a private channel. Administrators assign roles and application grants on the same screen. An `admin` can manage only ordinary `user` accounts; only a `chief-admin` can create, edit, disable, or reset another privileged account. Email-based password recovery, anonymous registration, and Authelia's independent file-rewriting password-change flow remain disabled.

The private self-service password form accepts 14–128 characters and requires at least one uppercase letter, lowercase letter, number, and special character, matching the configured Authelia standard policy. Existing operator-provided bootstrap credentials may still be entered as the current password so they can be replaced. Every account should choose a long unique password. Per account, at most five actual current-password checks are accepted in a rolling 10-minute window, and at most three successful self-service changes are accepted in a rolling 24-hour window; malformed, CSRF-rejected, or stale-revision requests do not consume those quotas.

Central usernames and email addresses are immutable through the administrator UI. Downstream applications establish a one-time link to the immutable username (`Remote-User`) and controlled first-link email, so prefer disabling a mistaken account and issuing a corrected one. If an established identity must be corrected by explicit operator request, treat it as a coordinated migration: back up every affected store, stop linked writers, update only exact stable user IDs after collision checks, commit the central record through `UserStore`, invalidate cached SSO sessions, and prove that every linked application reused its existing account. The UI prevents an administrator from changing their own role, app grants, or active state and prevents disabling or demoting the last enabled chief.

The unified container mounts `userdb/current/` read-only at Authelia's configured path and the parent `userdb/` read-write at the administrator's path. Only the administrator code writes; Authelia watches the read-only alias and applies atomic replacements without a restart. Because both paths exist in one mount namespace, this is no longer a security boundary between containers: it is an explicit code and path discipline accepted by the unified design. The container runs as root only inside the rootless user namespace with every capability dropped, uses a read-only root filesystem, and has a health probe that requires both Authelia and the administrator endpoint. Every administrator mutation requires the latest list revision, rechecks the acting administrator inside the write lock, serializes expensive password hashing, is spaced beyond Authelia's watcher cooldown, backed up, fsynced, atomically renamed, and recorded as password-free prepared/committed audit events. A post-rename housekeeping failure is logged but never turns an already-applied one-time password change into a misleading failed response.

### One-shot v1-to-v2 role and access migration

The v2 runtime has narrow expand compatibility for only the three exact v1 lists `[user]`, `[user, developer]`, and `[user, developer, admin]`. It maps them in memory to the old route reachability and never exposes `developer` as a v2 role; any mutation serializes canonical v2. The dedicated one-shot migration is stricter: it requires a mode-`0600` regular file, the exact expected SHA-256, an enabled `cks` record with email `cks@bonifacio.work` and the exact old administrator list, and only exact legacy assignments for every additional identity. It promotes `cks` to `chief-admin`; maps another former admin to `admin` with every explicit app grant; maps a former developer to `user` with every app grant; and maps a former user to `user` with the old baseline apps (all catalog apps except Monitor). It preserves the complete identity set, password digests, disabled flags, and every other non-group field as opaque values. Dry-run is write-free:

```sh
portfolio_userdb=/home/cks/.config/portfolio-sso/userdb/current/users_database.yml
portfolio_userdb_sha=<audited-current-sha256>
node ops/sso/admin/migrate-role-contract.mjs \
  --database "$portfolio_userdb" \
  --expected-sha256 "$portfolio_userdb_sha"
```

Do not replace the independently audited expected SHA with an on-the-fly value: any mismatch means stop and investigate without printing the database or its digest. Review the dry-run source and target revisions, then repeat the identical command with `--apply`. Apply rechecks the revision under the shared lock, creates and fsyncs a mode-`0600` backup, fsyncs a same-directory temporary file, appends password-free prepared/committed audit events, and atomically renames the candidate. Deploy the expand-compatible image first. Under the deployment lock, install the matching ACL, apply the migration, invalidate old Authelia sessions, and verify each app before removing legacy consumer parsing in a later change.

## Nginx boundary

Install `nginx/authelia-location.conf`, `nginx/authelia-portal.conf`, and `nginx/sso-admin.conf` once in the `bonifacio.work` server block. Generate `bonifacio-sso-admin-edge-secret.conf` from its example with the same random value mounted into the unified SSO container. Include `nginx/authelia-authrequest.conf` in every protected product location. The include overwrites caller-provided `Remote-*` headers with values returned by Authelia. The landing page remains the baseline authenticated `user` portal. A `chief-admin` passes every product rule; all other accounts require the route's exact `access-*` group, with protected `/api/` requests sharing `access-pilgrimage`. `/sso/user/` accepts the hierarchy's baseline `user` group and proxies through both `auth_request` and the private edge secret to the account service; the origin then exposes only the matching account's self-service view. `/sso/admin/` independently requires `admin` and the origin revalidates that role before exposing management. Its exact read-only `/sso/admin/api/editor-access` endpoint has an earlier baseline-user edge rule so the landing can check capability without a new Nginx location; the origin still requires the private edge secret and exact admin-to-database revalidation before returning the verified username used to namespace local drafts. Keep Pilgrimage's narrow `/pilgrimage/shared/:token`, `/api/shared/:token/`, `/api/health/`, and required static-asset locations in their existing public Nginx locations without this auth include; those locations must clear identity, authorization, cookie, and edge-secret headers before proxying.

Blog is the broader intentional public read-only application. Install `nginx/blog-public.conf` as `/etc/nginx/snippets/bonifacio-blog-public.conf`, then include that installed snippet once in the TLS `bonifacio.work` server block. It redirects `/blog` to `/blog/` and proxies only to the loopback Blog web origin on port `5176`. It does not run `auth_request`; it removes caller identity, authorization, cookie, and edge-secret headers and reconstructs forwarded headers from trusted Nginx values. The source-controlled installation sequence is:

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

FeelMyRythm has both the central edge session and its own short-lived bearer session. Install `nginx/feelmyrythm-api.conf` as `/etc/nginx/snippets/bonifacio-feelmyrythm-api.conf`, then include it once in the TLS `bonifacio.work` server block alongside the existing FeelMyRythm locations:

```sh
install -o root -g root -m 0644 \
  ops/sso/nginx/feelmyrythm-api.conf \
  /etc/nginx/snippets/bonifacio-feelmyrythm-api.conf
```

```nginx
include /etc/nginx/snippets/bonifacio-feelmyrythm-api.conf;
```

The dedicated prefix is more specific than `/feelmyrythm/`. It retains the central `auth_request`, trusted identity headers, and application edge secret, while `proxy_intercept_errors off` lets application-origin `401` JSON reach the web client. This distinction is required: an edge authorization `401` must still redirect to `/sso/`, but a rejected or expired FeelMyRythm bearer token must reach the client so it can refresh or exchange its application session. Keep the exact public `/feelmyrythm/api/health` location in the server block; the exact match remains the narrow unauthenticated health exception.

Do not protect the general `/sso/` portal with its own auth request. The more-specific `/sso/user/` and `/sso/admin/` locations are protected, use the same edge-secret boundary, and remain separate role-appropriate interfaces. Keep `/internal/authelia/authz` internal. Product health checks used by the restricted local deployer should use loopback origins. The explicitly documented Pilgrimage and FeelMyRythm public health routes are narrow exceptions and must strip identity headers.

## Safe rollout

1. Validate the configuration and supervisor tests against the exact pinned build inputs.
2. Start `bonifacioSsoRedis`, then start the unified `bonifacioSso` container with both loopback ports.
3. Verify the portal/auth endpoint on port 9091 and administrator health on port 9092.
4. Add the auth include to one product at a time and verify redirect, login, trusted headers, and logout.
5. Enable the corresponding app-native SSO exchange before removing its old login UI.
6. Verify `/sso/user/` for an ordinary user's own-profile/password flow, then verify `/sso/admin/` and a one-time test account create/login/reset/disable cycle, including Authelia's live file watcher.
7. Preserve Redis, both named volumes, and every unrelated container ID during each rollout.

The first split-to-unified conversion is a structural migration: preserve the former Compose layout and both prior images for rollback, remove the old administrator container that owns port 9092, and then replace the former Authelia-only container with the unified image under the fleet deployment lock. After that migration, the restricted deployer replaces the unified SSO and landing containers together, verifies both SSO endpoints, and requires the Redis container ID to remain unchanged.

Never run stack-wide `down -v` or remove either `bonifacio-sso-*` volume.
