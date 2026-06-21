import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { setSecrets, setEnvValue } from '@adminpanel/lib/env';
import { MANAGED_SECRET_KEYS } from '@adminpanel/lib/integrations';
import { cmsDb } from '@adminpanel/lib/cms/database';
import { seedBrandMedia } from '@adminpanel/lib/cms/media-scan';
import { seedSeoDefaults } from '@adminpanel/lib/cms/seo-store';
import { adminExists } from '@adminpanel/lib/auth/setup-gate';
import { validateBrevo, validateCloudflareToken, validateSmtp, type ValidationResult } from '@adminpanel/lib/integrations/test';
import { domainToHost } from '@adminpanel/lib/url-path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Hostname guard (defense-in-depth against env/CRLF injection via the domain field).
// The leading negative lookahead rejects a bare dotted-quad IPv4 (e.g. 127.0.0.1,
// 169.254.169.254, 192.168.1.1) — the "domain" field must be a real hostname, not an
// IP/metadata endpoint that could land in NEXT_PUBLIC_SITE_URL during first-run setup.
// Single-label inputs (e.g. "localhost") already fail: the trailing group requires a dot.
const HOSTNAME_RE = /^(?!\d{1,3}(?:\.\d{1,3}){3}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = String((token as any)?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'administrator';
  if (!isAdmin && adminExists()) {
    return NextResponse.json({ error: 'Unauthorized: admin role required' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const saved = { settings: [] as string[], secrets: [] as string[], env: [] as string[], media: [] as string[], seo: [] as string[] };
  const rejected: string[] = [];
  const warnings: string[] = [];
  let restartRequired = false;

  // --- Site identity -> settings (merged) ---
  const identity = body?.identity || {};
  const rawHost = identity.domain ? domainToHost(identity.domain) : '';
  const host = rawHost && HOSTNAME_RE.test(rawHost) ? rawHost : '';
  if (rawHost && !host) warnings.push(`Ignored invalid domain "${rawHost}".`);
  const siteUrl = host ? `https://${host}` : '';
  const settingsPatch: Record<string, any> = {};
  if (typeof identity.siteName === 'string' && identity.siteName.trim()) settingsPatch.siteName = identity.siteName.trim();
  if (typeof identity.contactEmail === 'string' && identity.contactEmail.trim()) settingsPatch.contactEmail = identity.contactEmail.trim();
  if (siteUrl) settingsPatch.siteUrl = siteUrl;
  if (Object.keys(settingsPatch).length) {
    try {
      await cmsDb.updateSettings(settingsPatch);
      saved.settings = Object.keys(settingsPatch);
    } catch (e) {
      warnings.push(`Could not save site settings: ${(e as Error).message}`);
    }
  }

  // --- Seed the media library with the bundled brand assets (logo/favicon/og) so
  // /admin/media isn't empty on a fresh deploy. Idempotent + best-effort. ---
  try {
    const seed = seedBrandMedia('system');
    saved.media = seed.files;
  } catch (e) {
    warnings.push(`Could not seed brand media: ${(e as Error).message}`);
  }

  // --- Seed cms-data/seo.json from identity so /admin/seo opens pre-filled with the
  // real site name/domain instead of the generic placeholder. Write-if-absent only. ---
  try {
    saved.seo = seedSeoDefaults({ siteName: settingsPatch.siteName, host });
  } catch (e) {
    warnings.push(`Could not seed SEO defaults: ${(e as Error).message}`);
  }

  // --- Public site URL -> .env.local (restart to apply). NOTE: we intentionally do
  // NOT touch NEXTAUTH_URL — the admin panel often runs on a separate subdomain
  // (e.g. admin.example.com) and overwriting it would break admin auth callbacks.
  if (siteUrl) {
    try {
      setEnvValue('NEXT_PUBLIC_SITE_URL', siteUrl);
      saved.env.push('NEXT_PUBLIC_SITE_URL');
      restartRequired = true;
    } catch (e) {
      warnings.push(`Could not write domain to .env.local: ${(e as Error).message}`);
    }
  }

  // --- Cloudflare -> .env.local (token read via getSecret's env fallback; zone via process.env) ---
  const cf = body?.cloudflare || {};
  const cfMap: Record<string, string | undefined> = {
    CLOUDFLARE_API_TOKEN: cf.apiToken,
    NEXT_PUBLIC_CLOUDFLARE_ZONE_ID: cf.zoneId,
    CLOUDFLARE_ACCOUNT_ID: cf.accountId,
  };
  for (const [k, v] of Object.entries(cfMap)) {
    if (typeof v === 'string' && v.trim()) {
      try { setEnvValue(k, v.trim()); saved.env.push(k); restartRequired = true; } catch (e) { warnings.push(`Could not write ${k}: ${(e as Error).message}`); }
    }
  }

  // --- Secrets (Brevo/SMTP/...) -> cms-data/secrets.json, allow-listed ---
  const secrets = body?.secrets && typeof body.secrets === 'object' ? body.secrets : {};
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(secrets)) {
    if (!MANAGED_SECRET_KEYS.has(k)) { rejected.push(k); continue; }
    if (typeof v === 'string' && v.trim()) filtered[k] = v.trim();
  }
  if (Object.keys(filtered).length) {
    try {
      setSecrets(filtered);
      saved.secrets = Object.keys(filtered);
    } catch (e) {
      warnings.push(`Could not save secrets: ${(e as Error).message}`);
    }
  }

  // --- Database driver selection -> .env.local (restart to apply) ---
  // SQLite is the zero-config default; Postgres is validated before we commit
  // it so a bad URL can't brick the app on restart.
  const dbReq = body?.database || {};
  let database: { driver: string; ok: boolean; error?: string } | null = null;
  if (dbReq.driver === 'postgres') {
    const url = typeof dbReq.url === 'string' ? dbReq.url.trim() : '';
    if (!url) {
      warnings.push('Postgres selected but no connection string provided; database left unchanged.');
    } else {
      const { validatePostgresUrl } = await import('@adminpanel/lib/cms/db/validate');
      const check = await validatePostgresUrl(url);
      database = { driver: 'postgres', ok: check.ok, error: check.error };
      if (check.ok) {
        try {
          setEnvValue('DATABASE_URL', url);
          setEnvValue('DB_DRIVER', 'postgres');
          saved.env.push('DATABASE_URL', 'DB_DRIVER');
          restartRequired = true;
        } catch (e) {
          warnings.push(`Could not write database config: ${(e as Error).message}`);
        }
      } else {
        warnings.push(`Postgres connection failed: ${check.error}. Database left unchanged.`);
      }
    }
  } else if (dbReq.driver === 'sqlite') {
    try {
      setEnvValue('DB_DRIVER', 'sqlite');
      saved.env.push('DB_DRIVER');
      restartRequired = true;
      database = { driver: 'sqlite', ok: true };
    } catch (e) {
      warnings.push(`Could not write database config: ${(e as Error).message}`);
    }
  }

  // --- DNS + validation run CONCURRENTLY (each network op is capped at 6s; the
  // overall response is bounded rather than serialized into a ~30s wait). ---
  const dnsReq = body?.dns || {};
  const dnsPromise: Promise<any[]> =
    (typeof dnsReq.serverIp === 'string' && dnsReq.serverIp.trim() && typeof cf.apiToken === 'string' && cf.apiToken.trim() && typeof cf.zoneId === 'string' && cf.zoneId.trim() && host)
      ? import('@adminpanel/lib/cloudflare/dns')
          .then((m) => m.pointDomainToServer({
            zoneId: cf.zoneId.trim(), token: cf.apiToken.trim(), domain: host,
            serverIp: dnsReq.serverIp.trim(), proxied: dnsReq.proxied !== false, www: !!dnsReq.www,
          }))
          .catch((e) => { warnings.push(`DNS update failed: ${(e as Error).message}`); return []; })
      : Promise.resolve([]);

  const checks: Promise<ValidationResult>[] = [];
  if (body?.validate) {
    if (filtered.BREVO_API_KEY) checks.push(validateBrevo(filtered.BREVO_API_KEY));
    if (typeof cf.apiToken === 'string' && cf.apiToken.trim()) checks.push(validateCloudflareToken(cf.apiToken.trim()));
    if (filtered.SMTP_HOST) checks.push(validateSmtp({ host: filtered.SMTP_HOST, port: filtered.SMTP_PORT, user: filtered.SMTP_USER, pass: filtered.SMTP_PASS, secure: filtered.SMTP_SECURE === 'true' }));
  }

  const [dns, validation] = await Promise.all([dnsPromise, Promise.all(checks)]);

  return NextResponse.json(
    { ok: true, saved, rejected, validation, dns, database, restartRequired, warnings },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
