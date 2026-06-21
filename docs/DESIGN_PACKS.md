# Design Packs

A **design pack** is a portable, versioned `.zip` that turns a freshly-installed admin
panel into a fully-designed site — theme, typography, cookie consent, starter pages,
menu, footer, and assets. It is the contract between a producer (**Claude Design**) and
the consumer (**this panel**). A pack carries *design and templated content only* — never
secrets, users, analytics IDs, or real site identity (those are collected by the setup
wizard and filled into `{{token}}` placeholders).

This is the "WordPress theme + starter content" of the Node/Next platform.

## Two pack types

The `apply` endpoint auto-detects which kind of pack it received:

1. **CMS-block pack** — has a `pack.json` manifest; decomposed into the panel's block
   model (theme + typography + pages-as-blocks + menu/footer). Editable block-by-block.
   This is the format the rest of this doc specifies, plus the exporter.

2. **Static-site pack** — **no `pack.json`**, just finished `.html` pages + a shared
   `assets/` folder (e.g. `styles.css`, `site.js`). This is what an HTML-first designer
   ("Claude Design") emits. Each page is ingested as a managed CMS page holding a single
   `staticpage` block with the page's **full, path-rewritten HTML**, and is **served
   verbatim** — its own `<head>`, nav/footer, inline `<style>`/`<script>`, and external
   `site.js` run natively, so the design is pixel-perfect and interactivity works.
   - Slugs: `index.html` → `/`, `big-data.html` → `/big-data`, …
   - Assets are copied to `public/uploads/pack-<slug>/` and references rewritten
     (`assets/x` → `/uploads/pack-<slug>/x`); internal `.html` links → clean routes.
   - The top `<nav>` is parsed into `settings.navigation`.
   - **Trust:** static packs execute their own JS — apply them only from a trusted
     source (the Claude Design pipeline; admin or first-run only). `extract.ts` still
     rejects `secrets.json`/`users.json`/`.env`/`cms.db`.
   - **Served verbatim** by a route handler. In the panel itself: `/pack-preview/<slug>`.
     On a host whose public site IS the pack: run
     `node vendor/admin-panel/scripts/install-into-site.mjs --static-site` to scaffold a
     root catch-all (`app/[[...slug]]/route.ts`) that serves ingested pages at clean
     routes (`/`, `/big-data`, …); `/admin` + `/api/*` resolve first, unknown slugs 404.
     (Skip `--static-site` on hosts that have their own Next public pages — it would
     shadow them.) Editing = re-apply a pack.

The sections below describe the **CMS-block** format.

## Lifecycle

1. **Claude Design** generates a pack conforming to this spec (or export an existing
   site: `GET /api/cms/design-pack/export`).
2. **Install** the panel on a fresh site (`admin-panel init`).
3. **Apply** the pack — in the setup wizard's first step (upload), or later via
   `POST /api/cms/design-pack/apply` (admin).
4. **Configure** identity/secrets in the wizard + admin (domain, API keys…).
5. **Fine-tune** in the CMS editor.

## Pack layout

```
pack.json                 # manifest (required) — see scripts/design-pack/pack.schema.json
theme.json                # → cms-data/theme.json        (deep-merged per section)
typography.json           # → cms-data/typography.json    (overwrite)
cookies.json              # → cms-data/cookies.json       (overwrite)
settings.design.json      # design-only settings subset   (deep-merged; identity keys dropped)
menu.json                 # { "navigation": [...] }       → settings.navigation
footer.json               # { customFooter, socialLinks } → settings.customFooter / settings.footer
pages/<slug>.json         # one CMSPage per file (no timestamps)
assets/uploads/*          # images/fonts → public/uploads (copied if absent)
```

Everything except `pack.json` is optional — include only what the pack provides.

## Manifest (`pack.json`)

```json
{
  "packFormat": 1,
  "name": "Acme Inc",
  "slug": "acme-inc",
  "version": "1.0.0",
  "description": "…",
  "author": "Claude Design",
  "minPanelVersion": "1.0.0",
  "contents": { "theme": "merge", "typography": "overwrite", "pages": "upsert-by-slug", "assets": "copy-if-absent" },
  "tokens": ["siteName", "tagline", "contactEmail", "domain"]
}
```

`packFormat` is the spec version — the panel **rejects** a pack whose `packFormat` is
newer than it supports. Apply modes: `merge`, `overwrite`, `merge-design-keys`,
`upsert-by-slug`, `copy-if-absent`.

## Rules

- **No secrets / identity / analytics.** A pack must not contain `secrets.json`,
  `users.json`, `seo.json`, `cms.db*`, `.env*`, or submission/lead data — the importer
  **hard-rejects** any pack containing these. `settings.design.json` may carry only design
  keys (`brand`, `homeContent`, `contactContent`, `cta`, `ctaSection`); other keys (real
  `siteName`, `contact`, `bookingUrl`, `stats`, `analytics`…) are **dropped on import**.
- **Token interpolation.** Any string may contain `{{siteName}}`, `{{tagline}}`,
  `{{contactEmail}}`, `{{domain}}`; the wizard's values are substituted on apply.
- **Blocks.** Page blocks are `{ id, type, props, order }` where `props` is an **object**
  (`{ "text": "…", "level": 1 }`), never a bare string.
- **Pages upsert by slug** — an existing slug is updated, a new slug is created.
- **Path safety.** Every zip entry is validated (no `..`, no absolute paths) before
  extraction.

## Apply semantics

| Part | Mode | Notes |
|---|---|---|
| theme | deep-merge per section (colors/fonts/sizes/branding) | preserves keys not in the pack |
| typography / cookies | overwrite | whole-file replace |
| settings.design | deep-merge, design keys only | identity keys ignored |
| menu | replace `settings.navigation` | |
| footer | replace `customFooter` / merge `socialLinks` | |
| pages | upsert by slug, via `cmsDb` | survives the SQLite→Postgres abstraction |
| assets | copy if absent + index | won't clobber existing uploads |

Before an **admin re-apply** to an existing site, a full backup is taken automatically
(restore from `cms-data/backups/`). First-run applies skip the backup (nothing to lose).

## Producing & validating a pack

- **Export the current site** as a starter template (strips identity/secrets):
  `GET /api/cms/design-pack/export?name=My%20Template`
- **Validate** any pack directory before zipping:
  `node scripts/design-pack/validate-pack.mjs path/to/pack`
- **Schema:** `scripts/design-pack/pack.schema.json` — the authoritative shape; no example pack is bundled (this repo is the consumer, not a pack store).

## Applying a pack

- **Setup wizard (fresh site):** first step — upload the `.zip`, fill identity fields,
  Apply. Runs while no admin exists yet (the only sound first-run auth signal).
- **Admin (existing site):** `POST /api/cms/design-pack/apply` (admin session) with a
  multipart `pack` file, or JSON `{ "url": "https://…", "tokens": { … } }`.
- **CLI:** `npx github:RHC-Solutions/admin_panel apply-pack <zip|https-url> --site-url <url> --tokens '{…}'`
  — posts to the running site's apply API (file upload works during first-run; a remote
  URL pack requires admin login). Makes design → install → apply scriptable.

## Out of scope (today)

The Claude Design generator itself, the SQLite→Postgres data-layer abstraction (the
importer is already written against `cmsDb` so it survives it), and the broader
provisioning wizard (DNS, Brevo/Cloudflare keys) beyond the four identity tokens.
