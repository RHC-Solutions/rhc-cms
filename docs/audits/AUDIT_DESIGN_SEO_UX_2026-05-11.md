# Design / SEO / UX / Performance Audit — rhcsolutions.com

**Date:** 2026-05-11
**Scope:** Code-only audit covering UI/UX, visual design, SEO, accessibility (WCAG 2.1 AA), and performance/code-quality.
**Out of scope:** Security & dependency vulnerabilities (covered in [QA_AUDIT_2026-04-21.md](QA_AUDIT_2026-04-21.md) — do not duplicate that work here).
**Limitation:** Live-site fetch (`https://rhcsolutions.com`) was blocked by the workspace network policy. Findings are based on source-code review only. Items marked **\[verify-live]** should be re-checked against the rendered production page.

---

## Executive summary

The codebase builds, but **the visual design system is broken**: every component references Tailwind color classes (`bg-cyber-blue`, `text-cyber-green`, etc.) that don't exist in the project's theme. The theme defines `--color-neon-*`; the components call `cyber-*`. The site is almost certainly rendering without most of its branded accent colors, gradients, and hover states.

On top of that, the client-side `ThemeProvider` blocks the **entire page** behind a "Loading…" screen until a runtime fetch completes — a serious LCP, CLS, and SEO hit. There are also two visible Footer typos, a missing OG image, no structured data, and a dark-themed homepage that drops into a hardcoded light-theme `ServicesOverview` component (dead code, but a landmine).

Priority order for the fixes is at the end. The first three Critical items would each be a worthwhile half-day of work and would visibly improve the site for every visitor.

| Category | Severity | Count |
|---|---|---|
| Critical | 🔴 | 4 |
| High | 🟠 | 7 |
| Medium | 🟡 | 9 |
| Low | 🟢 | 6 |

---

## 🔴 CRITICAL findings

### C1. Tailwind color tokens are broken site-wide — `cyber-*` classes don't exist

**Files:** 30 files, 353 occurrences. Sample: [src/components/layout/Header.tsx](../src/components/layout/Header.tsx), [src/components/home/Hero.tsx](../src/components/home/Hero.tsx), [src/components/home/AboutPreview.tsx](../src/components/home/AboutPreview.tsx), [src/components/home/CTASection.tsx](../src/components/home/CTASection.tsx), [src/components/home/ClientsTeaser.tsx](../src/components/home/ClientsTeaser.tsx), [src/components/layout/Footer.tsx](../src/components/layout/Footer.tsx), [src/components/cms/BlockRenderer.tsx](../src/components/cms/BlockRenderer.tsx), [src/components/CookieConsent.tsx](../src/components/CookieConsent.tsx), [src/components/ContactForm.tsx](../src/components/ContactForm.tsx), [src/app/not-found.tsx](../src/app/not-found.tsx).

The theme in [src/app/globals.css](../src/app/globals.css) defines:

```css
@theme {
  --color-neon-green: var(--color-neon-green);
  --color-neon-cyan:  var(--color-neon-cyan);
  --color-neon-blue:  var(--color-neon-blue);
  --color-neon-purple: var(--color-neon-purple);
  --color-neon-red:   var(--color-neon-red);
  ...
}
```

In Tailwind v4, those tokens make `bg-neon-green`, `text-neon-cyan` etc. valid utilities. **They do not make `bg-cyber-green` or `text-cyber-blue` valid** — those classes have no underlying CSS variable, so Tailwind generates nothing and they apply nothing.

I confirmed:
- `--color-cyber-*` is defined **0 times** in the entire repo.
- `cyber-(blue|cyan|green|purple|red|amber)` appears in source files **0 times** in `*.css`, `*.mjs`, `*.json` (only inside JS-string literals in [src/lib/auth/password.ts](../src/lib/auth/password.ts) which are class names, not definitions).
- The only explicitly written rule using `cyber-*` is `.bg-cyber-grid` (one-off, hand-written, references `--color-neon-green`).
- The runtime `ThemeProvider` sets `--color-neon-*` variables on `:root` — confirming the *intended* token namespace is `neon-*`, not `cyber-*`.

**Symptom on the live site \[verify-live]:** all neon accent colors, gradient text on hover, glow shadows that key off these colors, the dropdown highlight `bg-linear-to-r from-cyber-blue to-cyber-cyan`, the cookie banner border, the hero "since_1994" badge, etc. — none of these will paint. The site renders mostly grayscale on dark.

