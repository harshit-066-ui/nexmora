'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ChatWindow from '@/components/ChatWindow';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';

/**
 * ChatRoomPage - Portfolio Grade Room Container
 * Handles the logic for selecting and rendering a specific chat room.
 */
export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.roomId as string;
  
  const { profile, loading: authLoading } = useAuth();
  const { onlineUserIds } = useWebSocket();
  const { 
    rooms, 
    messages, 
    isSending, 
    fetchMessages, 
    sendMessage 
  } = useChat();

  const [loadingMessages, setLoadingMessages] = useState(true);

  // 1. SYNC MESSAGES ON ROOM CHANGE
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!roomId) return;
      try {
        setLoadingMessages(true);
        await fetchMessages(roomId);
      } catch (err) {
        console.error('Failed to sync room history:', err);
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [roomId, fetchMessages]);

  // 2. RESOLVE ACTIVE ROOM DATA
  const activeRoom = useMemo(() => {
    return (rooms ?? []).find(r => r?.id === roomId) || null;
  }, [rooms, roomId]);

  const activeRoomInfo = useMemo(() => {
    // Zero-width space placeholder to prevent "flicker" while loading metadata
    if (!activeRoom) return { name: '\u200B', id: null, isOnline: false };
    
    if (activeRoom.is_group) return { name: activeRoom.name || 'Group Chat', id: null, isOnline: false };
    
    const otherParticipant = (activeRoom.participants ?? []).find(p => p?.id !== profile?.id);
    const isOnline = otherParticipant ? onlineUserIds.has(otherParticipant.id) : false;

    return { 
      name: otherParticipant?.username || 'Private Chat',
      id: otherParticipant?.id,
      isOnline
    };
  }, [activeRoom, profile?.id, onlineUserIds]);

  // 3. RENDER LOGIC
  
  // Guard: No room selected (Empty state)
  if (!roomId) {
    return (
      <div className="flex-center" style={{ height: '100%', color: 'var(--muted)', background: 'var(--background)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
          <h3 style={{ color: 'var(--foreground)', fontWeight: '600' }}>Nexmora Chat</h3>
          <p style={{ fontSize: '0.875rem' }}>Select a chat to view messages</p>
        </div>
      </div>
    );
  }

  // Guard: Loading Spinner (Only for initial fetch)
  if (loadingMessages && messages.length === 0) {
    return (
      <div className="flex-center" style={{ height: '100%', background: 'var(--background)' }}>
        <div className="flex-center" style={{ flexDirection: 'column', gap: '1rem' }}>
          <div className="animate-spin" style={{ width: '24px', height: '24px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Syncing...</span>
        </div>
      </div>
    );
  }

  // Final Render: ChatWindow always visible to avoid "Blank Screen"
  return (
    <div style={{ height: '100%', background: 'var(--background)' }}>
      <ChatWindow 
        messages={messages}
        onSendMessage={(content) => sendMessage(roomId, content)}
        isSending={isSending}
        activeRoomName={activeRoomInfo.name}
        isOnline={activeRoomInfo.isOnline} 
      />
    </div>
  );
}
