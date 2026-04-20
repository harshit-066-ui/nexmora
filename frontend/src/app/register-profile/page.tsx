'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function RegisterProfilePage() {
  const { session, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If auth is loaded and session is missing, go to login
    if (!authLoading && !session) {
      router.replace('/login');
    }
    // If profile already exists, go to chat
    if (!authLoading && profile) {
      router.replace('/chat');
    }
  }, [session, profile, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const { error: insertError } = await supabase
        .from('chat_profiles')
        .insert({
          id: session?.user.id,
          username: username.trim(),
          avatar_url: null,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          setError('This username is already taken');
        } else {
          setError(insertError.message);
        }
        return;
      }

      // Success! useAuth will pick up the new profile
      router.replace('/chat');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex-center min-vh-100">
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
      </div>
    );
  }

  return (
    <div className="flex-center min-vh-100 bg-dark">
      <div className="glass p-8 w-100" style={{ maxWidth: '400px', borderRadius: '1.5rem' }}>
        <h1 className="h3 mb-2">Create your profile</h1>
        <p className="text-muted mb-6">Choose a username to start chatting</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="username" className="text-sm font-medium">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. janesmith"
              className="w-100 p-3 bg-dark border-border rounded-lg outline-none focus-border-primary"
              disabled={submitting}
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900-10 border-red-900-20 text-red-500 text-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-100 p-3 bg-primary text-white rounded-lg font-semibold hover-bg-primary-dark transition-colors flex-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Creating...
              </>
            ) : (
              'Start Chatting'
            )}
          </button>
        </form>
      </div>

      <style jsx>{`
        .bg-red-900-10 { background-color: rgba(239, 68, 68, 0.1); }
        .border-red-900-20 { border: 1px solid rgba(239, 68, 68, 0.2); }
        .focus-border-primary:focus { border-color: var(--primary); }
      `}</style>
    </div>
  );
}
