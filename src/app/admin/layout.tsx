'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import SessionProvider from '@/components/auth/SessionProvider';
import { Toast } from '@/components/admin/Toast';

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
