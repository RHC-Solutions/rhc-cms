import { redirect } from 'next/navigation';

// Cloudflare API credentials are now managed in the single Integrations catalog
// (the site database) at Settings → Integrations → "Cloudflare", instead of this
// page's separate .env writer. Forward there (PR6). The operational
// Cloudflare dashboard stays at /admin/cloudflare.
export default function CloudflareSetupRedirect() {
  redirect('/admin/settings?tab=integrations');
}
