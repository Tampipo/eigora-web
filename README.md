# eigora-web

Next.js frontend for the Eigora platform.

## Quickstart (Docker)

```bash
cp .env.example .env.local
docker compose up --build
```

Open <http://localhost:3000> (you will be redirected to `/en`).

## Common tasks

```bash
# Generate the typed API client from the upstream OpenAPI schema
docker compose run --rm web npm run api:generate

# Type-check
docker compose run --rm web npm run typecheck

# Lint
docker compose run --rm web npm run lint

# Build the production image
docker build --target runner -t eigora-web:latest .
```

## Layout

```
app/[locale]/        — App Router pages, locale-prefixed
components/          — UI + simulation components
content/<locale>/qm/ — MDX course content
i18n/                — next-intl routing + request config
lib/api/             — orval-generated API client (do not edit by hand)
messages/            — UI strings (en.json, fr.json)
```
