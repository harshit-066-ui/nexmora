'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { safeArray } from '@/lib/utils';
import { ChatProfile } from '../../../shared/types';
import { X, User as UserIcon, Loader2, Search } from 'lucide-react';

interface CreateChatModalProps {
  onClose: () => void;
  onChatCreated: (roomId: string) => void;
}

export default function CreateChatModal({ onClose, onChatCreated }: CreateChatModalProps) {
  const { session } = useAuth();
  const [users, setUsers] = useState<ChatProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const currentUserId = session?.user?.id;

  useEffect(() => {
    async function fetchUsers() {
      if (!currentUserId) {
        console.log("USER SESSION MISSING FOR USER FETCH (MODAL):", session);
        return;
      }
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('chat_profiles')
          .select('id, username, avatar_url')
          .neq('id', currentUserId);

        // Task 8: Debug Logging
        console.log("USERS RAW (MODAL):", data);
        
        if (error) {
          console.error("🔥 SUPABASE ERROR FULL (fetchUsers):", error);
          setUsers([]);
          return;
        }

        // Task 4: Explicit Array Validation
        if (!Array.isArray(data)) {
          console.warn("SUPABASE DATA IS NOT AN ARRAY:", data);
          setUsers([]);
          return;
        }

        setUsers(data as ChatProfile[]);

      } catch (err) {
        console.error("🔥 UNEXPECTED USER FETCH ERROR:", err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchUsers();
  }, [currentUserId]);

  const filteredUsers = useMemo(() => {
    // Task 4: ALWAYS safe array
    const safeUsers = Array.isArray(users) ? users : [];
    if (!search.trim()) return safeUsers;
    
    return safeUsers.filter(u => 
      u?.username?.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  const handleCreate = async (userId: string) => {
    if (!userId || creating || !session) return;
    
    try {
      setCreating(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/chat/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          participant_ids: [userId],
          is_group: false
        })
      });

      const response = await res.json();

      if (response?.success && response?.data?.id) {
        onChatCreated(response.data.id);
        onClose();
      } else {
        alert(response?.error || 'Failed to create chat');
      }
    } catch (err) {
      console.error('Create Chat Error:', err);
      alert('A network error occurred');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass animate-fade-in" 
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '440px', padding: '1.5rem', borderRadius: '1.25rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Start Conversation</h2>
          <button onClick={onClose} style={{ backgroundColor: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} size={16} />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.625rem 1rem 0.625rem 2.5rem',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              outline: 'none',
              fontSize: '0.875rem'
            }}
          />
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {loading ? (
            <div className="flex-center" style={{ padding: '2.5rem', flexDirection: 'column', gap: '1rem' }}>
              <Loader2 className="animate-spin" size={28} color="var(--primary)" />
              <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Loading users...</div>
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <div 
                key={user?.id || Math.random()}
                onClick={() => !creating && user?.id && handleCreate(user.id)}
                style={{ 
                  padding: '0.75rem', 
                  borderRadius: '0.75rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem',
                  cursor: (creating || !user?.id) ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
                className="user-item"
              >
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  backgroundColor: 'var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                  ) : (
                    <UserIcon size={20} color="var(--muted)" />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '600' }}>{user?.username || 'Unknown User'}</p>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.2 }}>👥</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No users found matching "{search}"</div>
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        .user-item:hover {
          background-color: rgba(139, 92, 246, 0.1);
        }
      `}</style>
    </div>
  );
}