**Fix:** Pick one. *Recommended* is option B because it changes one file instead of thirty.

- **A. Rename usages.** Replace every `cyber-blue` → `neon-blue`, `cyber-cyan` → `neon-cyan`, `cyber-green` → `neon-green`, `cyber-purple` → `neon-purple`, `cyber-red` → `neon-red`, `bg-cyber-grid` keeps its hand-written rule. Sed-friendly. Then re-test.
- **B. Add `cyber-*` aliases in `@theme`.** Lower-effort. Add to [src/app/globals.css](../src/app/globals.css):
  ```css
  @theme {
    --color-cyber-green: var(--color-neon-green);
    --color-cyber-cyan: var(--color-neon-cyan);
    --color-cyber-blue: var(--color-neon-blue);
    --color-cyber-purple: var(--color-neon-purple);
    --color-cyber-red: var(--color-neon-red);
    --color-cyber-amber: var(--color-neon-amber);
  }
  ```
  Also add equivalent aliases to the `ThemeProvider` runtime overrides so admin-changed colors propagate.

Either way, also drop the additional missing tokens used in [src/components/home/Hero.tsx](../src/components/home/Hero.tsx) (`bg-gradient-cyber`, `bg-noise`, `bg-gradient-accent`, `text-accent`) — these are never defined either.

---

### C2. `ThemeProvider` blocks the entire page behind a client-side "Loading…" screen

**File:** [src/components/ThemeProvider.tsx](../src/components/ThemeProvider.tsx), lines 64–70.

```tsx
if (!themeLoaded) {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="text-text-primary">Loading...</div>
    </div>
  );
}
```

ThemeProvider wraps every public page (via `LayoutWrapper` in `layout.tsx`). On every navigation, it returns this full-page placeholder until a client-side `fetch('/api/cms/theme')` resolves. Consequences:

- **LCP regression.** Largest Contentful Paint becomes "the Loading… text" until the API responds — never your hero.
- **CLS regression.** When theme loads, every section pops in at once.
- **SEO impact \[verify-live].** Server-rendered HTML still contains the real content (so crawlers fetching the HTML will see it), but real-user metrics that Google uses for ranking (CWV field data) will be poor.
- **Visible flicker on every navigation**, including in-app `<Link>` traversals — the user sees "Loading…" between every page.

Additionally, [src/app/layout.tsx](../src/app/layout.tsx) **already loads the theme server-side** (`getTheme()` at line 97) but doesn't pass it to `ThemeProvider` — so the client fetch is redundant.

**Fix:**
1. Pass the SSR-loaded theme as a prop into `ThemeProvider` (or apply theme as inline `style` on `<html>` server-side and let the client never re-fetch).
2. Drop the blocking "Loading…" gate entirely — render children immediately; theme variables can update mid-paint without unmounting the tree.
3. If a runtime API refetch is genuinely needed (e.g. admin live-preview), gate it behind a feature flag, not the public site.

---

### C3. Footer Telegram/WhatsApp link text is wrong — shows the phone number instead

**File:** [src/components/layout/Footer.tsx](../src/components/layout/Footer.tsx), lines 218 and 226.

```tsx
{contactSection.telegram && (
  <li ...>
    <a href={`https://t.me/${contactSection.telegram}`} ...>
      {contactSection.phone}   {/* BUG — should be contactSection.telegram */}
    </a>
  </li>
)}
{contactSection.whatsapp && (
  <li ...>
    <a href={`https://wa.me/${contactSection.whatsapp}`} ...>
      {contactSection.phone}   {/* BUG — should be contactSection.whatsapp */}
    </a>
  </li>
)}
```

The `href` is correct, but the visible text on both Telegram and WhatsApp items renders the phone number, so visitors see the same phone string three times (Phone / Telegram / WhatsApp).

**Fix:** Use `contactSection.telegram` and `contactSection.whatsapp` for display text — or a friendlier label like the user handle / "Message on WhatsApp".

---

### C4. `og-image.jpg` is referenced in metadata but doesn't exist in `public/`

**File:** [src/app/layout.tsx](../src/app/layout.tsx) lines 46 and 57.

```tsx
images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "RHC Solutions" }]
```

Listing `public/`:
```
2mmg7hgrcabgqufv77m5c2sxwjmpwusu.txt
googlec359226e3da4fb58.html
llms.txt
logo.png
robots.txt
sitemap.xml
uploads/
```

→ No `og-image.jpg`. **Every link share on LinkedIn, X/Twitter, Slack, iMessage, WhatsApp gets a broken-image preview.**

**Fix:** Create a 1200×630 OG image (your tagline "We Just Do IT" over the cyber-grid look would be on-brand), save to `public/og-image.jpg`, verify with `https://www.opengraph.xyz/url/https%3A%2F%2Frhcsolutions.com`. Same applies to the Twitter card image (line 57 — same path).

