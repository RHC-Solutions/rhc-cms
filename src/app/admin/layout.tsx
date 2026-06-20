'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import SessionProvider from '@adminpanel/components/auth/SessionProvider';
import { Toast } from '@adminpanel/components/admin/Toast';

function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();

  useEffect(() => {
    // Paths the client-side gate must NOT bounce to /admin/login.
    // `/admin/setup` is critical: on first run there are no users, so the
    // login page itself redirects to /admin/setup — without it here, the two
    // pages ping-pong forever (login → setup → gate kicks back to login).
    const publicAdminPaths = ['/admin', '/admin/login', '/admin/mfa-setup', '/admin/setup'];
    const isPublicAdminPath = publicAdminPaths.includes(pathname || '');

    if (typeof window === 'undefined') return;

    if (!isPublicAdminPath && status === 'unauthenticated') {
      router.replace('/admin/login');
    }
  }, [pathname, router, status]);

  return (
    <>
      <Toast />
      {children}
    </>
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
