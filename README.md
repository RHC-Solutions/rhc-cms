# admin_panel — shared, embeddable CMS admin

A reusable Next.js (App Router) admin panel that drops into any RHC-Solutions
site as a **git submodule**. The admin runs *inside* the host site's process, so
it automatically uses that site's **theme, data, auth, and domain**. Update it
once here, pull it everywhere.

## Architecture

```
your-site/
├─ vendor/admin-panel/          ← this repo, as a git submodule
│   └─ src/{app,lib,components}  ← the real admin code (imports via @adminpanel/*)
├─ src/app/admin/**             ← thin AUTO-GENERATED re-export wrappers
├─ src/app/api/{admin,cms,auth} ← thin AUTO-GENERATED re-export wrappers
├─ middleware.ts                ← composes adminAuthGate() from the submodule
├─ cms-data/                    ← THIS site's own theme/pages/users/secrets
└─ tsconfig.json                ← maps @adminpanel/* → vendor/admin-panel/src/*
```

- **Per-site theme & data**: the admin reads/writes `./cms-data` in the host
  site (`theme.json`, `pages.json`, `users.json`, `secrets.json`, `cms.db`).
  Each site keeps its own — nothing is shared between sites.
- **In-process**: no separate service, no cross-app webhook; `revalidatePath`
  invalidates the host site's cache directly.
- **Collision-free imports**: all internal imports use `@adminpanel/*`, so they
  never clash with the host site's own `@/*`.

## Add to a new site

```bash
cd your-site
git submodule add https://github.com/RHC-Solutions/admin_panel.git vendor/admin-panel
node vendor/admin-panel/scripts/install-into-site.mjs   # generates route wrappers
```

Then follow the checklist the script prints: add the `@adminpanel/*` tsconfig
path, compose `adminAuthGate` in `middleware.ts`, install the listed deps
(`--print-deps`), and set `NEXTAUTH_SECRET` / `NEXTAUTH_URL` /
`NEXT_PUBLIC_SITE_URL` in `.env.local`. Build and you have `/admin`.

## Pull updates into every site

```bash
cd your-site
git submodule update --remote vendor/admin-panel
node vendor/admin-panel/scripts/install-into-site.mjs --force   # refresh wrappers if routes changed
npm run build
```

## Standalone (this repo)

This repo also builds on its own (`npm run build`) as a CI/dev sanity check —
`@adminpanel/*` maps to `./src/*` here. That standalone mode is only for
validating the module; in production the admin always runs embedded in a site.
