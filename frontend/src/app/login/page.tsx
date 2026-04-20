'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.replace('/chat');
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', padding: '1rem' }}>
      <div className="glass animate-fade-in" style={{ padding: '2.5rem', width: '100%', maxWidth: '400px', borderRadius: '1rem' }}>
        <h1 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Welcome Back</h1>
        <p style={{ color: 'var(--muted)', marginBottom: '2rem', textAlign: 'center' }}>Login to Nexmora Chat</p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Email</label>
            <input 
              type="email" 
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p style={{ color: 'var(--error)', fontSize: '0.875rem' }}>{error}</p>}

          <button 
            disabled={loading}
            style={{ 
              backgroundColor: 'var(--primary)', 
              color: 'white', 
              padding: '0.875rem',
              marginTop: '1rem',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--muted)' }}>
          Don&apos;t have an account? <Link href="/register" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Register</Link>
        </p>
      </div>
    </div>
  );
}
