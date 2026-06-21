import { redirect } from 'next/navigation';

// Cloudflare API credentials are now managed in the single Integrations catalog
// (secrets.json) at Settings → Integrations → "Cloudflare", instead of this
// page's separate .env.local writer. Forward there (PR6). The operational
// Cloudflare dashboard stays at /admin/cloudflare.
export default function CloudflareSetupRedirect() {
  redirect('/admin/settings?tab=integrations');
}
