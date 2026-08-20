# Bonifacio operating contract

- `https://bonifacio.work/sso/` is the single sign-on portal for the portfolio services hosted on `bonifacio.work`.
- Authelia `AuthRequest` is the authoritative edge session. Protected upstreams receive `Remote-User`, `Remote-Email`, `Remote-Name`, and `Remote-Groups` only after the host Nginx auth subrequest succeeds.
- The edge must overwrite, never append or trust, caller-supplied `Remote-*` headers. Application origins remain loopback-only or Docker-internal so they cannot be used to bypass the edge.
- The SSO portal, its internal authorization endpoint, and narrow container/deployment health probes are the only infrastructure exceptions to the login gate. A product's explicitly public share route may remain public only where that repository contract requires it.
- Authelia configuration is committed without secrets. The real user database, session/encryption/reset secrets, SQLite state, Redis state, and notification file stay outside Git in operator-owned paths or named volumes.
- The initial deployment is one-factor and file-backed for the sole owner account. Password reset and password change are disabled until a real notification provider and recovery procedure exist.
- Never use mutable SSO or Redis image tags in production. Preserve the dedicated `bonifacio-sso` network and both persistent volumes during application deploys.
- `wgang` is not part of this SSO deployment. Follow `/home/cks/AGENTS.md` and do not inspect or change it unless the user separately requests that work.
- Protected portfolio routes are `/`, `/react/`, `/vue/`, `/dukkeobi/`, `/ddit-finalproject/`, `/monitor/`, `/pilgrimage/`, `/api/`, `/multtara/`, and `/feelmyrythm/`. Pilgrimage health, built assets, and its explicit UUID share routes remain narrow public exceptions; deployment health probes use loopback origins.
- A Bonifacio application deploy must prove `bonifacioSso` and `bonifacioSsoRedis` are healthy before and after replacing the landing-page container, and their container IDs must not change during that deploy.
