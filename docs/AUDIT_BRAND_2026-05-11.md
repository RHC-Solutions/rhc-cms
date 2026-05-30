# Brand Consistency Audit — rhcsolutions.com

**Date:** 2026-05-11
**Scope:** How does the brand present itself? Visual identity (logo, colors, typography), voice & tone, value-prop wording, CTA labels, iconography, single-source-of-truth discipline.
**Companion docs:** [AUDIT_DESIGN_SEO_UX_2026-05-11.md](AUDIT_DESIGN_SEO_UX_2026-05-11.md) covers the broader design/SEO/UX/perf audit; [QA_AUDIT_2026-04-21.md](QA_AUDIT_2026-04-21.md) covers security/build. This doc only adds *brand* findings.

---

## TL;DR

You don't have one brand — you have three living in the same repo, fighting for control.

- **Brand A: Cyberpunk / Matrix / hacker.** Neon green on near-black, JetBrains Mono, `> We Just Do IT`, `since_1994`, `ERROR_CODE: HTTP_404_NOT_FOUND`. This is what the hand-built homepage hero, the header, the 404 page, and the favicon want to be.
- **Brand B: Google Material.** The active CMS theme is literally named `"Google Dark"` and uses Google's exact corporate palette (#4285F4 blue, #34A853 green, #FBBC05 amber, #EA4335 red) with Roboto as the body font. This is what `ThemeProvider` injects at runtime, *overriding* the cyberpunk tokens.
- **Brand C: Generic enterprise consultancy.** The CMS-rendered service pages and the AboutPreview component speak in corporate B2B SaaS voice — "strategic technology implementation", "executive-grade delivery", "transformative IT solutions" — and decorate themselves with emoji icons (📋 💡 ⚡ 🎯 📬 💬) like a Notion page.

Every visitor sees a mash-up of the three. The cyberpunk hero loads with Roboto body text from the Google theme; the contact form is in Material UI–style Roboto on top of cyberpunk-themed dark cards; the CMS service pages stick emojis next to FontAwesome icons. None of this is intentional. It's accumulated drift, and it makes the site look like three different agencies built it in three different quarters.

There are also **6+ separate sources of truth for the tagline and "Since 1994" line**, **3 different logo files** referenced in different configs (one of which is 222 KB), **15+ different CTA labels** for essentially one action ("talk to us"), and **5 different declarations of the monospace font** — one of which is "Inter" (a sans-serif).

This audit is unusually fixable: most findings consolidate to "delete N copies, point at the one source." A focused day of work would meaningfully tighten the brand.

| Category | Severity | Count |
|---|---|---|
| Critical | 🔴 | 3 |
| High | 🟠 | 6 |
| Medium | 🟡 | 5 |
| Low | 🟢 | 4 |

---

## 🔴 CRITICAL

### B1. The runtime CMS theme is "Google Dark" — Google's literal brand colors — applied to a cyberpunk-designed site

**Evidence:** [cms-data/theme.json](../cms-data/theme.json) lines 2–13:

```json
{
  "name": "Google Dark",
  "colors": {
    "primary":   "#4285F4",   // Google Blue
    "secondary": "#34A853",   // Google Green
    "accent":    "#FBBC05",   // Google Yellow
    "error":     "#EA4335",   // Google Red
    "info":      "#4285F4",
    "background":"#121212"    // Material dark
  },
  ...
}
```

These are Google's published brand colors. `ThemeProvider` ([src/components/ThemeProvider.tsx](../src/components/ThemeProvider.tsx) lines 21–29) then *remaps them onto the neon-* slots*:

```ts
root.style.setProperty('--color-neon-green', theme.colors.primary);    // neon-green becomes #4285F4 (BLUE)
root.style.setProperty('--color-neon-cyan',  theme.colors.secondary);  // neon-cyan becomes  #34A853 (GREEN)
root.style.setProperty('--color-neon-blue',  theme.colors.accent);     // neon-blue becomes  #FBBC05 (YELLOW)
root.style.setProperty('--color-neon-red',   theme.colors.error);      //                    #EA4335
root.style.setProperty('--color-neon-amber', theme.colors.warning);
root.style.setProperty('--color-neon-purple',theme.colors.info);       // neon-purple becomes Google blue
```

