'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      // Not authenticated
      router.replace('/login');
    } else if (!profile && pathname !== '/register-profile') {
      // Authenticated but no profile, and not already on registration page
      router.replace('/register-profile');
    }
  }, [session, profile, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex-center min-vh-100 bg-dark">
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
      </div>
    );
  }

  // If not loading and has session + profile (or is currently on registration page)
  if (session && (profile || pathname === '/register-profile')) {
    return <>{children}</>;
  }

  // Return null while redirecting
  return null;
}
