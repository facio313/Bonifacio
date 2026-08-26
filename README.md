# Bonifacio

Portfolio landing page and the deployment contract for the shared `bonifacio.work` SSO edge.

## Single sign-on

The production login portal is served at `https://bonifacio.work/sso/`. Authelia keeps the shared browser session and host Nginx protects each portfolio route with `auth_request`. Applications with their own user model exchange the trusted `Remote-*` identity for their existing local session or token format; static applications rely on the edge gate alone.

Central accounts are managed at `https://bonifacio.work/sso/admin/`. The canonical role hierarchy is `user < admin < chief-admin`; `developer` has been removed. A `chief-admin` reaches every protected application, while `user` and `admin` accounts reach only the applications explicitly checked in SSO Admin. The screen supports per-user app grants, password changes after current-password verification, account issuance, one-time temporary password resets, role changes, and activation controls. Only a `chief-admin` may manage privileged accounts, while an `admin` may manage ordinary users. Public self-registration and email-based recovery remain closed while outbound email and identity recovery are unavailable. The administrator is the sole writer of the file-backed directory, avoiding lost updates between independent processes.

The repository contains only the non-secret SSO configuration. Create the real operator files and dedicated user database directory outside Git as described in [`ops/sso/README.md`](ops/sso/README.md). Do not run `docker compose down -v`: the Authelia SQLite and Redis volumes are persistent authentication state.

The edge protects the landing page plus React, Vue, Dukkeobi, DDIT FinalProject, Monitor, Pilgrimage, Multtara, FeelMyRythm, and Garak. Pilgrimage keeps only its documented health, asset, and UUID share routes public. Deployment checks call loopback origins so a login redirect can never be mistaken for application health.

Blog is a separate public read-only application at `/blog/`. Its versioned host route is [`ops/sso/nginx/blog-public.conf`](ops/sso/nginx/blog-public.conf): the edge proxies only to loopback port `5176`, removes identity and credential headers, and rebuilds forwarded headers instead of trusting client input. Blog has no local account or login system.

## Branch authentication contract

Every process, build, and repository Compose invocation resolves authentication
through `scripts/portfolio-auth-mode.sh`:

| Branch | Authentication mode |
| --- | --- |
| `main`, `dev` | `sso` |
| every other branch | `local` |

Branch resolution uses an explicit `PORTFOLIO_BRANCH`, then
`GITHUB_REF_NAME`, then the current Git branch. An explicitly supplied
`PORTFOLIO_AUTH_MODE` must match the table or the command fails closed. CI and
Docker builds always provide both values explicitly. The resulting image keeps
the resolved values as defaults and validates them again at its entrypoint, so
the existing production Compose deployment does not need a new secret or host
setting.

The landing page is static: `local` means that a feature-branch Vite server can
be opened directly, while `sso` keeps the production authorization decision at
the Nginx/Authelia edge. It does not add a client-side SSO bypass.

Build the landing page with:

```bash
npm ci
npm run build
```

## Browser text editor

The landing page shows a compact `텍스트 수정` control in the lower-right corner only after the SSO administrator endpoint has verified an `admin` or `chief-admin` against the central database. Its expanded control panel and each save/cancel dialog are centered in the viewport. Edit mode marks editable copy with a pencil and keeps overrides in the current browser under a versioned key namespaced by the verified central username. Individual fields or all overrides can be restored to the source defaults.

These overrides are intentionally browser-local drafts. They survive reloads and deployments for the same verified administrator on the same origin, but they are never loaded before authorization, are not shown across shared-browser accounts, and are not a shared CMS or publication mechanism.

On a feature branch, run the landing page directly with `npm run dev`. Use the
contract-aware Compose wrapper for repository-local containers:

```bash
npm run compose -- up --build
```

For a Docker build outside Compose, inject the branch contract explicitly:

```bash
docker build \
  --build-arg PORTFOLIO_BRANCH=main \
  --build-arg PORTFOLIO_AUTH_MODE=sso \
  --tag bonifacio:main .
```
