import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSecret } from '@adminpanel/lib/env';

/**
 * Aikido status proxy for /admin/aikido.
 *
 * - AIKIDO_API_TOKEN (preferred): a Public API token from Aikido →
 *   Settings → API. Has access to /api/public/v1/* endpoints (issues,
 *   teams, etc.) and can populate the dashboard.
 * - AIKIDO_IDE_TOKEN: an IDE-plugin token. Cannot read the public API;
 *   we only acknowledge its presence so admins know an IDE has been
 *   wired up.
 *
 * Both tokens are managed at /admin/integrations and stored in
 * cms-data/secrets.json; they never reach the browser — the admin
 * page calls this route, this route signs the outbound request.
 */

const AIKIDO_BASE = 'https://app.aikido.dev';

type IssueCounts = {
  total?: number;
  bySeverity?: Record<string, number>;
};

async function fetchIssueCounts(apiToken: string): Promise<{ ok: true; counts: IssueCounts } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(`${AIKIDO_BASE}/api/public/v1/issues/export?per_page=1&format=json`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: 'application/json',
      },
      // Aikido API is read-only and small; brief timeout to keep admin snappy.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: body.slice(0, 200) || res.statusText };
    }
    const data = await res.json();
    // The shape varies by Aikido endpoint version. We extract counts defensively.
    const items = Array.isArray(data) ? data : Array.isArray(data?.issues) ? data.issues : [];
    const total = typeof data?.total === 'number' ? data.total : items.length;
    const bySeverity: Record<string, number> = {};
    for (const i of items) {
      const sev = (i?.severity || i?.severity_label || 'unknown').toString().toLowerCase();
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }
    return { ok: true, counts: { total, bySeverity } };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(request: NextRequest) {
  const session = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!session || (session as any).role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 401 });
  }

  const apiToken = getSecret('AIKIDO_API_TOKEN');
  const ideToken = getSecret('AIKIDO_IDE_TOKEN');

  const result: Record<string, unknown> = {
    ideTokenConfigured: !!ideToken,
    apiTokenConfigured: !!apiToken,
    dashboardUrl: 'https://app.aikido.dev/',
    issuesUrl: 'https://app.aikido.dev/issues',
  };

  if (apiToken) {
    const fetched = await fetchIssueCounts(apiToken);
    if (fetched.ok) {
      result.counts = fetched.counts;
    } else {
      result.fetchError = `HTTP ${fetched.status}: ${fetched.error}`;
    }
  }

  return NextResponse.json(result);
}
