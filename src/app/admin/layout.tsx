'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import SessionProvider from '@adminpanel/components/auth/SessionProvider';
import { Toast } from '@adminpanel/components/admin/Toast';
import '@adminpanel/styles/admin.css';

function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();

  useEffect(() => {
    const publicAdminPaths = ['/admin', '/admin/login', '/admin/mfa-setup'];
    const isPublicAdminPath = publicAdminPaths.includes(pathname || '');

    if (typeof window === 'undefined') return;

    if (!isPublicAdminPath && status === 'unauthenticated') {
      router.replace('/admin/login');
    }
  }, [pathname, router, status]);

  // `.adm` scopes the admin styles (src/styles/admin.css) to every admin
  // screen, including the ones without AdminShell (login, setup, MFA).
  return (
    <MotionConfig reducedMotion="user">
      <div className="adm min-h-screen">
        <Toast />
        {/* analytics, analytics/setup and settings/environment toast through
            react-hot-toast; without a mounted Toaster their messages never showed. */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--adm-surface-2)',
              color: 'var(--adm-text)',
              border: '1px solid var(--adm-border)',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#46E5A0', secondary: '#05140D' } },
            error: { iconTheme: { primary: '#FF6B7A', secondary: '#111832' } },
          }}
        />
        {children}
      </div>
    </MotionConfig>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AdminGate>{children}</AdminGate>
    </SessionProvider>
  );
}
