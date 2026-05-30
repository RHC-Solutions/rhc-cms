'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

function readConsentState(): 'granted' | 'denied' | 'unknown' {
  try {
    const dnt =
      (typeof navigator !== 'undefined' && (navigator as any).doNotTrack === '1') ||
      (typeof window !== 'undefined' && (window as any).doNotTrack === '1');
    if (dnt) return 'denied';

    const raw = localStorage.getItem('cookieConsent');
    if (raw === null) return 'unknown';
    const parsed: string[] = JSON.parse(raw);
    return parsed.includes('analytics') ? 'granted' : 'denied';
  } catch {
    return 'unknown';
  }
}

export default function GoogleAnalytics({ ga4Id: ga4IdProp }: { ga4Id?: string | null } = {}) {
  const initial = ga4IdProp || process.env.NEXT_PUBLIC_GA4_ID || process.env.NEXT_PUBLIC_GA_ID || null;
  const [ga4Id, setGa4Id] = useState<string | null>(initial);

  useEffect(() => {
    if (ga4Id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/cms/seo');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setGa4Id(data.googleAnalytics4Id || null);
        }
      } catch {
        // already have fallback from env
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ga4Id]);

  useEffect(() => {
    if (!ga4Id) return;

    const apply = () => {
      const state = readConsentState();
      const granted = state === 'granted' ? 'granted' : 'denied';
      window.gtag?.('consent', 'update', {
        analytics_storage: granted,
        ad_storage: granted,
        ad_user_data: granted,
        ad_personalization: granted,
      });
    };

    const onChange = () => apply();
    window.addEventListener('cookieConsentChanged', onChange);
    window.addEventListener('storage', onChange);
    apply();

    return () => {
      window.removeEventListener('cookieConsentChanged', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [ga4Id]);

  if (!ga4Id) return null;

  return (
    <>
      <Script id="ga-consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            wait_for_update: 500
          });
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${ga4Id}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
