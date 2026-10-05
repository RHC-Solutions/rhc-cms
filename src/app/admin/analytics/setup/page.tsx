import { redirect } from 'next/navigation';

// The standalone Analytics "Setup" page wrote GA4 service-account creds to an
// .env file, duplicating the Integrations catalog. Those creds now live in the
// site database, edited at Settings → Integrations →
// "Google Analytics service account". Forward there (PR6).
export default function AnalyticsSetupRedirect() {
  redirect('/admin/settings?tab=integrations');
}
