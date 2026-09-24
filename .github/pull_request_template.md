## What & why

<!-- One or two sentences. Link the issue: "Closes #123". -->

Closes #

## How it was tested

<!-- Commands run, pages checked, screenshots for UI changes. -->

- [ ] `npm run check` (typecheck, lint, unit tests)
- [ ] `npm run test:db` if SQL, RLS or migrations changed
- [ ] `npm run build` if routing, caching or config changed
- [ ] Checked the change on at least two stores (tenant isolation)

## Risk checklist

- [ ] No secrets, keys or customer data in code, logs or screenshots
- [ ] New/changed queries filter by `tenant_id` (and RLS still protects private data)
- [ ] Prices, totals and stock are still computed server-side only
- [ ] Migrations are backward compatible with the currently deployed app
- [ ] Pages that read cookies or search params are `force-dynamic` (no cached per-user HTML)
- [ ] Docs updated (`docs/`) if behaviour or setup changed
