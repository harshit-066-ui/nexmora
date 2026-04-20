'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import ChatWindow from '@/components/ChatWindow';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { supabase } from '@/lib/supabase';

export default function ChatRoomPage() {
  const params = useParams();
  const roomId = params?.roomId as string;

  const { profile } = useAuth();
  const { onlineUserIds } = useWebSocket();
  const {
    rooms,
    getMessages,
    isSending,
    isLoadingMessages,
    fetchMessages,
    sendMessage,
    clearRoomMessages,
    applyIncomingMessage,
    fetchRooms,
  } = useChat();

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [channelReady, setChannelReady] = useState(false);
  const bufferRef = useRef<any[]>([]);

  // ── RULE 6: Reset messages when room changes ──────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    clearRoomMessages(roomId);
    setInitialLoaded(false);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch rooms on mount (needed for room name resolution) ─────────────────
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // ── Load messages whenever roomId changes ──────────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    fetchMessages(roomId).then(() => {
      if (!cancelled) setInitialLoaded(true);
    });

    return () => { cancelled = true; };
  }, [roomId, fetchMessages]);

  // ── RULE 3: Fix missing dependency re-subscription (Supabase real-time) ────
  useEffect(() => {
    if (!roomId) return;

    let isReady = false;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        if (payload.new.chat_id !== roomId) return;
        
        if (!isReady) {
          bufferRef.current.push(payload.new);
          return;
        }
        
        applyIncomingMessage(payload.new);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isReady = true;
          setChannelReady(true);
        }
      });

    return () => {
      isReady = false;
      setChannelReady(false);
      supabase.removeChannel(channel);
    };
  }, [roomId, applyIncomingMessage]);

  // ── Flush buffered messages when channel becomes ready ────────────────────
  useEffect(() => {
    if (channelReady && bufferRef.current.length > 0) {
      bufferRef.current.forEach(msg => applyIncomingMessage(msg));
      bufferRef.current = [];
    }
  }, [channelReady, applyIncomingMessage]);

  // ── Get messages for current room directly – no activeRoomId lock ──────────
  const messages = getMessages(roomId);

  // ── RULE 4: Force safe room name resolution ───────────────────────────────
  const activeRoomInfo = useMemo(() => {
    const activeRoom = (rooms ?? []).find(r => r?.id === roomId) || null;

    if (!activeRoom) return { name: '', isOnline: false };

    if (activeRoom.is_group) {
      return { name: activeRoom.name || 'Group Chat', isOnline: false };
    }

    // Find the OTHER participant — handle both id and user_id shapes
    const otherParticipant = (activeRoom.participants ?? []).find(p => {
      const pid = p.user_id ?? p.id;
      return pid !== profile?.id;
    });

    // ── RULE 4 username cascade ───────────────────────────────────────────
    const roomName =
      otherParticipant?.username ||
      otherParticipant?.profile?.username ||
      otherParticipant?.user?.username ||
      activeRoom?.name ||
      'Unknown User';

    const otherId = otherParticipant?.user_id ?? otherParticipant?.id;
    const isOnline = otherId ? onlineUserIds.includes(otherId) : false;

    return { name: roomName, isOnline };
  }, [rooms, roomId, profile?.id, onlineUserIds]);

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
        <p>Select a chat or start a new one</p>
      </div>
    );
  }

  // ── Loading state: first fetch still in progress AND no messages yet ───────
  if (!initialLoaded && isLoadingMessages && messages.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '2px solid var(--primary)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span>Loading messages...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%' }}>
      <ChatWindow
        messages={messages}
        onSendMessage={(content) => sendMessage(roomId, content)}
        isSending={isSending}
        activeRoomName={activeRoomInfo.name || '\u200B'}
        isOnline={activeRoomInfo.isOnline}
      />
    </div>
  );
}
