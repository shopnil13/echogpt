# EchoGPT Backend

Production-ready REST API for the [EchoGPT](https://chromewebstore.google.com/detail/echogpt-multi-ai-chat-sid/negimdcamohmoheiifgecbjgjepkcfhj) multi-AI chat Chrome extension. Built with **NestJS 11**, **PostgreSQL**, **Prisma 7** and **Swagger/OpenAPI**.

- Session-bound JWT authentication with rotating refresh tokens, reuse detection and email verification
- User profiles, password change, account deletion and Admin/User roles
- Free and Premium plans with atomic, race-free usage quotas
- Multi-provider AI chat: OpenAI, Anthropic Claude and Google Gemini, with encrypted API keys, health checks and **streaming (SSE)**
- AI-assisted web search with shared result caching, history, recent searches and privacy-preserving suggestions
- Admin APIs: dashboard, users, subscriptions, providers, usage analytics, request logs and system health
- Every endpoint documented in Swagger with request/response examples and error responses

A keyless **mock AI provider** and **mock search engine** are enabled by default, so every feature can be tried without paid API keys.

---

## Contents

1. [Quick start (Docker)](#quick-start-docker)
2. [Local development](#local-development)
3. [Trying the API](#trying-the-api)
4. [Configuration](#configuration)
5. [Architecture](#architecture)
6. [Database](#database)
7. [Security](#security)
8. [Testing](#testing)
9. [Scripts](#scripts)
10. [Project structure](#project-structure)
11. [Git workflow](#git-workflow)

---

## Quick start (Docker)

Requirements: Docker with Compose v2.

```bash
cp .env.example .env
# Fill in the two required secrets:
#   JWT_ACCESS_SECRET=$(openssl rand -base64 48)
#   ENCRYPTION_KEY=$(openssl rand -base64 32)
docker compose --profile app up --build
```

This starts PostgreSQL, runs a one-off job that applies the migrations and seeds reference data, then starts the API and a Mailpit inbox that catches every email the API sends.

| URL                                       | What                                |
| ----------------------------------------- | ----------------------------------- |
| http://localhost:3000/api/docs            | Swagger UI                          |
| http://localhost:3000/api/docs-json       | OpenAPI document                    |
| http://localhost:3000/api/v1/health/ready | Readiness probe                     |
| http://localhost:8025                     | Mailpit inbox (verification emails) |

Seeded admin account (from `.env`): `admin@echogpt.local` / `ChangeMe!Admin2026`. Change it before sharing any environment.

## Local development

Requirements: Node.js 22 (`nvm use`), Docker (for PostgreSQL).

```bash
npm install
cp .env.example .env              # then set JWT_ACCESS_SECRET and ENCRYPTION_KEY
docker compose up -d postgres     # PostgreSQL 18 on 127.0.0.1:5434 (+ echogpt_test database)
npm run db:deploy                 # apply migrations
npm run db:seed                   # roles, plans, admin, providers (idempotent)
npm run start:dev                 # http://localhost:3000
```

The app refuses to start if any environment variable is missing or invalid, and lists every problem at once.

## Trying the API

The fastest route is Swagger UI (`/api/docs`): call **POST /auth/login**, click **Authorize**, and paste the `accessToken`.

Alternatively, import `postman/echogpt.postman_collection.json` into Postman. Run **Sign in with email and password** first; the collection stores the tokens for every other request.

A typical flow with curl:

```bash
API=http://localhost:3000/api/v1

# Register (returns user + tokens)
TOKEN=$(curl -s $API/auth/register -H 'content-type: application/json' \
  -d '{"email":"jane@example.com","password":"Sup3r-secret-pass","fullName":"Jane"}' | jq -r .tokens.accessToken)

# Start a conversation and ask something (uses the default provider)
CONV=$(curl -s $API/chat/conversations -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{}' | jq -r .id)
curl -s $API/chat/conversations/$CONV/messages -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"content":"Plan a weekend in Lisbon"}' | jq

# Stream the answer (Server-Sent Events)
curl -N $API/chat/conversations/$CONV/messages/stream -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"content":"And the best cafés?"}'

# AI-assisted web search
curl -s $API/search -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"query":"best coffee in Lisbon","summarize":true}' | jq

# Remaining requests on your plan
curl -s $API/subscriptions/me/usage -H "authorization: Bearer $TOKEN" | jq
```

**Using real AI providers:** sign in as admin, then `PATCH /admin/providers/{id}` with an `apiKey` and `PATCH /admin/providers/{id}/status` with `{"isEnabled": true}`. Alternatively, set `SEED_OPENAI_API_KEY`, `SEED_ANTHROPIC_API_KEY` or `SEED_GEMINI_API_KEY` before the first seed. `POST /admin/providers/{id}/health-check` verifies a key without spending tokens. Set `SEARCH_ENGINE=tavily` and `TAVILY_API_KEY` for real web results.

**Email verification:** registering sends a verification email. With Docker it arrives in the Mailpit inbox (http://localhost:8025). With `npm run start:dev` (`MAIL_TRANSPORT=log`) it is printed to the application log. The link points at `EMAIL_VERIFICATION_URL`, the client page (for example in the extension) that reads `?token=` and calls the API. This repository has no such page, so copy the token from the link and send it yourself:

```bash
curl -s $API/auth/verify-email -H 'content-type: application/json' -d '{"token":"<token from the link>"}'
```

`POST /auth/resend-verification` (signed in) issues a new link and invalidates the old one. Set `REQUIRE_EMAIL_VERIFICATION=true` to block chat and search for unverified accounts.

The mock provider understands two markers for exercising failure paths: `[mock:fail]` (upstream error) and `[mock:refuse]` (model refusal).

## Configuration

All variables are validated at boot (`src/config/env.validation.ts`); `.env.example` documents each one.

| Variable                                            | Default                             | Purpose                                                       |
| --------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`                                      | required                            | PostgreSQL connection string                                  |
| `JWT_ACCESS_SECRET`                                 | required                            | HS256 secret, at least 32 characters                          |
| `ENCRYPTION_KEY`                                    | required                            | 32-byte base64 key encrypting provider API keys (AES-256-GCM) |
| `JWT_ACCESS_TTL_SECONDS` / `REFRESH_TOKEN_TTL_DAYS` | `900` / `30`                        | Token lifetimes                                               |
| `CORS_ORIGINS`                                      | empty (CORS off)                    | Allowlist, e.g. `chrome-extension://<extension-id>`           |
| `TRUST_PROXY`                                       | `false`                             | Set behind a load balancer so client IPs are correct          |
| `SWAGGER_ENABLED`                                   | `true`, `false` in production       | Expose `/api/docs`                                            |
| `REQUIRE_EMAIL_VERIFICATION`                        | `false`                             | Block chat and search until the email is verified             |
| `MAIL_TRANSPORT`                                    | `log`; must be `smtp` in production | `log` prints emails (development), `smtp` sends them          |
| `AI_MOCK_PROVIDER_ENABLED`                          | `false` (`true` in `.env.example`)  | Allow the keyless mock provider                               |
| `AI_REQUEST_TIMEOUT_MS` / `AI_MAX_OUTPUT_TOKENS`    | `60000` / `16000`                   | Provider call limits                                          |
| `CHAT_CONTEXT_MESSAGES`                             | `20`                                | Previous messages sent as context                             |
| `SEARCH_ENGINE` / `TAVILY_API_KEY`                  | `mock`                              | Web search backend                                            |
| `SEARCH_CACHE_TTL_SECONDS`                          | `3600`                              | Shared result cache lifetime (0 disables)                     |
| `THROTTLE_LIMIT` / `AUTH_THROTTLE_LIMIT`            | `100` / `10` per minute             | Rate limits (global / auth routes)                            |

## Architecture

A **modular monolith**: one deployable, with a NestJS module per domain and strict layering inside each module.

```
controller (HTTP, DTO validation, Swagger)
   └─ service (business rules, transactions)
        ├─ repository (the only layer that touches Prisma)
        └─ adapters behind interfaces (AI providers, search engines, mail)
```

| Module          | Responsibility                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| `auth`          | Register, login, refresh, logout, email verification, global auth/role guards                              |
| `sessions`      | Session lifecycle, refresh-token rotation and reuse detection                                              |
| `users`         | Profile, password, account deletion, admin user management                                                 |
| `subscriptions` | Plans, plan changes, quota accounting (`QuotaGuard`)                                                       |
| `ai-providers`  | Provider CRUD, key encryption, adapters (OpenAI/Anthropic/Gemini/Mock), health checks, provider resolution |
| `chat`          | Conversations, messages, prompt execution, SSE streaming                                                   |
| `search`        | Web search engines (Tavily/Mock), cache, history, suggestions, AI summaries                                |
| `usage-logs`    | One log row per request, request-log browsing, usage analytics                                             |
| `admin`         | Dashboard statistics and system health (read-only aggregation)                                             |
| `maintenance`   | Hourly cleanup of expired cache, sessions and tokens                                                       |

**Request pipeline:** request-ID middleware → helmet/CORS/body limit → usage-log middleware → guards (throttle → JWT → roles → email verification → quota) → validation pipe → handler → global exception filter.

**Conventions:** base path `/api/v1`; JSON in camelCase; lists return `{ data, meta: { page, limit, total, totalPages } }`; every error uses one envelope with a stable machine-readable `code`:

```json
{
  "statusCode": 429,
  "code": "QUOTA_EXCEEDED",
  "message": "You have used all 20 requests of your Free plan for this period",
  "details": { "limit": 20, "period": "DAILY", "resetsAt": "2026-09-27T00:00:00.000Z" },
  "path": "/api/v1/chat/conversations/…/messages",
  "timestamp": "2026-09-26T18:04:11.201Z",
  "requestId": "4f0c8a2e-1b3d-4c5e-9f6a-7b8c9d0e1f2a"
}
```

Send `x-request-id` to correlate a request across responses, logs and usage records.

**Scaling:** the API is stateless. Quotas use a single conditional upsert, the default provider and active subscription are protected by partial unique indexes, and the cleanup job takes an advisory lock, so any number of replicas can share one database. The documented next steps are Redis for throttling and caching, and partitioning `api_usage_logs`.

## Database

PostgreSQL schema in `prisma/schema.prisma`; migrations in `prisma/migrations/`.

| Table                                      | Purpose                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `roles`, `users`                           | Accounts and roles (lookup table, one role per user)                   |
| `sessions`, `verification_tokens`          | Per-device sessions (hashed refresh secrets), hashed single-use tokens |
| `plans`, `subscriptions`, `usage_counters` | Plans as data, subscription history, atomic quota counters             |
| `ai_providers`, `ai_models`                | Providers with encrypted keys and health, their models                 |
| `conversations`, `messages`                | Chat history with provider, model, tokens and latency per message      |
| `web_searches`, `search_cache_entries`     | Per-user search history (with result snapshots) and the shared cache   |
| `api_usage_logs`                           | One row per API request (bigint key, analytics indexes)                |

Design points: UUIDv7 keys, `timestamptz` everywhere, every foreign key indexed with an explicit `ON DELETE`, and hand-written SQL for invariants Prisma cannot express (one active subscription per user, a single enabled default provider, non-negative counters, prefix indexes for suggestions). Deleting an account removes personal data by cascade and anonymizes usage logs.

## Security

- **Passwords:** Argon2id (OWASP parameters), equal-time login failures, generic error messages.
- **Tokens:** 15-minute access JWTs bound to a server-side session, checked on every request, so logout and suspension take effect immediately. Refresh tokens are opaque, stored as SHA-256 and rotated on every use; replaying an old one revokes the session.
- **Authorization:** routes are authenticated by default (`@Public()` opts out); admin routes need the `ADMIN` role; every user-owned query is scoped by owner and returns 404 for other users' data. An e2e test sweeps all 20 admin routes as a normal user.
- **Secrets at rest:** provider API keys use AES-256-GCM (versioned format), are write-only in the API and never logged.
- **Input and output:** whitelisting DTO validation that rejects unknown fields; responses built from explicit field allowlists.
- **Abuse limits:** global and stricter auth rate limits, plan quotas, body-size limit, prompt and page-size caps, provider timeouts.
- **SSRF:** provider base URLs must be HTTPS and must not resolve to private or loopback addresses; the search endpoint is fixed in code.
- **Privacy:** other users' queries appear in search suggestions only after several distinct users searched them. Search results sent to the model for summaries are delimited as untrusted data.
- **Hardening:** helmet headers, CORS allowlist, no stack traces in responses, secret redaction in logs, Swagger off by default in production, boot refuses the log mail transport in production (it would write one-time tokens to the logs), non-root Docker image, `npm audit` clean.

## Testing

```bash
npm test            # unit tests
npm run test:e2e    # end-to-end tests against the echogpt_test database (docker compose up -d postgres)
npm run verify      # format check, lint, type-check, unit, e2e and build (the merge gate)
```

The e2e suite boots the real application pipeline, applies migrations to a dedicated `_test` database, truncates it and seeds it before running. Real AI providers are exercised against a local fake HTTP server, so no test calls an external API.

## Scripts

| Script                         | Purpose                                                     |
| ------------------------------ | ----------------------------------------------------------- |
| `start:dev` / `start:prod`     | Run with watch mode / run the compiled build                |
| `build`                        | Generate the Prisma client and compile to `dist/`           |
| `lint`, `typecheck`, `format`  | Static checks                                               |
| `test`, `test:e2e`, `test:cov` | Tests                                                       |
| `db:migrate`                   | Create and apply a migration (development)                  |
| `db:deploy`                    | Apply committed migrations (CI and production)              |
| `db:seed`                      | Idempotent seed                                             |
| `db:studio`                    | Prisma Studio                                               |
| `openapi:export`               | Write `docs/openapi.json`                                   |
| `postman:export`               | Regenerate the Postman collection from the OpenAPI document |

## Project structure

```
src/
├── main.ts, app.module.ts, app.setup.ts   # bootstrap and the shared HTTP pipeline
├── config/                                # env schema + typed config namespaces
├── common/                                # errors, filters, decorators, pipes, request context
├── infrastructure/                        # prisma, crypto, mail, logger, swagger
├── modules/<domain>/                      # controllers/ services/ repositories/ dto/ mappers/
└── cli/export-openapi.ts
prisma/          schema, migrations, seed
test/            e2e suites and helpers
docs/            openapi.json
postman/         Postman collection
```

## Git workflow

`master` holds releases, and `develop` integrates finished phases. Each phase was built on its own `feature/*` branch, merged with `--no-ff`, and kept. Commits follow Conventional Commits, enforced by commitlint, and lint-staged runs on every commit.

## License

MIT
