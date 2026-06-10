import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import * as fs from 'fs';
import * as path from 'path';
import { setSecrets, setEnvValue } from '@adminpanel/lib/env';
import { MANAGED_SECRET_KEYS } from '@adminpanel/lib/integrations';
import { cmsDb } from '@adminpanel/lib/cms/database';
import { validateBrevo, validateCloudflareToken, validateSmtp, type ValidationResult } from '@adminpanel/lib/integrations/test';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const USERS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'users.json');

// As with design-pack apply: allow during genuine first-run (no admin yet) — the
// only sound first-run signal — or for a logged-in admin. Closes once setup is done.
function adminExists(): boolean {
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    return Array.isArray(users) && users.some((u: any) => String(u?.role).toLowerCase() === 'admin');
  } catch {
    return false;
  }
}

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

  const saved = { settings: [] as string[], secrets: [] as string[], env: [] as string[] };
  const rejected: string[] = [];
  const warnings: string[] = [];
  let restartRequired = false;

  // --- Site identity -> settings (merged) ---
  const identity = body?.identity || {};
  const host = identity.domain ? String(identity.domain).replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim() : '';
  const siteUrl = host ? `https://${host}` : (typeof identity.siteUrl === 'string' ? identity.siteUrl : '');
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

  // --- Domain URLs -> .env.local (restart to apply) ---
  if (siteUrl) {
    try {
      setEnvValue('NEXT_PUBLIC_SITE_URL', siteUrl);
      setEnvValue('NEXTAUTH_URL', siteUrl);
      saved.env.push('NEXT_PUBLIC_SITE_URL', 'NEXTAUTH_URL');
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

  // --- Validation (non-blocking) ---
  const validation: ValidationResult[] = [];
  if (body?.validate) {
    const checks: Promise<ValidationResult>[] = [];
    if (filtered.BREVO_API_KEY) checks.push(validateBrevo(filtered.BREVO_API_KEY));
    if (typeof cf.apiToken === 'string' && cf.apiToken.trim()) checks.push(validateCloudflareToken(cf.apiToken.trim()));
    if (filtered.SMTP_HOST) checks.push(validateSmtp({ host: filtered.SMTP_HOST, port: filtered.SMTP_PORT, user: filtered.SMTP_USER, pass: filtered.SMTP_PASS, secure: filtered.SMTP_SECURE === 'true' }));
    if (checks.length) validation.push(...await Promise.all(checks));
  }

  return NextResponse.json(
    { ok: true, saved, rejected, validation, restartRequired, warnings },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
