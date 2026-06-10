// Cloudflare DNS record management with EXPLICIT credentials. The rest of the
// Cloudflare integration (api.ts) is read-only and reads creds via getSecret; this
// module adds *write* (upsert) so the provisioning wizard can point a freshly-set
// domain at the server using the token/zone the operator just typed.

const CF = 'https://api.cloudflare.com/client/v4';
const TIMEOUT_MS = 6_000;

export interface DnsResult {
  name: string;
  type: string;
  ok: boolean;
  action: 'created' | 'updated' | 'failed';
  message: string;
}

async function cf(pathname: string, token: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${CF}${pathname}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    const data: any = await res.json().catch(() => ({}));
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
    const { data: list } = await cf(`/zones/${zoneId}/dns_records?type=${type}&name=${encodeURIComponent(name)}`, token);
    const existing = Array.isArray(list?.result) ? list.result[0] : null;
    const payload = JSON.stringify({ type, name, content, proxied, ttl });
    const { res, data } = existing
      ? await cf(`/zones/${zoneId}/dns_records/${existing.id}`, token, { method: 'PUT', body: payload })
      : await cf(`/zones/${zoneId}/dns_records`, token, { method: 'POST', body: payload });
    if (res.ok && data?.success) {
      return { name, type, ok: true, action: existing ? 'updated' : 'created', message: `${name} → ${content}` };
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
  const host = opts.domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();
  const results: DnsResult[] = [];
  results.push(await upsertDnsRecord({ zoneId: opts.zoneId, token: opts.token, type: 'A', name: host, content: opts.serverIp, proxied: opts.proxied }));
  if (opts.www) {
    results.push(await upsertDnsRecord({ zoneId: opts.zoneId, token: opts.token, type: 'A', name: `www.${host}`, content: opts.serverIp, proxied: opts.proxied }));
  }
  return results;
}