---

## 🟠 HIGH findings

### H1. No JSON-LD structured data anywhere

For an IT services / B2B consulting site, the missing rich-result types are:

- `Organization` (top-level — name, logo, sameAs to social profiles, contact point)
- `WebSite` with `SearchAction` if you add site search
- `BreadcrumbList` on every non-home page
- `Service` per service page (`/services/cyber-security`, etc.)
- `JobPosting` on `/careers/[id]` (the jobs CMS data is already in [cms-data/jobs.json](../cms-data/jobs.json)) — this is *free* SEO if you wire it up; Google has a dedicated jobs search panel.
- `ContactPage` schema for `/contact`

None of these exist anywhere in the source. Adding them is a 1–2 day investment that materially improves how Google renders your listings.

**Fix:** Add a `<JsonLd>` helper component and render `<script type="application/ld+json">` blocks server-side per page type. Keep the source-of-truth fields in `cms-data/settings.json` so they stay consistent with the visible content.

---

### H2. No canonical URLs on any page

[src/lib/cms/page-renderer.tsx](../src/lib/cms/page-renderer.tsx) `buildPageMetadata` returns `title`, `description`, `keywords`, `openGraph` — but **no `alternates.canonical`**. The root `layout.tsx` has `metadataBase` but doesn't set a canonical either.

Effect: any URL variant (trailing slash, tracking parameters, www vs non-www) becomes a duplicate from Google's perspective, splitting link equity.

**Fix in `page-renderer.tsx`:**
```ts
return {
  title, description, keywords,
  alternates: { canonical: page.slug === '/' ? '/' : page.slug },
  openGraph: { title, description, url: page.slug, type: 'website' },
};
```

Also add `alternates: { canonical: '/' }` in `layout.tsx` for the homepage.

---

### H3. Service pages have no per-page OG image, no Twitter card

`buildPageMetadata` only emits `openGraph: { title, description, url, type }`. No image, no Twitter object, no `siteName`. Every service page falls back to the layout's (broken) `/og-image.jpg`.

**Fix:** Either (a) accept a `seo.ogImage` field in `cms-data/pages.json` per page and emit it, or (b) auto-generate per-page OG images via Next's [`opengraph-image.tsx`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) convention. Option (b) is cheap because you already render `apple-icon.tsx` and `icon.tsx` that way (see [src/app/apple-icon.tsx](../src/app/apple-icon.tsx)).

---

### H4. Header & Footer fetch theme/settings client-side on every page load

**Files:** [src/components/layout/Header.tsx](../src/components/layout/Header.tsx) lines 68–114, [src/components/layout/Footer.tsx](../src/components/layout/Footer.tsx) lines 49–121.

Both run *three to four* `fetch()` calls in a `useEffect` on every navigation:
- Header: `/api/cms/settings` + `/api/cms/theme`
- Footer: `/api/cms/settings` + `/api/cms/footer` + `/api/cms/theme` + `/api/cms/pages`

Consequences:
1. Header initial render shows defaulted menu items, then re-renders when API responds → layout shift & flicker.
2. The footer logo + nav don't appear until 1–4 API calls finish on every page.
3. Each page navigation re-runs these calls (no SWR cache, no client-side memoization).
4. Combined with C2 (ThemeProvider Loading screen), the user sees an empty page → "Loading…" → flicker → final render. Probably 1–3s of staring at blank/blank-ish chrome.

**Fix:** Load `settings`, `theme`, `footer`, and the pages list **server-side** in the root layout (you already do this for `theme` and `seo`). Pass them down via React context or a server-side provider. Header/Footer become pure server components except for the open/close state.

---

### H5. Two dead "design system" components shadowing live ones — they reference broken/wrong classes

**Files:**
- [src/components/home/Hero.tsx](../src/components/home/Hero.tsx) — not imported anywhere; homepage renders the `hero` CMS block via `BlockRenderer`.
- [src/components/home/ServicesOverview.tsx](../src/components/home/ServicesOverview.tsx) — not imported anywhere; homepage renders the `servicescarousel` block instead.