So at runtime: every `border-neon-green` (every card border), every `from-neon-green` gradient, every glow keyed off `--color-neon-green`, every utility named "green" — paints **Google blue**. The carefully composed Matrix/Tron aesthetic in [globals.css](../src/app/globals.css) (defaults `#00FF41` green, `#00F0FF` cyan, `#00AAFF` blue) is overwritten by Material on first paint.

**This is a brand identity problem before it's a technical one.** Even if a visitor doesn't recognize the colors as Google's, they recognize the *feel* — Material Design — and it tells them this is a generic corporate IT shop, not the specialists the hero copy implies.

Two equally valid fixes; pick a direction first, then implement:

- **A. If you actually want the cyberpunk brand** (recommended; it's distinctive in the IT-consulting market): replace `cms-data/theme.json` with a real cyber/neon palette (`primary: #00FF41`, `secondary: #00F0FF`, `accent: #00AAFF`, etc.), rename the theme, and audit any other `theme.colors.*` references to make sure they map to the right slot.
- **B. If you want a calmer corporate brand:** remove the cyberpunk styling from `globals.css`, drop the `text-mono` glow text in Hero and 404, swap JetBrains Mono out, and pick a coherent corporate palette (not Google's). Don't ship as-is.

There is no version of this that works as both at once. Pick one.

---

### B2. The mono font is set to "Inter" (a sans-serif), silently breaking the hacker aesthetic everywhere it appears

**Evidence:** [cms-data/theme.json](../cms-data/theme.json) line 31:

```json
"fonts": {
  "primary":   "Roboto, system-ui, sans-serif",
  "secondary": "Roboto, system-ui, sans-serif",
  "mono":      "Inter, system-ui, sans-serif"     // ← Inter is NOT a monospace font
}
```

`ThemeProvider` line 33 propagates this:
```ts
root.style.setProperty('--font-mono', theme.fonts.mono);  // --font-mono := Inter
```

Every Tailwind `font-mono` class (used for `> We Just Do IT`, `since_1994`, scroll indicator labels, 404 error stamps, footer brand wordmark, CMS hero copy, technical readouts) renders as **Inter**, not as the monospace JetBrains Mono that [layout.tsx](../src/app/layout.tsx) lines 20–26 took the trouble to import from Google Fonts.

The cyberpunk hero loses the monospaced hacker rhythm. The 404 page's `ERROR_CODE: HTTP_404_NOT_FOUND` reads as a regular paragraph. The footer wordmark loses its tech glyph. The brand voice that is *built into the typography* never actually arrives.

Additionally:
- `theme.json` `fonts.primary: "Roboto"` ≠ `layout.tsx` `Space_Grotesk` ≠ `typography.json` `fonts.primary: "Inter"`. Three sans-serif declarations, no winner.
- `theme.json` `fonts.secondary: "Roboto"` ≠ `globals.css @theme` `--font-grotesk: Space Grotesk` ≠ `typography.json` `fonts.display: "Outfit"`. Three display fonts.

**Fix:** Set `theme.json` `fonts.mono` to `"JetBrains Mono, ui-monospace, SFMono-Regular, monospace"` (matching what `layout.tsx` actually loads). Decide whether the brand's body font is Space Grotesk (current layout import) or Inter (typography.json's claim) or Roboto (theme.json's claim) — then set all three configs to the same answer, or delete two of them. Delete `cms-data/typography.json` entirely if `theme.json` is the runtime authority; it currently exists as orphan config.

---

### B3. Three logo files, three different configs pointing at different ones — and the "optimized" logo isn't actually being served

**Evidence (file sizes):**

```
public/logo.png                                     222 KB   ← still huge
public/uploads/1767004639953-original-backup.png    222 KB   ← original copy
public/uploads/1767004639953.png                    1.7 KB   ← the optimized one
```

**Where each file is referenced:**

| Config | Field | Value |
|---|---|---|
| `cms-data/settings.json` | `branding.logo` | `/logo.png` (222 KB) |
| `cms-data/settings.json` | `branding.favicon` | `/logo.png` (222 KB) |
| `cms-data/theme.json` | `branding.logo` | `/uploads/1767004639953.png` (1.7 KB) |
| `cms-data/theme.json` | `branding.favicon` | `/uploads/1767004639953.png` (1.7 KB) |
| `cms-data/media-index.json` | `path` | `/uploads/1767004639953.png` |
| `cms-data/pages.json` | (logo block content) | `/uploads/1767004639953.png` |
| `src/app/layout.tsx` line 99 | `faviconUrl` fallback | `/logo.png` |
| `src/app/icon.tsx` and `apple-icon.tsx` | (never use the logo file) | render text "RHC" in code |

Which logo a visitor sees depends on which subsystem responds first:
- The `<link rel="icon">` in `layout.tsx` reads from `theme.json` → gets the 1.7 KB version. ✓
- The Header `<Image>` (line 134 of [Header.tsx](../src/components/layout/Header.tsx)) reads `branding.logo` from `theme.json` API → gets the 1.7 KB version. ✓ (but only after client-side fetch resolves)
- Any code that falls back to `'/logo.png'` directly — and there are several — gets the **222 KB** original.

Additionally, [CLAUDE.md](../CLAUDE.md) explicitly claims "the logo went from 218 KB to 1.8 KB just by resizing 7088×7087 → 512×512." That's true only for the uploads version; the `/logo.png` path that the site falls back to is still the original 222 KB monster. The README is misleading.

Last, [src/app/icon.tsx](../src/app/icon.tsx) and [src/app/apple-icon.tsx](../src/app/apple-icon.tsx) **don't use any logo image at all** — they render the letters "RHC" in code (#00FF41 on #0A0E27). So:
- Browser tab icon (`/favicon` via `/icon`) → "RHC" text, never your actual logo
- iOS home screen icon (`/apple-icon`) → "RHC" text, never your actual logo
- `<link rel="icon">` in `<head>` → 1.7 KB logo (if theme loaded)
- `<img>` in Header → 1.7 KB logo (if theme loaded)
- Open Graph image → missing entirely (see C4 in the prior audit)
- Fallback `/logo.png` references → 222 KB original

That's **five different brand marks** depending on context.

**Fix:**
1. Delete `public/logo.png` (the 222 KB one). Re-export the actual logo at 512×512 PNG (≤10 KB) and 32×32 favicon and 180×180 apple-touch-icon. Save them to `/public/` with sane names (`logo.png`, `favicon.png`, `apple-touch-icon.png`).
2. Update every config (`settings.json`, `theme.json`, `pages.json`, `media-index.json`) to point at the same path. Pick **one** location — recommend `/public/brand/logo.png` etc.
3. Replace [icon.tsx](../src/app/icon.tsx) and [apple-icon.tsx](../src/app/apple-icon.tsx) with the file-convention static favicon (just drop `favicon.ico` / `icon.png` / `apple-icon.png` into `app/`) so they actually use the brand mark.
4. Once consolidated, update [CLAUDE.md](../CLAUDE.md) so the "1.8 KB logo" claim is true again.

---

## 🟠 HIGH

### B4. Tagline and "Since 1994" line live in 6+ files, drifting

| Source | Says |
|---|---|
| `settings.json` | `"We Just Do IT"` (tagline) |
| `layout.tsx` metadata | `"...We Just Do IT."` (in description) |
| `Hero.tsx` (dead code) | `> We Just Do IT` |
| `Header.tsx` default | `"We Just Do IT"` |
| `Footer.tsx` default | `"We Just Do IT"` |
| `pages.json` hero block | `title: "We Just Do IT"` (whole tagline as page title) |
| `data/pageContent.ts` | `subtitle: "Professional IT Consulting & Business Solutions Since 1994"` |
| `api/cms/seo/route.ts` | `ogDescription: "We Just Do IT - Professional IT consulting services since 1994."` |
| `footer.json` | `description: "Since 1994, delivering professional IT consulting and services."` |
| `AboutPreview.tsx` | `"Your Trusted IT Partner Since 1994"` + `"For over three decades"` |
| `Hero.tsx` (dead) | `"30+ years of expertise"` (body), `"since_1994"` (badge), `"30+ Years of Excellence"` (subhead) |
| `CTASection.tsx` | `"30+ Years Experience"` (trust badge) |

That's six independent declarations of "Since 1994" / "30+ years" / "three decades" — and they're already inconsistent (note "30+ years of expertise" vs "30+ Years of Excellence" vs "30+ Years Experience" vs "three decades" vs "Since 1994"). The next person to update one will not update the other five.

**Fix:** One source of truth in `cms-data/settings.json`:
```json
"brand": {
  "tagline": "We Just Do IT",
  "foundingYear": 1994,
  "yearsTagline": "30+ Years of Excellence",
  "valueProp": "Professional IT consulting, cloud, security, and continuity since 1994"
}
```
Then read it server-side in `layout.tsx`, pass via context, and **delete all hardcoded copies** in components, page content files, and the SEO API. The `pages.json` hero blocks can still customize per-page, but the default falls back to the central source.

---

### B5. 15+ different CTA labels for what is essentially one action

Inventory of every primary CTA on the public site:

| Where | Label | Destination |
|---|---|---|
| Header (always visible) | "Book a Meeting" | Outlook bookwithme URL |
| Hero (dead) | "Book a Meeting" | Outlook URL |
| Hero (dead) | "Explore Services" | /services |
| CMS home hero | "Book a strategy call" | /contact |
| AboutPreview | "Learn More About Us" | /about-us |
| CTASection primary | "Schedule a Consultation" | Outlook URL |
| CTASection secondary | "Contact Us" | /contact |
| ClientsTeaser | "View All Case Studies" | /clients |
| CMS services hero | (no CTA defined) | — |
| CMS services cards | "Explore" (×8) | /services/* |
| CMS services CTA block | "Discuss your needs" | /contact |
| CMS prof-services hero | "Schedule consultation" | /contact |
| CMS prof-services CTA | "Book discovery call" | /contact |
| CMS cloud hero | "Request cloud assessment" | /contact |
| CMS cloud CTA | "Get free assessment" | /contact |
| CMS cyber-sec hero | "Schedule security review" | /contact |
| BlockRenderer default | "Learn More" | (link's url) |
| `pageContent.ts` | "Get Started", "Learn More" | — |

A visitor scrolling the home page sees: "Book a Meeting" (header) → "Book a strategy call" (hero) → various explorations → "Schedule a Consultation" / "Contact Us" (footer CTA). On a service page they see: "Book a Meeting" (header) → "Request cloud assessment" / "Schedule consultation" / "Schedule security review" (hero, depends on service) → "Get free assessment" / "Book discovery call" / "Discuss your needs" (footer CTA).

Every label is slightly different, slightly less crisp than it could be. Two CTAs go to Outlook (the Header and CTASection primary) while everything else goes to the contact form — which means the user *might* end up on `/contact` or *might* end up in a 3rd-party calendar tool with no warning.

**Fix:**
1. Pick **two** primary CTA verbs and stop. Suggested:
   - **Primary** (commitment-low): "Book a 30-min call" → Outlook
   - **Secondary** (commitment-lower): "Get in touch" → `/contact`
2. Use those exact strings everywhere. Don't let CMS editors invent new ones; provide a fixed list as a dropdown in the admin UI.
3. Mark every external CTA (Outlook) with the same visual cue (icon + `aria-label="opens external calendar"`).

---

### B6. Two competing voices in the copy — hacker and consultant — sharing the same page

The Hero block on the homepage is voice-A: "`> We Just Do IT`", "`since_1994`", "`Implementation • Integration • Maintenance`". Hacker / cyberpunk / IIM-as-an-acronym. The 404 page is the same voice: "`ERROR_CODE: HTTP_404_NOT_FOUND`", "`STATUS: RESOURCE_UNAVAILABLE`". These two pages have a clear, distinctive POV.

Three sections down, AboutPreview switches to voice-B: *"RHC Solutions has been at the forefront of IT innovation, helping businesses transform their operations through strategic technology implementation… we combine deep technical expertise with a passion for solving complex business challenges."* That's standard B2B SaaS copy with zero personality.

Then the CMS service pages are voice-B with extra jargon: *"End-to-end builds with change control, rollback procedures, and cutover runbooks animated with process flows."* Still corporate, more technical.

Then the cookie banner is voice-C, a regulatory-template voice: *"We use cookies to enhance your browsing experience and analyze site traffic."*

None of these voices are bad individually. They just don't co-exist. A visitor lands in the cyberpunk hero, then thinks they've teleported to a Big-Four consultancy by the time they reach AboutPreview, then to a Cookiebot dialog. The brand feels held together with masking tape.

**Fix:**
- Decide whose voice this is. Two reasonable answers: (a) lean further into the hacker/specialist voice everywhere (it's distinctive and supports the "since 1994" credibility play), or (b) drop the hacker affectations from the hero and let the technical-but-warm B2B voice rule. Either works. *Both* doesn't.
- If (a), rewrite AboutPreview, service page intros, and the cookie banner in the same `>` prompt, mono-flavored register. Keep technical specifics but use shorter, sharper sentences.
- If (b), rewrite the Hero block, replace `since_1994` with "Since 1994", drop the green-on-black mono prompt characters, and let the 404 page use a friendlier "We can't find that page" line.

---

### B7. Iconography fragmentation: CMS pages use emojis, hand-built pages use FontAwesome

[BlockRenderer.tsx](../src/components/cms/BlockRenderer.tsx) renders emojis baked into the renderer:
- `cards` block default icons: `['🔒', '🛡️', '⚡', '🔐', '🌐', '💻', '📊', '🎯', '🚀', '⚙️']` (line 156)
- `columns` block icons: `['📋', '💡', '⚡', '🎯']` (line 221)
- `cta` block: `'🎯'` (line 202)
- `testimonial` block: `'💬'` quote bubble, `'👤'` author avatar (lines 246, 250)
- `contactform` block: `'📬'` (line 378)
- `button` block: `'🚀'` (line 357)
- `list` block uses emoji per item by keyword: `📧`, `📞`, `🕐`, `📍`, `✓` (lines 274–278)

Meanwhile, [Header.tsx](../src/components/layout/Header.tsx), [Footer.tsx](../src/components/layout/Footer.tsx), [Hero.tsx](../src/components/home/Hero.tsx), [AboutPreview.tsx](../src/components/home/AboutPreview.tsx), [CTASection.tsx](../src/components/home/CTASection.tsx), [CookieConsent.tsx](../src/components/CookieConsent.tsx), and [ContactForm.tsx](../src/components/ContactForm.tsx) all use FontAwesome glyphs from `react-icons/fa` (`FaCloud`, `FaShieldAlt`, `FaCogs`, `FaCheckCircle`, `FaTelegram`, `FaWhatsapp`, `FaPaperPlane`, `FaCookie`, etc).

So: any CMS-edited page (which is most of the site by depth — every service page) is illustrated with emojis that render as iOS/Android-native glyphs, breaking the design language and forcing a brand-foreign rendering engine into your layout. Service pages look like Notion docs; hand-built pages look like a cyberpunk consultancy.

**Fix:** Replace the emoji defaults in `BlockRenderer` with FontAwesome icons (or pure-SVG inline icons), keyed by the same lookup logic. If you want admins to be able to pick icons per card, ship an icon-picker UI rather than free-text emoji. Eliminate emojis from public-facing pages.

---

### B8. Contact form font is Roboto (from theme.json) while everything around it is Space Grotesk

[ContactForm.tsx](../src/components/ContactForm.tsx) lines 92, 94, 109, 119, 134, 144, 158, 168, 183, 230 — fourteen inline `style={{ fontFamily: fonts.primary }}` overrides, where `fonts.primary` comes from `theme.json` (`"Roboto, system-ui, sans-serif"`).

The form is embedded inside the contact page CMS block — wrapped in a `card-cyber` container — and renders in Roboto while the surrounding card title, hero, and footer are in Space Grotesk / JetBrains Mono. It looks like a Material UI form pasted into a Tron movie.

**Fix:** Remove all 14 inline `fontFamily` overrides. Let the form inherit from `body` (Space Grotesk via layout.tsx). If admin-configurable form fonts are a real requirement, route them through a single CSS variable rather than 14 inline styles per form.

---

### B9. BlockRenderer's hero hardcodes Courier New — green-on-black like a 1998 hacker movie

[BlockRenderer.tsx](../src/components/cms/BlockRenderer.tsx) lines 80, 85, 90:

```tsx
<h1 style={{ fontFamily: '"Courier New", Courier, monospace' }}>
  <span className="text-[#33ff33]">{getText(title)}</span>
</h1>
```

`#33ff33` is a hardcoded hex (not the theme variable). `Courier New` is hardcoded (not the theme mono variable, which is "Inter" anyway). This is the **CMS hero on every page that uses the `hero` block** — including the homepage and every service page.

So the homepage hero says "We Just Do IT" in literal 1998-Courier-New `#33ff33` green. The rest of the page is supposedly Space Grotesk on the cyberpunk palette. The hero is a different brand than the rest of the page.

**Fix:** Remove the inline styles. Use the existing `.heading-xl` / `.text-mono` / `.text-gradient` design-system classes so the hero inherits the same typography and color stack as everything else.

---

## 🟡 MEDIUM

### B10. Three competing design-token files exist with conflicting values

| File | Owner | Used by |
|---|---|---|
| `src/app/globals.css` `@theme` block | Build-time Tailwind v4 tokens | Components via `bg-*`, `text-*` classes |
| `cms-data/theme.json` | "Google Dark" admin theme | `ThemeProvider` runtime, layout.tsx fonts/branding |
| `cms-data/typography.json` | A *third* token system | …nobody references this file. Orphan. |

`typography.json` was apparently set up at some point and then forgotten. Its `colors.primary: #00D9FF`, `secondary: #00FF41`, `accent: #FF006E` (synthwave palette) match neither `globals.css` nor `theme.json`. Its `fonts.display: "Outfit"` is a font not loaded anywhere else.

**Fix:** Delete `cms-data/typography.json` if unused; otherwise wire it up and merge with `theme.json`. Two sources of truth is bad. Three is worse.

### B11. Stats are inconsistent across components (numbers + labels both drift)

Numbers used:

| Where | Year | Projects | Industries | Satisfaction | Other |
|---|---|---|---|---|---|
| Hero (dead) | "30+ years" | 500+ | 15+ | 98% | "24/7 Support" |
| AboutPreview | "1994" + "three decades" | 500+ | 15+ "Industries Served" | 98% | — |
| CTASection trust badges | "30+ Years Experience" | "500+ Projects Delivered" | — | "98% Client Satisfaction" | — |

The numbers happen to agree today. "Industries" vs "Industries Served" doesn't. "30+ years" vs "three decades" doesn't. The next stat update will diverge silently.

**Fix:** One stats object in `settings.json` (or a new `cms-data/stats.json`) with `{ founded, projects, industries, satisfaction, support }` and matching label strings; read everywhere.

### B12. Two announcements of "Implementation • Integration • Maintenance" with no follow-through

[Hero.tsx](../src/components/home/Hero.tsx) line 43 leads with `Implementation • Integration • Maintenance` — clearly meant to be an "IIM" pillar acronym. But no other component, page, or piece of copy ever references these three pillars again. The services aren't categorized into Implementation / Integration / Maintenance buckets — they're categorized by topic (Cloud / Security / etc.).

If "IIM" is the framing, follow through: structure the services page around it, restate it in About, work it into the meta description. If it's not, drop it from the Hero — it sets an expectation the rest of the site abandons.

### B13. Logo wordmark style drifts between Header and Footer

- [Header.tsx](../src/components/layout/Header.tsx) line 142: site name in `text-text-primary` with **last word** wrapped in `text-gradient`. So it reads: **RHC** *Solutions* (last word gradient).
- [Footer.tsx](../src/components/layout/Footer.tsx) line 141: same logic, same word treated as gradient.
- Both rely on `settings.siteName.split(' ')` and gradient the last word.

That's consistent — good. But the *font* differs:
- Header default: `JetBrains Mono` (line 100)
- Footer default: `Inter` (line 132)
- Theme override: `Inter` for both (theme.json `siteNameFont` and `footerFont`)

So the wordmark shows in two different fonts in Header vs Footer depending on theme. Pick one font for the wordmark and keep it identical at both ends of every page.

### B14. Booking URL is hardcoded in three components — and one of them is dead code

Same Outlook `bookwithme` URL appears as a constant in Hero ([line 7](../src/components/home/Hero.tsx#L7)), Header ([line 34](../src/components/layout/Header.tsx#L34)), and CTASection ([line 7](../src/components/home/CTASection.tsx#L7)). Hero is dead code (see prior audit H5), so it's a ghost copy. The other two will drift when the URL is rotated.

**Fix:** Move to `cms-data/settings.json -> contact.bookingUrl`, read server-side.

---

## 🟢 LOW

### B15. CookieConsent uses the cyberpunk green check icon `FaCookie` on the "Google Dark" theme

[CookieConsent.tsx](../src/components/CookieConsent.tsx) line 135 — the cookie icon is colored `text-cyber-green`. With Google Dark active, the runtime `--color-neon-green` becomes Google Blue (#4285F4), so the cookie icon is blue, not green. Cosmetic but reinforces B1.

### B16. Apple touch icon and favicon don't use the brand mark

[apple-icon.tsx](../src/app/apple-icon.tsx) and [icon.tsx](../src/app/icon.tsx) both render the literal text "RHC" — not the actual logo file. iOS users adding to home screen get a text tile, not the brand. Replace with proper PNGs at `/app/icon.png` and `/app/apple-icon.png`.

### B17. `data/pageContent.ts` is an orphan source of copy

[src/data/pageContent.ts](../src/data/pageContent.ts) defines `hero.title`, `hero.subtitle`, `about.description`, etc. — but `pageContent.ts` is not imported anywhere on the public site (CMS uses `pages.json`). It's another tagline-mirror that will drift. Delete it.

### B18. CMS Hero block hardcodes `text-[#33ff33]` rather than reading a theme token

[BlockRenderer.tsx](../src/components/cms/BlockRenderer.tsx) lines 81, 86, 91 use arbitrary value `text-[#33ff33]`. Even if you fix B9's font issue, this hardcoded hex bypasses ThemeProvider. When admins change the primary color, the CMS hero stays Matrix-green. Use `text-neon-green` (after fixing the alias issue in C1 of the prior audit).

---

## Single-source-of-truth scorecard

| Brand attribute | Sources today | Should be |
|---|---|---|
| Tagline ("We Just Do IT") | 6 | 1 (`settings.json`) |
| "Since 1994" / year founded | 6+ | 1 |
| Logo file | 3 file references + 2 generated icons | 1 file, 1 path |
| Primary CTA label | 15+ | 2 (primary + secondary) |
| Booking URL | 3 (one in dead code) | 1 |
| Mono font | 5 declarations (one being a sans-serif) | 1 |
| Sans / body font | 3 (Space Grotesk, Inter, Roboto) | 1 |
| Display / heading font | 3 (Space Grotesk, Inter, Outfit) | 1 |
| Color palette name | "Google Dark" runtime, cyberpunk defaults, synthwave in `typography.json` | 1 |
| Stats numbers | 3 declarations | 1 |
| Service icons | emojis (CMS) + FontAwesome (hand-built) | 1 system |

The goal isn't perfection — it's "if I want to change the year from 1994 to 1994 (rebrand to founding), I edit one place."

---

## Recommended fix order

A focused 1-day sprint can clear all 3 Criticals + half the Highs:

1. **B1** — Replace "Google Dark" theme.json with the cyber palette you actually designed for. *(2 hours, picks the brand direction)*
2. **B2** — Fix `fonts.mono` so it's a monospace font; align `fonts.primary` across `theme.json` / `layout.tsx` / `typography.json` to one answer. *(30 minutes)*
3. **B3** — Consolidate logos to one path with one optimized file. Replace `icon.tsx` / `apple-icon.tsx` with static files. Update CLAUDE.md so the "1.8 KB" claim is accurate again. *(1–2 hours)*
4. **B4** — Move tagline + "Since 1994" + value-prop to `settings.json -> brand` and replace 12 hardcoded copies with reads. *(2 hours)*
5. **B5** — Lock CTA verbs to two strings. Delete other variants. *(1–2 hours including copy decisions)*
6. **B9 + B18** — Strip the inline `Courier New` / `#33ff33` from `BlockRenderer` hero. *(15 minutes)*
7. **B7** — Replace BlockRenderer emoji defaults with FontAwesome. *(1–2 hours)*
8. **B8** — Remove 14 inline `fontFamily` overrides in ContactForm. *(15 minutes)*

The remaining items (B10–B17) are cleanup that fits in a follow-up pass.

---

## Out of scope / not in this audit

- **Photography and illustration style** — no images audited beyond the logo, since there are essentially none on the site.
- **Motion-design consistency** — partly covered in the design audit (M9: `prefers-reduced-motion`). Worth a separate motion-system pass once the visual brand is settled.
- **Tone-of-voice guidelines as a document** — flagged the inconsistency in B6 but didn't draft a voice guide. If you want one, that's its own deliverable.
- **Logo audit** itself (is the wordmark good, is the lockup right, etc.) — that's brand-design work, not a code audit.

---

*Generated 2026-05-11 by automated code review. Re-run after B1–B5 are addressed; many of the remaining items will resolve as a side-effect.*
