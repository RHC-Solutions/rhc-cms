import { redirect } from 'next/navigation';

// Integrations were consolidated into the single Settings hub (PR6). This route
// now just forwards there so old links/bookmarks keep working.
export default function IntegrationsRedirect() {
  redirect('/admin/settings?tab=integrations');
}
