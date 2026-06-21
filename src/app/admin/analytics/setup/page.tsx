import { redirect } from 'next/navigation';

// The standalone Analytics "Setup" page wrote GA4 service-account creds to
// .env.local, duplicating the Integrations catalog (which stores them in
// secrets.json). Those creds now live in Settings → Integrations →
// "Google Analytics service account". Forward there (PR6).
export default function AnalyticsSetupRedirect() {
  redirect('/admin/settings?tab=integrations');
}
