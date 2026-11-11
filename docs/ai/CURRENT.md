## 2026-11-12 main/dev policy migration

- User-authorized scope: preserve the latest production main and migrate implementation/local execution to dev; do not publish or deploy this policy change to main.
- Current contract: main=sso, dev=local; other branches fail closed. CI validates both branches, and production publishing/deployment is main-only. Earlier dated tool-branch/dev-retirement notes below are historical, not current operating instructions.
- Preservation: all remote refs were saved in a verified Git bundle outside the repository before changes. Original worktrees and dirty/untracked files were not overwritten; staging uses a separate dev checkout. Dependabot proposals remain archived, not merged.
- History: two codex patches already match main (git cherry minus). The old Garak route patch is superseded by main's app-grant ACL and existing card; an explicit history-only merge preserves all three commits without restoring the old user-only ACL.
- Local verification: Canonical resolver matrix and main-local-run rejection passed; 46 Node SSO/policy tests passed. Python SSO suite passed 17 tests with 1 existing nginx-dependent skip (nginx is unavailable locally). Dev-mode typecheck/build and workflow YAML parsing passed.
- Validation and remote commit evidence are recorded outside Git under ~/.local/share/cks-main-dev-migration/2026-11-12/Bonifacio/. Original-worktree checkout/retirement is coordinated separately after preservation checks.

---

