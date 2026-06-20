// Cloudflare DNS record management with EXPLICIT credentials. The rest of the
// Cloudflare integration (api.ts) is read-only and reads creds via getSecret; this
// module adds *write* (upsert) so the provisioning wizard can point a freshly-set
// domain at the server using the token/zone the operator just typed.

import { domainToHost } from '@adminpanel/lib/url-path';

const CF = 'https://api.cloudflare.com/client/v4';
const TIMEOUT_MS = 6_000;
const CF_ZONE_ID_RE = /^[a-f0-9]{32}$/i;
const CF_RECORD_ID_RE = /^[A-Za-z0-9_-]+$/;
const ALLOWED_DNS_TYPES = new Set(['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'SRV', 'CAA', 'PTR', 'NAPTR', 'TLSA', 'URI']);

function normalizeDomainHost(domain: string): string {
  // domainToHost strips an http(s):// scheme + trailing slashes in LINEAR time
  // (ReDoS-safe — see lib/url-path; the old `.replace(/\/+$/, '')` here was the
  // polynomial pattern of CodeQL #29). Then validate it's a real multi-label host.
  const host = domainToHost(domain).toLowerCase();
  if (!host || host.length > 253) throw new Error('Invalid domain format');
  const labels = host.split('.');
  if (labels.length < 2) throw new Error('Invalid domain format');
  for (const label of labels) {
    if (!label || label.length > 63) throw new Error('Invalid domain format');
    if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Invalid domain format');
    if (label.startsWith('-') || label.endsWith('-')) throw new Error('Invalid domain format');
  }
  return host;
}

interface CloudflareApiError {
  message?: string;
}

interface CloudflareApiResponse<T = unknown> {
  success?: boolean;
  result?: T;
  errors?: CloudflareApiError[];
}

function normalizeZoneId(zoneId: string): string {
  const v = zoneId.trim();
  if (!CF_ZONE_ID_RE.test(v)) throw new Error('Invalid Cloudflare zone ID format');
  return v;
}

function normalizeDnsType(type: string): string {
  const v = type.trim().toUpperCase();
  if (!ALLOWED_DNS_TYPES.has(v)) throw new Error('Invalid DNS record type');
  return v;
}

function normalizeRecordId(id: string): string {
  const v = id.trim();
  if (!CF_RECORD_ID_RE.test(v)) throw new Error('Invalid DNS record ID format');
  return v;
}

export interface DnsResult {
  name: string;
  type: string;
  ok: boolean;
  action: 'created' | 'updated' | 'failed';
  message: string;
}

async function cf<T = unknown>(pathname: string, token: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${CF}${pathname}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    const data: CloudflareApiResponse<T> = await res.json().catch(() => ({}));
    return { res, data };
  } finally {
    clearTimeout(t);
  }
}

// Create the record, or update it in place if one of the same type+name exists.
export async function upsertDnsRecord(opts: {
  zoneId: string; token: string; type: string; name: string; content: string; proxied?: boolean; ttl?: number;
}): Promise<DnsResult> {
  const { zoneId, token, type, name, content } = opts;
  const proxied = opts.proxied ?? true;
  const ttl = opts.ttl ?? 1; // 1 = "automatic"
  try {
    const safeZoneId = normalizeZoneId(zoneId);
    const safeType = normalizeDnsType(type);
    const safeName = name.trim();
    const { data: list } = await cf<Array<{ id?: string }>>(
      `/zones/${safeZoneId}/dns_records?type=${encodeURIComponent(safeType)}&name=${encodeURIComponent(safeName)}`,
      token,
    );
    const matches = Array.isArray(list?.result) ? list.result : [];
    if (matches.length > 1) {
      console.warn(`[cloudflare:dns] Multiple DNS records matched type="${safeType}" name="${safeName}" in zone "${safeZoneId}". Using the first match (id="${String(matches[0].id || 'unknown')}").`);
    }
    const existing = matches.length > 0 ? matches[0] : null;
    const existingRecordId = existing?.id ? normalizeRecordId(String(existing.id)) : null;
    const payload = JSON.stringify({ type: safeType, name: safeName, content, proxied, ttl });
    const { res, data } = existingRecordId
      ? await cf(`/zones/${safeZoneId}/dns_records/${existingRecordId}`, token, { method: 'PUT', body: payload })
      : await cf(`/zones/${safeZoneId}/dns_records`, token, { method: 'POST', body: payload });
    if (res.ok && data?.success) {
      return { name, type, ok: true, action: existingRecordId ? 'updated' : 'created', message: `${name} → ${content}` };
    }
    return { name, type, ok: false, action: 'failed', message: data?.errors?.[0]?.message || `HTTP ${res.status}` };
  } catch (e) {
    return { name, type, ok: false, action: 'failed', message: (e as Error).message };
  }
}

// Point a domain (apex, optionally www) at a server IP via A records.
export async function pointDomainToServer(opts: {
  zoneId: string; token: string; domain: string; serverIp: string; proxied?: boolean; www?: boolean;
}): Promise<DnsResult[]> {
  // normalizeDomainHost strips scheme/slashes (ReDoS-safe) AND validates the hostname,
  // so this no longer relies solely on the caller (the provisioning route) pre-validating.
  const host = normalizeDomainHost(opts.domain);
  const results: DnsResult[] = [];
  results.push(await upsertDnsRecord({ zoneId: opts.zoneId, token: opts.token, type: 'A', name: host, content: opts.serverIp, proxied: opts.proxied }));
  if (opts.www) {
    results.push(await upsertDnsRecord({ zoneId: opts.zoneId, token: opts.token, type: 'A', name: `www.${host}`, content: opts.serverIp, proxied: opts.proxied }));
  }
  return results;
}
