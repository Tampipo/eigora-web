<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
    <img alt="Eigora" src="assets/logo-light.svg" width="240">
  </picture>
</p>

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
app/[locale]/           — App Router pages, locale-prefixed
components/             — UI + simulation components
content/<locale>/qm/    — MDX course content
content/<locale>/legal/ — MDX legal pages (notice, privacy, credits)
i18n/                   — next-intl routing + request config
lib/api/                — orval-generated API client (do not edit by hand)
messages/               — UI strings (en.json, fr.json)
```

## Licensing

Two licences, deliberately:

- **Software** — AGPL-3.0-or-later ([LICENSE](LICENSE)). Since the site is a
  network service, section 13 requires the running version's source to be
  offered to its users; the footer link to this repository is what discharges
  that, so keep it.
- **Course material** — CC BY-SA 4.0 ([content/LICENSE](content/LICENSE)),
  covering `content/` and the animations under `public/videos/`.

The legal pages are ordinary MDX, so they are edited like any other content.
Their slugs live in [lib/legal-pages.ts](lib/legal-pages.ts), which drives the
route, the footer links and the sitemap at once; their titles and summaries
live under `legal.pages` in `messages/<locale>.json`.
