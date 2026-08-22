# Bonifacio

Portfolio landing page and the deployment contract for the shared `bonifacio.work` SSO edge.

## Single sign-on

The production login portal is served at `https://bonifacio.work/sso/`. Authelia keeps the shared browser session and host Nginx protects each portfolio route with `auth_request`. Applications with their own user model exchange the trusted `Remote-*` identity for their existing local session or token format; static applications rely on the edge gate alone.

Owner accounts are managed at `https://bonifacio.work/sso/admin/`. The screen is available only to the exact `owners` group and supports changing the signed-in owner's password after current-password verification, account issuance, one-time temporary password resets, profile/role changes, and activation controls. Public self-registration and email-based recovery remain closed while outbound email and identity recovery are unavailable. The administrator is the sole writer of the file-backed directory, avoiding lost updates between independent processes.

The repository contains only the non-secret SSO configuration. Create the real operator files and dedicated user database directory outside Git as described in [`ops/sso/README.md`](ops/sso/README.md). Do not run `docker compose down -v`: the Authelia SQLite and Redis volumes are persistent authentication state.

The edge protects the landing page plus React, Vue, Dukkeobi, DDIT FinalProject, Monitor, Pilgrimage, Multtara, and FeelMyRythm. Pilgrimage keeps only its documented health, asset, and UUID share routes public. Deployment checks call loopback origins so a login redirect can never be mistaken for application health.

Build the landing page with:

```bash
npm ci
npm run build
```
