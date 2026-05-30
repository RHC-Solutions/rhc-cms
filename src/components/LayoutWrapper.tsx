'use client';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CookieConsent from '@/components/CookieConsent';

interface LayoutWrapperProps {
  children: React.ReactNode;
  initialSettings?: any;
  initialBranding?: any;
  initialNav?: any[];
  initialCookieSettings?: any;
  initialFooterData?: any[];
  initialFooterPages?: any[];
}

export default function LayoutWrapper({
  children,
  initialSettings,
  initialBranding,
  initialNav,
  initialCookieSettings,
  initialFooterData,
  initialFooterPages,
}: LayoutWrapperProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');
  const isLpRoute = pathname?.startsWith('/lp/') || pathname === '/lp';

  if (isAdminRoute || isLpRoute) {
    return <main className="min-h-screen bg-dark">{children}</main>;
  }

  return (
    <>
      <Header
        initialSettings={initialSettings}
        initialBranding={initialBranding}
        initialNav={initialNav}
      />
      <main className="min-h-screen bg-dark pt-20 lg:pt-24">{children}</main>
      <Footer
        initialSettings={initialSettings}
        initialBranding={initialBranding}
        initialFooterData={initialFooterData}
        initialFooterPages={initialFooterPages}
      />
      <CookieConsent initialSettings={initialCookieSettings} />
    </>
  );
}