`grep` for `from '@/components/home/Hero'` / `from '@/components/home/ServicesOverview'` → 0 matches.

These files matter because:
- They look authoritative ("home/Hero.tsx"), so the next person editing the homepage will edit the wrong file.
- `ServicesOverview.tsx` is **white-themed** (`bg-gray-50`, `bg-white`, `text-gray-600`, `text-primary`) on what is otherwise a dark site — if it were ever pulled in, it would create a jarring white slab in the middle of the page.
- Both rely on the broken `cyber-*` / `text-accent` / `text-primary` classes.

**Fix:** Delete both, *or* repurpose them as non-CMS fallback components and import them. Either way, end the ambiguity.

---

### H6. Dropdown navigation menu is keyboard-inaccessible

**File:** [src/components/layout/Header.tsx](../src/components/layout/Header.tsx) lines 185–201.

The Services submenu is shown only via CSS `:hover` (`opacity-0 invisible group-hover:opacity-100`). There is no focus handling, no `aria-expanded`, no `aria-controls`, and tabbing past the "Services" link skips straight to the next top-level item.

**Fix:** Convert to a controlled menu with `onFocus`/`onBlur`/`onKeyDown` handlers, an `aria-haspopup="true"` and a state-bound `aria-expanded`. The mobile version (lines 248–273) is already a real button — apply the same pattern desktop-side.

---

### H7. CMS-rendered `<img>` blocks have no error handling and use raw `<img>` not `next/image`

**File:** [src/components/cms/BlockRenderer.tsx](../src/components/cms/BlockRenderer.tsx) lines 339–347 (block `image`).

```tsx
<img src={src} alt={altText} loading="lazy" width="1200" height="675" ... />
```

Problems:
- Raw `<img>` skips `next/image` optimization (AVIF/WebP serving, automatic responsive `srcset`, lazy below-the-fold logic that respects intersection observers).
- Fixed `1200×675` dimensions regardless of source.
- `alt` is `getText(props?.alt ?? props?.caption ?? '')` — defaults to empty string. WCAG 1.1.1 needs either a real alt **or** `alt=""` with `role="presentation"` for purely decorative images, not a silent fallback.

**Fix:** Use `<Image>` from `next/image` (whitelist your CMS upload origin in `next.config.mjs`), require a non-empty `alt` field in the CMS, and add a `decorative: boolean` field that maps to `alt=""` + `aria-hidden`.

---

## 🟡 MEDIUM findings

### M1. Sitemap.ts is force-dynamic and conflicts with `public/sitemap.xml`

[src/app/sitemap.ts](../src/app/sitemap.ts) exports `export const dynamic = 'force-dynamic'` — regenerated on every request, no caching. Meanwhile a hand-written [public/sitemap.xml](../public/sitemap.xml) is committed to the repo. In Next 16, the dynamic route wins at `/sitemap.xml`, so the static file is dead weight that misleads anyone reading the repo.

The dynamic one is also **incomplete**: it filters to CMS pages only, so anything not tracked in `pages.json` (custom routes like `/careers/global-team`, anything you add via filesystem) is silently dropped.

**Fix:**
- Decide on a strategy and stick to it. Recommended: keep the dynamic sitemap, but switch to `revalidate: 3600` instead of `force-dynamic`, and unify the list by walking `src/app` *and* CMS pages.
- Delete the stale `public/sitemap.xml`.

### M2. `public/robots.txt` and `src/app/robots.ts` both exist

[public/robots.txt](../public/robots.txt) is the older, hand-written one; [src/app/robots.ts](../src/app/robots.ts) is the Next.js generator. They look equivalent today, but two sources of truth means they'll drift. Keep one.

### M3. Homepage uses `<html lang="en">` — good, but the CMS-rendered hero overrides body font

[src/components/cms/BlockRenderer.tsx](../src/components/cms/BlockRenderer.tsx) `HeroBlock` (lines 70–116) hard-codes `style={{ fontFamily: '"Courier New", Courier, monospace' }}` on every heading and paragraph. Same for the rich-text block (line 448 sets Inter). This bypasses the design system fonts you imported in [src/app/layout.tsx](../src/app/layout.tsx) (`Space_Grotesk`, `JetBrains_Mono`) and means the CMS hero looks unlike the rest of the typographic system. Also `green-on-dark Courier New` is dated and reads as Matrix-cliché.

