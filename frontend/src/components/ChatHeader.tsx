'use client';

import { User as UserIcon, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface ChatHeaderProps {
  roomId: string;
  roomName: string;
  isOnline?: boolean;
  onDelete: (id: string) => void;
}

export default function ChatHeader({ roomId, roomName, isOnline = false, onDelete }: ChatHeaderProps) {
  const router = useRouter();

  const handleDeleteChat = () => {
    onDelete(roomId);
  };

  return (
    <div style={{ 
      padding: '1rem 1.5rem', 
      borderBottom: '1px solid var(--border)', 
      backgroundColor: 'var(--background)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      gap: '1rem' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ 
          position: 'relative', 
          width: '40px', 
          height: '40px', 
          borderRadius: '50%', 
          backgroundColor: 'var(--border)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <UserIcon size={20} color="var(--muted)" />
          {isOnline && (
            <div style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: '12px',
              height: '12px',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              border: '2px solid var(--background)'
            }} />
          )}
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', margin: 0, color: 'white' }}>{roomName}</h3>
          <p style={{ fontSize: '0.75rem', margin: 0, color: isOnline ? '#10b981' : 'var(--muted)' }}>
            {isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      <button 
        onClick={handleDeleteChat}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #ef4444',
          background: 'transparent',
          color: '#ef4444',
          cursor: 'pointer',
          fontSize: '0.875rem',
          transition: 'all 0.2s'
        }}
        className="delete-chat-btn"
      >
        <Trash2 size={16} />
        <span>Delete Chat</span>
      </button>

      <style jsx>{`
        .delete-chat-btn:hover {
          background-color: rgba(239, 68, 68, 0.1);
        }
      `}</style>
    </div>
  );
}
