'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { LogOut, Plus, MessageSquare, Users, User as UserIcon } from 'lucide-react';
import { NormalizedRoom } from '@/hooks/useChat';
import { safeArray } from '@/lib/utils';

interface ChatSidebarProps {
  rooms: NormalizedRoom[];
  onlineUserIds: string[];
  activeRoomId?: string | null;
  onNewChat: () => void;
}

export default function ChatSidebar({ rooms, onlineUserIds, activeRoomId, onNewChat }: ChatSidebarProps) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const isUserOnline = (room: NormalizedRoom) => {
    if (room.is_group) return false;
    const currentUserId = profile?.id;
    const otherParticipant = safeArray<any>(room.participants).find(p => p.id !== currentUserId);
    return otherParticipant ? onlineUserIds.includes(otherParticipant.id) : false;
  };

  return (
    <div style={{ 
      width: '320px', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      borderRight: '1px solid var(--border)',
      backgroundColor: 'var(--background)'
    }}>
      {/* Header */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>Nexmora</h1>
          <button 
            onClick={onNewChat}
            style={{ 
              padding: '0.4rem', 
              borderRadius: '0.5rem', 
              backgroundColor: 'var(--primary)',
              color: 'white',
              display: 'flex',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Plus size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserIcon size={18} color="var(--muted)" />
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ fontWeight: '600', fontSize: '0.875rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {profile?.username || 'User'}
            </p>
          </div>
          <button 
            onClick={handleLogout} 
            title="Log out"
            style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.75rem', padding: '0 0.75rem' }}>
          Chats
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {safeArray<NormalizedRoom>(rooms).length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>
              <p style={{ fontSize: '0.8125rem' }}>No conversations yet</p>
            </div>
          ) : (
            safeArray<NormalizedRoom>(rooms).map((room) => {
              const isActive = room.id === activeRoomId;
              const online = isUserOnline(room);
              const otherParticipant = safeArray<any>(room.participants).find(p => p.id !== profile?.id);
              const roomName = room.name || otherParticipant?.username || 'Direct Message';
              const lastMsg = room.last_message;
              const isHovered = hoveredId === room.id;

              return (
                <div
                  key={room.id}
                  onClick={() => router.push(`/chat/${room.id}`)}
                  onMouseEnter={() => setHoveredId(room.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    padding: '0.625rem 0.75rem',
                    borderRadius: '0.625rem',
                    cursor: 'pointer',
                    backgroundColor: isActive 
                      ? 'rgba(139, 92, 246, 0.15)' 
                      : (isHovered ? 'rgba(255, 255, 255, 0.04)' : 'transparent'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <div style={{ 
                      width: '42px', 
                      height: '42px', 
                      borderRadius: '50%', 
                      backgroundColor: 'var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {room.is_group ? <Users size={20} color="var(--muted)" /> : <MessageSquare size={20} color="var(--muted)" />}
                    </div>
                    {!room.is_group && (
                      <div style={{ 
                        position: 'absolute', 
                        bottom: '1px', 
                        right: '1px', 
                        width: '10px', 
                        height: '10px', 
                        borderRadius: '50%',
                        backgroundColor: online ? '#10b981' : '#6b7280',
                        border: '2px solid var(--background)'
                      }} />
                    )}
                  </div>

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <p style={{ 
                        fontWeight: '500', 
                        fontSize: '0.875rem', 
                        color: isActive ? 'var(--primary)' : 'inherit', 
                        textOverflow: 'ellipsis', 
                        overflow: 'hidden', 
                        whiteSpace: 'nowrap' 
                      }}>
                        {roomName}
                      </p>
                      {lastMsg && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                          {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--muted)', 
                      textOverflow: 'ellipsis', 
                      overflow: 'hidden', 
                      whiteSpace: 'nowrap',
                      marginTop: '1px'
                    }}>
                      {lastMsg ? lastMsg.content : 'No messages yet'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
