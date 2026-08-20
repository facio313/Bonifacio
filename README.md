# Bonifacio

Portfolio landing page and the deployment contract for the shared `bonifacio.work` SSO edge.

## Single sign-on

The production login portal is served at `https://bonifacio.work/sso/`. Authelia keeps the shared browser session and host Nginx protects each portfolio route with `auth_request`. Applications with their own user model exchange the trusted `Remote-*` identity for their existing local session or token format; static applications rely on the edge gate alone.

The repository contains only the non-secret SSO configuration. Create the real operator files outside Git as described in [`ops/sso/README.md`](ops/sso/README.md). Do not run `docker compose down -v`: the Authelia SQLite and Redis volumes are persistent authentication state.

The edge protects the landing page plus React, Vue, Dukkeobi, DDIT FinalProject, Monitor, Pilgrimage, Multtara, and FeelMyRythm. Pilgrimage keeps only its documented health, asset, and UUID share routes public. Deployment checks call loopback origins so a login redirect can never be mistaken for application health.

Build the landing page with:

```bash
npm ci
npm run build
```