**Fix:** Remove the inline `fontFamily` and let the cascaded `font-grotesk`/`font-mono` Tailwind classes do the work. Pin to the theme tokens.

### M4. Stats are duplicated and inconsistent across components

- `Hero.tsx`: 500+ projects, 15+ industries, 98% satisfaction, 24/7 support.
- `AboutPreview.tsx`: 1994, 500+, 15+, 98%.
- `CTASection.tsx`: 30+ Years, 500+ Projects, 98% Client Sat.

Three components, three slightly different stat sets. Different copy will get out of sync the next time numbers are updated. Move to a single CMS-managed list (e.g. `cms-data/settings.json -> companyStats`).

### M5. Color contrast — `text-text-muted` on dark cards likely fails AA

CSS variables in [globals.css](../src/app/globals.css):

| Foreground | Background | Hex pair | Approx ratio | WCAG AA |
|---|---|---|---|---|
| `--color-text-muted` (#6B7B8C) | `--color-dark` (#0A0E27) | gray-on-near-black | ~4.0:1 | ❌ fails for body |
| `--color-text-muted` (#6B7B8C) | `--color-dark-card` (#151B2F) | gray-on-dark | ~3.8:1 | ❌ fails for body |
| `--color-text-secondary` (#8892A6) | `--color-dark` (#0A0E27) | dim-gray-on-black | ~5.6:1 | ✅ |
| `--color-text-primary` (#E8E8E8) | `--color-dark` (#0A0E27) | near-white | ~14:1 | ✅ |

Approximate values; **\[verify-live]** with a real contrast checker. `text-text-muted` is used for stat labels, scroll indicator, copyright, "QUICK LINKS" header, and helper text in the contact form. Bump the muted color to `#9BA8BB` or similar.

### M6. Hero scroll indicator uses a non-keyboard-accessible `<div onClick>`

[src/components/home/Hero.tsx](../src/components/home/Hero.tsx) lines 107–117 — `<div onClick>` with `cursor-pointer` is not a button, not in the tab order, no `role`, no keyboard handler.

(This file is dead code today (see H5), but if you keep it, fix this — and the same pattern exists implicitly in other places.) Use a `<button>` with `aria-label="Scroll to next section"`.

### M7. `apply` and `contact` form labels are uppercased visually but exposed to screen readers as ALL CAPS

[src/components/ContactForm.tsx](../src/components/ContactForm.tsx) labels are literal strings like `NAME *`, `EMAIL *`. Screen readers announce these as "N. A. M. E. star" or similar letter-by-letter. The fix is to lowercase the literal text and use `text-transform: uppercase` CSS so the visual style is preserved but assistive tech receives "Name required".

```tsx
// Before:
<label htmlFor="name">NAME *</label>
// After:
<label htmlFor="name" className="uppercase">Name <span aria-hidden="true">*</span><span className="sr-only"> required</span></label>
```

### M8. `next.config.mjs` carries a `webpack:` block while Turbopack is enabled

[next.config.mjs](../next.config.mjs) lines 7 (`turbopack: {}`) and 44–61 (custom webpack rules: `framer-motion` alias + tree-shaking flags).

Turbopack is the default builder in Next 16, so the webpack block is silently inert. The `framer-motion/dist/framer-motion` alias and the `optimization.usedExports/sideEffects` overrides are **doing nothing**, even though they read like meaningful perf tuning. Either move the configuration to `turbopack.resolveAlias` (it has different syntax) or delete the webpack block to stop misleading future readers. Same goes for the `experimental.serverComponentsHmrCache` flag flagged in the prior audit.

### M9. Animations don't respect `prefers-reduced-motion`

Heavy framer-motion usage throughout the home blocks (`Hero`, `AboutPreview`, `CTASection`, `ClientsTeaser`, `not-found.tsx`) plus CSS `animate-*` keyframes. None of this is gated on `@media (prefers-reduced-motion: reduce)`. WCAG 2.3.3.

**Fix:** Add a global utility:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```
And/or wrap framer-motion props in `useReducedMotion()` checks.

---

## 🟢 LOW findings

### L1. `BOOKING_URL` is hardcoded in three places

Same Outlook bookwithme URL in [Hero.tsx](../src/components/home/Hero.tsx#L7), [Header.tsx](../src/components/layout/Header.tsx#L34), [CTASection.tsx](../src/components/home/CTASection.tsx#L7). Move to `cms-data/settings.json` so admins can change it without a deploy.

### L2. CookieConsent close button has no `aria-label`

[src/components/CookieConsent.tsx](../src/components/CookieConsent.tsx) line 138 — `<button onClick={acceptNecessaryOnly}><FaTimes /></button>`. Icon-only button needs an accessible name. Add `aria-label="Reject non-essential cookies"`.

### L3. Mobile menu button missing `aria-expanded`

[src/components/layout/Header.tsx](../src/components/layout/Header.tsx) line 231. Has `aria-label="Toggle menu"` but no `aria-expanded={isMobileMenuOpen}`. Screen-reader users can't tell whether the menu is open.

### L4. `not-found.tsx` "Go Back" button has no aria-label and uses `window.history.back()` without a fallback

[src/app/not-found.tsx](../src/app/not-found.tsx) lines 122–128. If the user landed on the 404 directly (e.g. clicked a stale Google link), `window.history.back()` exits the site. Add a fallback `router.push('/')` if `window.history.length <= 1`.

### L5. Sitemap lastmod values are stale (2025-12-30/31, 2026-01-03/04)

[public/sitemap.xml](../public/sitemap.xml) was last generated months ago and is shipped as static. Either delete it (per M1) or regenerate before release.

### L6. `llms.txt` is good but missing `## Contact` and a one-line description per page

[public/llms.txt](../public/llms.txt) gives bots the URLs but no context. Add one-line summaries per primary page so AI search results have something concrete to extract.

---

## What this audit did NOT cover

These would need either live-site access or a longer engagement:

- **Live Lighthouse / CWV scores** — requires fetching `https://rhcsolutions.com` which the workspace network policy blocked.
- **axe-core or Lighthouse a11y run on rendered HTML** — limited to source-code patterns here.
- **Real-device responsive testing** — code review suggests mobile breakpoints exist (lg: prefixes everywhere) but didn't render to verify behavior.
- **Form submission flows end-to-end** (contact, careers apply) — only static reading.
- **Image-asset audit** — no rendered preview to check whether images are appropriate weight and format.
- **Security & dependency vulns** — covered in [QA_AUDIT_2026-04-21.md](QA_AUDIT_2026-04-21.md); do not redo there.

---

## Prioritized fix list

Order by impact-per-hour. Items in **bold** are visible-to-user, the rest are technical.

1. **C1 — Add `cyber-*` color aliases in `globals.css` (or rename usages).** Half-day. Without this, the site has no accent colors. This is the highest-leverage single fix in the audit.
2. **C2 — Pass SSR theme into `ThemeProvider` and remove the "Loading…" gate.** 2–3 hours. Improves LCP, removes the flicker, removes a redundant API call per nav.
3. **C3 — Fix Footer Telegram/WhatsApp text typos.** 5 minutes. Visible to every visitor.
4. **C4 — Add `/og-image.jpg` (1200×630).** 30 minutes including design. Every social share is broken without it.
5. H1 — Add `Organization` + `BreadcrumbList` JSON-LD; add `JobPosting` on careers. Half-day.
6. H2/H3 — Canonical URLs + per-page OG images. Half-day.
7. H4 — Move Header/Footer data loading to server-side. Half to full day.
8. H5 — Delete (or wire up) dead `Hero.tsx` and `ServicesOverview.tsx`. 15 minutes.
9. H6 — Make the desktop dropdown keyboard-accessible. 1–2 hours.
10. H7 — Replace raw `<img>` in `BlockRenderer.tsx` with `next/image`. 2 hours including config.
11. M1/M2/L5 — Resolve the sitemap/robots duplication, drop the stale static files. 30 minutes.
12. M3/M4 — Remove inline fonts in `HeroBlock`/`richtext`; consolidate stats into one CMS source. 2 hours.
13. M5 — Bump `--color-text-muted` to a higher-contrast value. **\[verify-live with axe before/after]**. 30 minutes.
14. M7 — Lowercase form labels; use CSS for visual uppercase. 1 hour.
15. M9 — Add `prefers-reduced-motion` global rule and `useReducedMotion()` in framer-motion clients. 2 hours.
16. M8/L1/L2/L3/L4/L6 — Cleanup pass. Half-day in total.

A focused two-day sprint can clear the entire Critical + High block. The rest is steady follow-up work.

---

*Generated 2026-05-11 by automated code review. Re-run when the Critical items are addressed; the M5 contrast and any "\[verify-live]" items need a live-site or staging fetch to confirm.*
