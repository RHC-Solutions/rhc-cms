import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import ThemeProvider from "@/components/ThemeProvider";
import { JsonLd, organizationLd, websiteLd } from "@/components/JsonLd";
import { promises as fs } from 'fs';
import path from 'path';

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ['400', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ['400'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  preload: false,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://rhcsolutions.com'),
  title: {
    default: "RHC Solutions - IT Consulting & Professional Services",
    template: "%s | RHC Solutions"
  },
  description: "Since 1994, RHC Solutions provides expert IT consulting, cloud infrastructure, cyber security, business continuity, and professional services. We Just Do IT.",
  keywords: ["IT consulting", "cloud infrastructure", "cyber security", "business continuity", "IT support", "project management", "AWS", "Azure", "GCP"],
  authors: [{ name: "RHC Solutions" }],
  alternates: { canonical: '/' },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://rhcsolutions.com",
    siteName: "RHC Solutions",
    title: "RHC Solutions - IT Consulting & Professional Services",
    description: "Since 1994, RHC Solutions provides expert IT consulting, cloud infrastructure, cyber security, business continuity, and professional services.",
    images: [
      {
        url: "/api/og?title=RHC%20Solutions&description=IT%20consulting%2C%20cloud%2C%20cyber%20security%20%26%20business%20continuity%20since%201994.",
        width: 1200,
        height: 630,
        alt: "RHC Solutions"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "RHC Solutions - IT Consulting & Professional Services",
    description: "Since 1994, RHC Solutions provides expert IT consulting, cloud infrastructure, cyber security, and business continuity services.",
    images: ["/api/og?title=RHC%20Solutions&description=IT%20consulting%2C%20cloud%2C%20cyber%20security%20%26%20business%20continuity%20since%201994."]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

async function getTheme() {
  try {
    const themePath = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'theme.json');
    const data = await fs.readFile(themePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function getSeoSettings() {
  try {
    const seoPath = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'seo.json');
    const data = await fs.readFile(seoPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function readJson(filename: string) {
  try {
    const p = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', filename);
    const data = await fs.readFile(p, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [theme, seoSettings, siteSettings, cookieSettings, footerData, pages] = await Promise.all([
    getTheme(),
    getSeoSettings(),
    readJson('settings.json'),
    readJson('cookies.json'),
    readJson('footer.json'),
    readJson('pages.json'),
  ]);
  const faviconUrl = theme?.branding?.favicon || '/logo.png';
  const initialNav = (siteSettings?.navigation || [])
    .filter((item: any) => item.visible !== false)
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  const pagesArray = Array.isArray(pages) ? pages : (pages?.pages || []);
  const initialFooterPages = pagesArray
    .filter((p: any) => p?.showInFooter && p?.status === 'published')
    .map((p: any) => ({ name: p.title, href: p.slug }));
  const gtmId = seoSettings?.googleTagManagerId || process.env.NEXT_PUBLIC_GTM_ID;
  const ahrefsDataKey = seoSettings?.ahrefsDataKey;
  const ahrefsInstallMethod = seoSettings?.ahrefsInstallMethod || 'direct';
  const hotjarSiteId = seoSettings?.hotjarSiteId;
  const contentsquareScriptUrl = seoSettings?.contentsquareScriptUrl;
  const gscVerification = seoSettings?.googleSearchConsoleVerification;

  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        {/* fonts.googleapis.com / fonts.gstatic.com preconnects intentionally
            omitted — next/font/google self-hosts woff2 from /_next/static, so
            those origins are never hit and PSI flags them as unused. */}
        {gtmId && <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />}
        {gtmId && <link rel="preconnect" href="https://www.google-analytics.com" crossOrigin="anonymous" />}
        {ahrefsDataKey && <link rel="dns-prefetch" href="https://analytics.ahrefs.com" />}
        {hotjarSiteId && <link rel="dns-prefetch" href="https://static.hotjar.com" />}
        {contentsquareScriptUrl && <link rel="dns-prefetch" href="https://t.contentsquare.net" />}
        {gscVerification && <meta name="google-site-verification" content={gscVerification} />}
        <link rel="icon" href={faviconUrl} type="image/png" />
      </head>
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans bg-dark text-text-primary antialiased`}>
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        <GoogleAnalytics ga4Id={seoSettings?.googleAnalytics4Id || null} />
        {gtmId && (
          // GTM container tags run after-idle to keep TBT low. GA4 pageviews
          // still fire on time via the dedicated gtag loader in GoogleAnalytics.tsx.
          <Script id="gtm-loader" strategy="lazyOnload">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
          </Script>
        )}
        {ahrefsDataKey && ahrefsInstallMethod === 'direct' && (
          <Script
            src="https://analytics.ahrefs.com/analytics.js"
            data-key={ahrefsDataKey}
            strategy="lazyOnload"
          />
        )}
        {ahrefsDataKey && ahrefsInstallMethod === 'gtm' && (
          <Script id="ahrefs-gtm-loader" strategy="lazyOnload">
            {`var ahrefs_analytics_script=document.createElement('script');ahrefs_analytics_script.async=true;ahrefs_analytics_script.src='https://analytics.ahrefs.com/analytics.js';ahrefs_analytics_script.setAttribute('data-key','${ahrefsDataKey}');document.getElementsByTagName('head')[0].appendChild(ahrefs_analytics_script);`}
          </Script>
        )}
        {hotjarSiteId && (
          <Script id="hotjar-loader" strategy="lazyOnload">
            {`(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${hotjarSiteId},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}
          </Script>
        )}
        {contentsquareScriptUrl && (
          <Script src={contentsquareScriptUrl} strategy="lazyOnload" />
        )}
        <JsonLd data={[organizationLd(siteSettings), websiteLd(siteSettings)]} />
        <ThemeProvider initialTheme={theme || null}>
          <LayoutWrapper
            initialSettings={siteSettings ? { siteName: siteSettings.siteName, tagline: siteSettings.tagline, bookingUrl: siteSettings.bookingUrl } : undefined}
            initialBranding={theme?.branding}
            initialNav={initialNav}
            initialCookieSettings={cookieSettings || undefined}
            initialFooterData={Array.isArray(footerData) ? footerData : undefined}
            initialFooterPages={initialFooterPages}
          >
            {children}
          </LayoutWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
