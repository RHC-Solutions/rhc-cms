# Design Packs

A **design pack** is a portable, versioned `.zip` that turns a freshly-installed admin
panel into a fully-designed site — theme, typography, cookie consent, starter pages,
menu, footer, and assets. It is the contract between a producer (**Claude Design**) and
the consumer (**this panel**). A pack carries *design and templated content only* — never
secrets, users, analytics IDs, or real site identity (those are collected by the setup
wizard and filled into `{{token}}` placeholders).

This is the "WordPress theme + starter content" of the Node/Next platform.

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
  "name": "BigData CyberCloud",
  "slug": "bigdata-cybercloud",
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
- **Schema:** `scripts/design-pack/pack.schema.json`
- **Reference pack:** `examples/design-packs/starter/`

## Applying a pack

- **Setup wizard (fresh site):** first step — upload the `.zip`, fill identity fields,
  Apply. Runs while no admin exists yet (the only sound first-run auth signal).
- **Admin (existing site):** `POST /api/cms/design-pack/apply` (admin session) with a
  multipart `pack` file, or JSON `{ "url": "https://…", "tokens": { … } }`.

## Out of scope (today)

The Claude Design generator itself, the SQLite→Postgres data-layer abstraction (the
importer is already written against `cmsDb` so it survives it), and the broader
provisioning wizard (DNS, Brevo/Cloudflare keys) beyond the four identity tokens.
