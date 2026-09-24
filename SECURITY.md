# Security policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub:
**[Report a vulnerability](https://github.com/Shahrukhkaleem-bot/Tech-Lab-/security/advisories/new)**
(Security tab → *Report a vulnerability*).

Include what you found, how to reproduce it, and the impact (for example, cross-tenant data access,
price or stock manipulation, authentication bypass). Never include real customer data or live
credentials in the report.

You can expect an acknowledgement within a few days. Fixes are released as soon as they are
verified, and reporters are credited in the advisory unless they prefer otherwise.

## Scope

In scope: this repository's application code, SQL migrations and RLS policies, and the
deployment configuration it defines.

Especially interested in: tenant isolation (one store reading or changing another's data),
row-level security gaps, checkout / payment / stock manipulation, authentication and session
handling, file upload handling, and secret exposure.

The security design is documented in [docs/07-security.md](docs/07-security.md).
