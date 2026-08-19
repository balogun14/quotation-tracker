# Quotely Backend PRD

## Problem Statement

Rental businesses currently track quotations, follow-ups, customer decisions, and bookings manually or in disconnected tools. This makes it easy for leads to go cold, difficult for teams to share ownership of the pipeline, and hard to understand quote performance across currencies. The existing Quotely frontend is a prototype that stores sample quotes in the browser and simulates authentication; it needs a secure, multi-user backend that makes the product reliable in production.

## Solution

Build a TypeScript and Express backend for Quotely. Rental businesses will create a shared workspace, invite teammates, create and send branded, itemised quotation PDFs, automate follow-ups, and record customer acceptance or decline through secure public links. The product will provide immutable sent-quote versions, multi-currency reporting with pinned FX conversions, resilient background jobs, and auditable operations.

## User Stories

1. As a rental-business owner, I want to create a workspace, so that my company has a private Quotely account.
2. As a new user, I want to sign up with my name, business name, email, and password, so that I can begin tracking quotes.
3. As a returning user, I want to sign in securely, so that I can access my workspace.
4. As a signed-in user, I want my session to refresh safely, so that I do not need to repeatedly sign in.
5. As a user, I want to reset a forgotten password by email, so that I can recover access securely.
6. As a user, I want to verify my email address, so that my account can perform sensitive workspace actions.
7. As an owner, I want to invite teammates by email, so that we can work in one shared workspace.
8. As an invitee, I want to accept an invitation with an existing or new account, so that I can join the correct business.
9. As an owner, I want to assign owner or member roles, so that administrative authority is appropriately limited.
10. As an owner, I want to manage workspace branding, so that customer communications look like they came from my business.
11. As an owner, I want to set my business name, reply-to email, logo, phone, address, website, payment instructions, default currency, and accent colour, so that quotations are complete and branded.
12. As a member, I want to create a draft quote, so that I can prepare an offer before it reaches a customer.
13. As a member, I want to capture a customer’s contact and company details, so that the quote can be delivered and tracked.
14. As a member, I want to add, edit, reorder, and remove line items, so that the quote describes the rental service accurately.
15. As a member, I want discounts and tax to be calculated server-side, so that totals cannot be manipulated by the client.
16. As a member, I want to choose one currency for a quote, so that the customer sees an unambiguous total.
17. As a member, I want to set an expiry date, so that customers know how long the offer is valid.
18. As a member, I want to preview a branded PDF, so that I can check it before sending.
19. As a member, I want to email a formal quotation, so that the customer receives the offer directly.
20. As a member, I want each sent quote version preserved, so that edits do not alter a document the customer already received.
21. As a customer, I want to open a secure quote link without creating an account, so that I can review the offer easily.
22. As a customer, I want to accept or decline a quote from the secure link, so that I can give a clear decision.
23. As a member, I want to see when and how a customer decided, so that I can act on the result.
24. As a member, I want to revoke a public quote link, so that an obsolete document can no longer be used.
25. As a member, I want to schedule internal follow-up reminders, so that I do not miss prospects.
26. As a member, I want to opt into automatic branded follow-up emails, so that approved quotes receive timely outreach.
27. As a member, I want follow-ups to stop when a quote is accepted, declined, expired, or cancelled, so that customers are not contacted inappropriately.
28. As an owner, I want to configure the default quote-expiry period, so that the team uses a consistent policy.
29. As a member, I want expired quotes to be identified automatically, so that the pipeline remains accurate.
30. As an owner, I want dashboard totals grouped by native currency, so that results are financially honest.
31. As an owner, I want consolidated reporting in a selected reporting currency, so that I can assess the overall pipeline.
32. As an owner, I want each conversion to use a retained historical FX rate, so that past totals remain reproducible.
33. As an owner, I want to override an FX rate with a recorded reason, so that exceptional commercial rates can be represented transparently.
34. As a user, I want to filter reporting by date, member, status, and currency, so that I can answer operational questions.
35. As an owner, I want to export filtered quotes to CSV, so that I can analyse data elsewhere.
36. As an owner, I want to see an audit history of important actions, so that workspace changes can be investigated.
37. As an owner, I want to export my workspace data, so that I can retain control of my information.
38. As an owner, I want to delete my workspace, so that data is removed when I no longer use Quotely.
39. As an operator, I want backups and health monitoring, so that production failures can be detected and recovered from.
40. As a developer, I want a versioned and documented API, so that the frontend and future integrations can depend on a stable contract.

## Implementation Decisions

