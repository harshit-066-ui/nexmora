'use client';

import { useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import ChatWindow from '@/components/ChatWindow';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function ChatRoomPage() {
  const params = useParams();
  const roomId = params?.roomId as string;

  const { profile } = useAuth();
  const { onlineUsers } = useWebSocket();
  const {
    rooms,
    getMessages,
    isSending,
    fetchMessages,
    sendMessage,
    deleteChat,
    editMessage,
    deleteMessage,
    fetchRooms,
  } = useChat(roomId);

  // ── RULE 6: Sync messages whenever roomId changes ───────────────────────────
  useEffect(() => {
    if (!roomId) return;
    fetchMessages(roomId);
  }, [roomId, fetchMessages]);

  // ── Fetch rooms on mount (needed for room name resolution) ─────────────────
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const messages = getMessages(roomId);

  // ── RULE 4: Force safe room name resolution ───────────────────────────────
  const activeRoomInfo = useMemo(() => {
    const activeRoom = (rooms ?? []).find(r => r?.id === roomId) || null;

    if (!activeRoom) return { name: '', isOnline: false };

    if (activeRoom.is_group) {
      return { name: activeRoom.name || 'Group Chat', isOnline: false };
    }

    // Find the OTHER participant
    const otherParticipant = (activeRoom.participants ?? []).find(p => {
      const pid = p.user_id ?? p.id;
      return pid !== profile?.id;
    });

    const roomName =
      otherParticipant?.username ||
      otherParticipant?.profile?.username ||
      otherParticipant?.user?.username ||
      activeRoom?.name ||
      'Unknown User';

    const otherId = otherParticipant?.user_id ?? otherParticipant?.id;
    const isOnline = otherId ? onlineUsers.has(otherId) : false;

    return { name: roomName, isOnline };
  }, [rooms, roomId, profile?.id, onlineUsers]);

  // ── Empty state: no room selected ─────────────────────────────────────────
  if (!roomId) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          gap: '1rem',
        }}
      >
        <div style={{ fontSize: '3rem' }}>💬</div>
        <p style={{ color: 'white' }}>Select a chat or start a new one</p>
      </div>
    );
  }

  // ── ✅ NO CONDITIONALS BLOCKING RENDER (Modern UX) ───────────────────────
  // We rely on getMessages(roomId) returning the cached array. 
  // If empty, ChatWindow handles the "No messages" display.
  return (
    <div style={{ height: '100%' }}>
      <ChatWindow
        messages={messages}
        onSendMessage={(content) => sendMessage(roomId, content)}
        onDeleteMessage={deleteMessage}
        onUpdateMessage={editMessage}
        onDeleteChat={deleteChat}
        isSending={isSending}
        activeRoomName={activeRoomInfo.name || '\u200B'}
        isOnline={activeRoomInfo.isOnline}
      />
    </div>
  );
}
