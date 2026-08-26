# Bonifacio

Portfolio landing page and the deployment contract for the shared `bonifacio.work` SSO edge.

## Single sign-on

The production login portal is served at `https://bonifacio.work/sso/`. Authelia keeps the shared browser session and host Nginx protects each portfolio route with `auth_request`. Applications with their own user model exchange the trusted `Remote-*` identity for their existing local session or token format; static applications rely on the edge gate alone.

Central accounts are managed at `https://bonifacio.work/sso/admin/`. The screen is available only to the exact hierarchy-closed `user,developer,admin` role set and supports changing the signed-in administrator's password after current-password verification, account issuance, one-time temporary password resets, central role changes, and activation controls. The canonical role hierarchy is `user < developer < admin`: `/monitor/` requires `developer`, the administrator requires `admin`, and the other protected portfolio applications require `user`. Public self-registration and email-based recovery remain closed while outbound email and identity recovery are unavailable. The administrator is the sole writer of the file-backed directory, avoiding lost updates between independent processes.

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

The landing page has a compact `텍스트 수정` control in the lower-right corner. Edit mode marks editable copy with a pencil, opens a focused save/cancel dialog, and keeps overrides in the current browser under the versioned `bonifacio.content.v1` local-storage key. Individual fields or all overrides can be restored to the source defaults.

These overrides are intentionally browser-local drafts. They survive reloads and deployments on the same origin, but they are not a shared CMS and do not publish changes to other browsers or devices.

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