- Build a TypeScript REST API with Express under a versioned `/api/v1` namespace. Use resource-oriented endpoints, cursor pagination, a stable error envelope, and OpenAPI documentation.
- Model shared tenancy with `users`, `workspaces`, and `workspace_members`. Scope every business record to a workspace and enforce authorization on the server.
- Support two roles: `owner` manages workspace settings, members, and workspace deletion; `member` manages operational quote work but cannot administer members or delete the workspace.
- Use SQLite with Drizzle ORM and committed migrations. Configure foreign keys, WAL mode, and a busy timeout at startup. The first deployment is intentionally a single persistent instance.
- Use Argon2id password hashing. Implement short-lived access JWTs and rotating refresh tokens; place refresh tokens in `HttpOnly`, `Secure`, `SameSite=Lax` cookies and store hashed refresh-session records for revocation and logout.
- Provide signup, login, logout, token refresh, email verification, password reset, and invitation flows. Rate-limit authentication, reset, invitation, and public-link endpoints.
- Create a deep `EmailProvider` module with a provider-neutral send contract. Implement Resend for production and a console provider for development/testing, chosen through environment configuration.
- Capture workspace branding: required business name and reply-to email; optional logo URL, phone, physical address, website, payment instructions, default currency, and accent colour. Tax/registration IDs are explicitly excluded.
- Model quotes with client details, owner, service description, notes, lifecycle, expiry date, quote currency, line items, discount/tax values, totals, and follow-up settings. Store all monetary values as integer minor units; never use floating-point amounts.
- A quote has one customer-facing ISO 4217 currency. Line items cannot use different currencies from their parent quote.
- Enforce the lifecycle `draft → sent → followed_up → accepted | declined | expired`, with `cancelled` available internally. Treat accepted as Booked in existing product language, and declined/expired as Lost. Store transition timestamps and reasons.
- On send, create an immutable quote-version snapshot, render a branded PDF, persist document metadata, email the customer, and issue a high-entropy random public-link token stored only as a hash. Links are scoped to a particular sent version, expire with the quote, and can be revoked.
- Let customers accept or decline through the public link. Record the recipient identity available from the link flow, timestamp, and resulting state.
- Create a deep `FileStorageProvider` module. Use a local-disk implementation initially, with files outside the web root and access mediated through authorization or the matching signed public link. Preserve an adapter boundary for future object storage such as S3/R2.
- Create a deep `FxRateProvider` module. Start with Frankfurter daily reference data, cache rate source, effective date, pair, and precision in SQLite, and pin the selected rate for reporting. Owners may manually override a rate only with an auditable reason. Rates must never silently rewrite historical reporting.
- Generate native-currency metrics and optional reporting-currency conversions. Use FX for internal reporting only, not for customer-facing quote totals.
- Run a separate worker process that claims scheduled work from a SQLite `jobs` table. Jobs include schedule time, retry state, idempotency key, and failure metadata. Use it for sending email, reminders, quote expiry, FX refresh, deletion, and maintenance tasks.
- Default follow-ups to internal reminders. Enable automatic branded customer follow-up emails only per quote. Cancel pending follow-ups on every terminal lifecycle transition.
- Use a configurable default quote-expiry duration, initially 14 days. A worker expires quotes daily; extending an already sent quote creates a new sent version rather than rewriting the old one.
- Store append-only audit events for authentication, membership and role changes, workspace configuration, quote modifications and transitions, sends, recipient decisions, public-link revocations, and FX overrides. Include actor, workspace, entity, timestamp, relevant before/after summaries, and limited request metadata.
- Define reporting for total quotes, total quoted, won value, win rate, and overdue follow-ups. Support date range, member, status, and currency filtering plus CSV export.
- Deploy Express and the worker as Docker containers on a single VPS with persistent volumes for SQLite and local files. Do not target serverless or horizontally scaled deployment in this phase.
- Create encrypted off-host daily database backups and file snapshots. Retain 30 daily, 12 monthly, and 7 yearly copies; target a 24-hour recovery point, document restoration, and test it quarterly.
- Support workspace export and owner-requested deletion. Disable access immediately, then delete workspace data, files, sessions, and queued jobs after a 30-day recovery period, subject only to any legally necessary minimum records.
- Operate structured JSON logging with request IDs, centralized error tracking, `/health` and `/ready` checks, job-failure alerts, and daily backup-success alerts. Never log passwords, JWTs, reset tokens, raw public tokens, or complete sensitive request bodies.
- Use Zod to validate and normalize all inbound API data, rejecting unknown fields on sensitive endpoints. Align shared schemas with the frontend where useful and keep database constraints as the final integrity safeguard.

## Testing Decisions

- Use Vitest for unit and integration tests against isolated temporary SQLite databases, and Playwright for a concise end-to-end browser suite.
- Enforce a CI coverage floor of 80% for statements, branches, functions, and lines. Exclude only generated code, migrations, and type-only files; do not exclude business logic to meet the threshold.
- Test observable behaviour and public contracts rather than implementation details.
- Unit-test deep modules: authorization policy, auth/session rotation, `EmailProvider`, `FileStorageProvider`, `FxRateProvider`, money calculations, quote lifecycle rules, version snapshots, public-link token handling, and job idempotency/retry behaviour.
- Integration-test API contracts, workspace isolation, role enforcement, validation errors, invitations, verification and reset flows, quote send/accept/decline/expiry behaviour, rate pinning/manual override, auditing, exports, and deletion scheduling.
- End-to-end test signup, invitation acceptance, login, sending a quote, and a customer accepting a quote.
- The existing repository contains no backend tests or comparable testing prior art. Establish the above suite as the project standard.

## Out of Scope

- Payment collection, invoicing, accounting integrations, and reconciliation.
- Tax/registration ID fields in business branding.
- Multiple currencies within a single customer-facing quotation.
- Advanced forecasting, CRM integrations, or advanced analytics beyond the defined dashboard and CSV export.
- Cloud/object file storage; the storage adapter is included now, but S3/R2 implementation is deferred.
- Horizontally scaled, serverless, or multi-region deployments.
- Additional roles beyond owner and member.
- Rewriting or retroactively changing previously sent quote documents or their pinned reporting FX rates.

## Further Notes

- This PRD treats the current React/Vite experience as the frontend client to be connected to the API; it does not prescribe a frontend rewrite.
- FX values are reference rates for reporting, not accounting, settlement, or customer pricing advice. The application must display the original quote currency alongside converted totals.
- Public acceptance links are a convenience feature, not a replacement for a legally reviewed electronic-signature workflow.
- GitHub is configured as the repository remote, but the GitHub CLI is unavailable in this workspace; publish this document as an issue with the `ready-for-agent` label once issue-tracker access is available.
