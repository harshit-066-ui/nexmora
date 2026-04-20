'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/chat');
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', padding: '1rem' }}>
      <div className="glass animate-fade-in" style={{ padding: '2.5rem', width: '100%', maxWidth: '400px', borderRadius: '1rem' }}>
        <h1 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Create Account</h1>
        <p style={{ color: 'var(--muted)', marginBottom: '2rem', textAlign: 'center' }}>Join Nexmora Chat</p>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Username</label>
            <input 
              type="text" 
              placeholder="CoolUser42"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

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
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--muted)' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Login</Link>
        </p>
      </div>
    </div>
  );
}
