// Single source of truth for security response headers.
// Imported by middleware.ts (HTML routes) and next.config.mjs (everything else,
// including /_next/image and /_next/static where middleware does not run).

export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.ahrefs.com https://static.hotjar.com https://script.hotjar.com https://t.contentsquare.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://analytics.ahrefs.com https://*.hotjar.com https://*.hotjar.io wss://*.hotjar.com https://api.telegram.org https://t.contentsquare.net https://ipinfo.io",
  "frame-src 'self' https://challenges.cloudflare.com https://outlook.office.com https://outlook.office365.com https://vars.hotjar.com",
  "worker-src 'self' blob:",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join('; ');

// X-XSS-Protection is intentionally omitted — it was deprecated by all major
// browsers and the `1; mode=block` value has been shown to introduce XSS in
// some browser combos. CSP is the modern replacement and is already set.
// Expect-CT is also omitted — the Certificate Transparency log policy was
// retired by Chromium in 2023 (the header is silently ignored everywhere now).
// HSTS is intentionally not emitted at origin — Cloudflare owns TLS termination
// and applies Strict-Transport-Security at the edge; duplicating here risks
// origin-side misconfiguration locking out a future apex-without-TLS path.
export const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // strict-origin-when-cross-origin (the W3C default) sends the origin to
  // cross-origin destinations so partner/client sites can see referral traffic
  // from rhcsolutions, while stripping the path for privacy. `same-origin`
  // sent no referrer cross-origin, hiding our outbound referrals entirely.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'master-only' },
  {
    key: 'Permissions-Policy',
    value:
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()',
  },
];
