'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ChatProfile } from '../../../shared/types';
import { X, User as UserIcon, Loader2, Search, Check, Users, MessageSquare } from 'lucide-react';

interface CreateChatModalProps {
  onClose: () => void;
  onChatCreated: (roomId: string) => void;
  existingRooms?: any[]; // For room existence check
}

type Mode = 'single' | 'group';
type Step = 'CHOOSE_MODE' | 'SELECT_USERS' | 'GROUP_DETAILS';

export default function CreateChatModal({ onClose, onChatCreated, existingRooms = [] }: CreateChatModalProps) {
  const { session } = useAuth();
  const { onlineUsers } = useWebSocket();
  
  // UX State
  const [mode, setMode] = useState<Mode>('single');
  const [step, setStep] = useState<Step>('CHOOSE_MODE');
  
  const [users, setUsers] = useState<ChatProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  
  // Selection state
  const [selectedUsers, setSelectedUsers] = useState<ChatProfile[]>([]); 
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');

  const currentUserId = session?.user?.id;

  useEffect(() => {
    async function fetchUsers() {
      if (!currentUserId) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('chat_profiles')
          .select('id, username, avatar_url')
          .neq('id', currentUserId)
          .order('username');

        if (error || !Array.isArray(data)) {
          setUsers([]);
          return;
        }
        setUsers(data as ChatProfile[]);
      } catch (err) {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [currentUserId]);

  const filteredUsers = useMemo(() => {
    const safeUsers = Array.isArray(users) ? users : [];
    if (!search.trim()) return safeUsers;
    return safeUsers.filter(u => 
      u?.username?.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  // ✅ Selection stability fix
  const toggleUser = (user: ChatProfile) => {
    setSelectedUsers(prev => {
      const exists = prev.some(u => u.id === user.id);
      if (exists) {
        return prev.filter(u => u.id !== user.id);
      }
      return [...prev, user];
    });
  };

  const handleAction = async (targetUser?: ChatProfile) => {
    if (creating || !session) return;
    
    // 🟣 SINGLE CHAT FLOW
    if (mode === 'single' && targetUser) {
        const existing = existingRooms.find(r => 
            !r.is_group && 
            r.participants.some((p: any) => p.id === targetUser.id)
        );

        if (existing) {
            onChatCreated(existing.id);
            onClose();
            return;
        }

        await executeCreate([targetUser.id]);
        return;
    }

    // GROUP SELECT NEXT
    if (mode === 'group' && step === 'SELECT_USERS') {
        if (selectedUsers.length < 2) {
            alert("Select at least 2 users for group chat");
            return;
        }
        setStep('GROUP_DETAILS');
        return;
    }

    // FINAL GROUP CREATE
    if (mode === 'group' && step === 'GROUP_DETAILS') {
        if (!groupName.trim()) {
            alert("Group name is required");
            return;
        }
        await executeCreate(selectedUsers.map(u => u.id), true);
    }
  };

  const executeCreate = async (participantIds: string[], isGroup = false) => {
    try {
      setCreating(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/chat/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          participantIds,
          name: isGroup ? groupName.trim() : null,
          description: isGroup ? description.trim() : null,
          isGroup
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
      console.error('Create Error:', err);
      alert('A network error occurred');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ 
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', 
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', 
        justifyContent: 'center', zIndex: 1000, padding: '1rem' 
    }}>
      <div 
        className="glass animate-fade-in" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          width: '100%', maxWidth: '460px', padding: '1.5rem', borderRadius: '1.25rem', 
          backgroundColor: 'var(--card)', border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', maxHeight: '90vh',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             {step !== 'CHOOSE_MODE' && (
                 <button onClick={() => setStep('CHOOSE_MODE')} style={{ background: 'transparent', color: 'var(--muted)', cursor: 'pointer', border: 'none', fontSize: '1.25rem' }}>←</button>
             )}
             <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>
                    {step === 'GROUP_DETAILS' ? 'Group Details' : 'New Messaging'}
                </h2>
                {/* ✅ Online Count Indicator */}
                <p style={{ fontSize: '0.75rem', color: '#10b981' }}>
                    Online ({onlineUsers.size})
                </p>
             </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--muted)', cursor: 'pointer', border: 'none' }}>
            <X size={22} />
          </button>
        </div>

        {step === 'CHOOSE_MODE' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button 
                onClick={() => { setMode('single'); setStep('SELECT_USERS'); }}
                className="mode-card"
                style={{ 
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem',
                    borderRadius: '1rem', border: '1px solid var(--border)', backgroundColor: 'rgba(255,255,255,0.02)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease'
                }}
              >
                 <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                    <MessageSquare size={24} />
                 </div>
                 <div>
                    <h3 style={{ fontWeight: '600', color: 'white' }}>Direct Message</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Chat one-on-one</p>
                 </div>
              </button>

              <button 
                onClick={() => { setMode('group'); setStep('SELECT_USERS'); }}
                className="mode-card"
                style={{ 
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem',
                    borderRadius: '1rem', border: '1px solid var(--border)', backgroundColor: 'rgba(255,255,255,0.02)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease'
                }}
              >
                 <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                    <Users size={24} />
                 </div>
                 <div>
                    <h3 style={{ fontWeight: '600', color: 'white' }}>Group Conversation</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Talk with multiple people</p>
                 </div>
              </button>
           </div>
        )}

        {step === 'SELECT_USERS' && (
          <>
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} size={16} />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
                style={{
                  width: '100%', padding: '0.625rem 1rem 0.625rem 2.5rem',
                  backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                  borderRadius: '0.75rem', outline: 'none', color: 'white', fontSize: '0.875rem'
                }}
              />
            </div>

            {/* ✅ SCROLLABLE USER LIST */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', maxHeight: '320px', paddingRight: '0.5rem' }}>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto', color: 'var(--primary)' }} />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No users found</div>
              ) : filteredUsers.map((user) => {
                const isSelected = selectedUsers.some(u => u.id === user.id);
                const isOnline = onlineUsers.has(user.id);
                return (
                  <div 
                    key={user.id}
                    onClick={() => mode === 'group' ? toggleUser(user) : handleAction(user)}
                    style={{ 
                      padding: '0.75rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem',
                      cursor: 'pointer', backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                      marginBottom: '2px', transition: 'all 0.2s ease'
                    }}
                    className="user-item-row"
                  >
                    <div style={{ position: 'relative' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserIcon size={20} color="var(--muted)" />
                        </div>
                        {/* 🟢 Indicator */}
                        {isOnline ? (
                            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, backgroundColor: '#10b981', border: '2px solid var(--card)', borderRadius: '50%' }} />
                        ) : (
                            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, backgroundColor: '#374151', border: '2px solid var(--card)', borderRadius: '50%' }} />
                        )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '600', fontSize: '0.9375rem', color: isSelected ? 'white' : 'var(--gray-200)' }} className="text-gray-200">{user.username}</p>
                      <p style={{ fontSize: '0.75rem', color: isOnline ? '#10b981' : 'var(--muted)' }}>
                        {isOnline ? 'Online' : 'Offline'}
                      </p>
                    </div>
                    {mode === 'group' && (
                        <div style={{ 
                            width: '20px', height: '20px', borderRadius: '4px', border: '2px solid' + (isSelected ? ' var(--primary)' : ' var(--border)'),
                            backgroundColor: isSelected ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {isSelected && <Check size={14} color="white" />}
                        </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer (only group) */}
            {mode === 'group' && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Selected: <b style={{ color: 'white' }}>{selectedUsers.length}</b></span>
                    {selectedUsers.length > 0 && (
                        <button onClick={() => setSelectedUsers([])} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '0.8125rem' }}>
                            Clear
                        </button>
                    )}
                </div>
                <button 
                  onClick={() => handleAction()}
                  disabled={selectedUsers.length < 2}
                  style={{
                    padding: '0.75rem 1.75rem', borderRadius: '0.75rem', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', border: 'none',
                    cursor: selectedUsers.length < 2 ? 'not-allowed' : 'pointer', opacity: selectedUsers.length < 2 ? 0.5 : 1,
                    boxShadow: selectedUsers.length >= 2 ? '0 10px 15px -3px rgba(139, 92, 246, 0.3)' : 'none'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {step === 'GROUP_DETAILS' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: '600' }}>GROUP NAME</label>
                  <input autoFocus type="text" placeholder="Enter group name..." value={groupName} onChange={(e) => setGroupName(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', outline: 'none', color: 'white' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: '600' }}>DESCRIPTION (OPTIONAL)</label>
                  <textarea placeholder="Group description..." value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', outline: 'none', color: 'white', minHeight: '80px', resize: 'none' }} />
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button onClick={() => setStep('SELECT_USERS')} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', cursor: 'pointer' }}>Back</button>
                  <button 
                    onClick={() => handleAction()}
                    disabled={creating || !groupName.trim()}
                    style={{
                      flex: 2, padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', border: 'none',
                      cursor: (creating || !groupName.trim()) ? 'not-allowed' : 'pointer', opacity: (creating || !groupName.trim()) ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      boxShadow: groupName.trim() ? '0 10px 15px -3px rgba(139, 92, 246, 0.3)' : 'none'
                    }}
                  >
                    {creating && <Loader2 size={18} className="animate-spin" />}
                    Create Group
                  </button>
              </div>
           </div>
        )}
      </div>

      <style jsx>{`
        .mode-card:hover {
          background-color: rgba(255,255,255,0.08) !important;
          border-color: var(--primary) !important;
          transform: translateY(-2px);
        }
        .user-item-row:hover {
          background-color: rgba(255,255,255,0.06) !important;
        }
        .search-input::placeholder {
           color: #9ca3af;
        }
        .custom-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .text-gray-200 {
            color: #e5e7eb;
        }
      `}</style>
    </div>
  );
}
