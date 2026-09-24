# Contributing

## Workflow

1. **Issue first.** Every change starts from an issue (use the bug / feature forms). Security
   problems: don't open a public issue with details. Contact the maintainer privately.
2. **Branch** from `main`: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`, `docs/<short-name>`.
3. **Commit** small, focused changes with imperative messages (`Add coupon admin list`), referencing
   the issue in the body when useful.
4. **Pull request** into `main` using the template; link the issue with `Closes #N`.
5. **Review** before merge. Reviewers check correctness, tenant isolation, and that money/stock
   logic stays server-side (see the risk checklist in the PR template).
6. **Squash-merge.** Merging to `main` deploys to production on Vercel; every PR gets a preview URL.

## Local setup

```bash
npm install
cp .env.example .env.local     # never commit .env.local
npm run dev                    # http://demo-electronics.localhost:3000
```

See the [README](README.md) and [docs/](docs) for the architecture and database setup.

## Checks before opening a PR

| Change | Run |
|---|---|
| Any code | `npm run check` (typecheck + lint + unit tests) |
| SQL / migrations / RLS | `npm run test:db` (any Postgres ≥ 15) |
| Routing, caching, config | `npm run build` |
| User-facing flows | `npm run test:e2e` (needs Supabase running) |

## Ground rules

- **Never trust the client** for prices, totals, stock or tenant ids. The server and Postgres decide.
- **Every query is tenant-scoped.** Repository functions take `tenantId` first.
- **Migrations are append-only and backward compatible** (expand → deploy → contract).
- **No secrets in the repo, issues or PRs.** Configuration goes through environment variables
  (`.env.example` documents them).
- Match the surrounding code style; keep components presentational and business logic in `src/features/`.
