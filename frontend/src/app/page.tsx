'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace('/login');
    } else if (!profile) {
      router.replace('/register-profile');
    } else {
      router.replace('/chat');
    }
  }, [session, profile, loading, router]);

  return (
    <div className="flex-center min-vh-100 bg-dark">
      <Loader2 className="animate-spin" size={32} color="var(--primary)" />
    </div>
  );
}
