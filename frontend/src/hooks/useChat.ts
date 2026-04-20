'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useWebSocket } from './useWebSocket';
import { useAuth } from './useAuth';

// ─── Shared Types (local to avoid broken relative imports) ───────────────────
export interface NormalizedSender {
  id: string;
  username: string;
  avatar_url: string | null;
}

export interface NormalizedMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  status?: string;
  is_edited?: boolean;
  is_deleted?: boolean;
  edited_at?: string | null;
  sender: NormalizedSender;
}

export interface NormalizedRoom {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: string;
  participants: any[];
  last_message?: NormalizedMessage;
}

// ─── GLOBAL NORMALIZER — SINGLE SOURCE OF TRUTH ──────────────────────────────
// Every message from ANY source (fetch, websocket, optimistic) passes through here.
const normalizeMessage = (msg: any): NormalizedMessage => ({
  id: msg.id,
  chat_id: msg.chat_id,
  sender_id: msg.sender_id || msg.sender?.id || '',
  content: msg.content,
  created_at: msg.created_at,
  status: msg.status,
  is_edited: msg.is_edited ?? false,
  is_deleted: msg.is_deleted ?? false,
  edited_at: msg.edited_at ?? null,
  sender: {
    id: msg.sender?.id || msg.sender_id || msg.user_id || '',
    username:
      msg.sender?.username ||
      msg.profile?.username ||
      msg.user?.username ||
      msg.username ||
      'Unknown',
    avatar_url:
      msg.sender?.avatar_url ||
      msg.profile?.avatar_url ||
      msg.avatar_url ||
      null,
  },
});

// ─── safeArray helper ─────────────────────────────────────────────────────────
function safeArray<T>(val: T[] | undefined | null): T[] {
  return Array.isArray(val) ? val : [];
}

// ─── useChat Hook ─────────────────────────────────────────────────────────────
export function useChat() {
  const { profile, session } = useAuth();
  const { isConnected, subscribe, sendMessage: wsSendMessage } = useWebSocket();

  const [rooms, setRooms] = useState<NormalizedRoom[]>([]);
  // messages keyed by roomId — never depends on activeRoomId
  const [messageMap, setMessageMap] = useState<Record<string, NormalizedMessage[]>>({});
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // ── 1. FETCH ROOMS ──────────────────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      setIsLoadingRooms(true);
      const { data, error } = await supabase
        .from('chat_participants')
        .select(`
          chat_id,
          chat_rooms (
            *,
            chat_participants (
              user_id,
              chat_profiles (id, username, avatar_url)
            ),
            chat_messages (
              id, content, created_at, sender_id,
              sender:chat_profiles (id, username, avatar_url)
            )
          )
        `)
        .eq('user_id', session.user.id);

      if (error) throw error;

      const mappedRooms: NormalizedRoom[] = (data || [])
        .map((item: any) => {
          const room = item.chat_rooms;
          if (!room) return null;

          // Flatten participants — handle both nested and flat shapes
          const participants = (room.chat_participants || []).map((p: any) => ({
            id: p.chat_profiles?.id || p.user_id,
            user_id: p.user_id,
            username: p.chat_profiles?.username || 'Unknown',
            avatar_url: p.chat_profiles?.avatar_url || null,
          }));

          // Sort messages and grab the latest
          const sortedMessages = (room.chat_messages || []).sort(
            (a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          return {
            id: room.id,
            name: room.name,
            is_group: room.is_group ?? false,
            created_at: room.created_at,
            participants,
            last_message: sortedMessages[0]
              ? normalizeMessage(sortedMessages[0])
              : undefined,
          };
        })
        .filter(Boolean) as NormalizedRoom[];

      setRooms(mappedRooms);
    } catch (err) {
      console.error('🔥 FETCH_ROOMS_ERROR:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, [session?.user?.id]);

  // ── 2. FETCH MESSAGES ───────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (roomId: string) => {
    if (!roomId) return;

    try {
      setIsLoadingMessages(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, sender:chat_profiles(id, username, avatar_url)')
        .eq('chat_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const serverMsgs = (data || []).map(normalizeMessage);

      setMessageMap(prev => {
        // Preserve any temp (optimistic) messages not yet confirmed
        const existing = safeArray<NormalizedMessage>(prev[roomId]);
        const tempOnly = existing.filter(m => m.id.startsWith('temp-'));

        const combined = [...serverMsgs, ...tempOnly];
        const unique = combined.filter(
          (msg, idx, self) => idx === self.findIndex(t => t.id === msg.id)
        );
        const sorted = unique.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        return { ...prev, [roomId]: sorted };
      });
    } catch (err) {
      console.error('🔥 FETCH_MESSAGES_ERROR:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // ── Centralized Message Applier ─────────────────────────────────────────────
  const applyIncomingMessage = useCallback((rawMsg: any) => {
    const incoming = normalizeMessage(rawMsg);

    setMessageMap(prev => {
      const history = safeArray<NormalizedMessage>(prev[incoming.chat_id]);

      // De-duplicate by ID
      if (history.some(m => m.id === incoming.id)) {
        return { ...prev }; // Force UI re-render safety
      }

      // Try to replace a matching optimistic message
      let replaced = false;
      const updated = history.map(m => {
        if (
          !replaced &&
          (m.id === incoming.id || 
           (m.id.startsWith('temp-') && m.content === incoming.content && m.sender_id === incoming.sender_id))
        ) {
          replaced = true;
          return incoming;
        }
        return m;
      });

      if (replaced) {
        return { ...prev, [incoming.chat_id]: [...updated] };
      }
      return { ...prev, [incoming.chat_id]: [...updated, incoming] };
    });

    // Update sidebar last_message preview
    setRooms(prev =>
      [...prev].map(r =>
        r.id === incoming.chat_id ? { ...r, last_message: incoming } : r
      )
    );
  }, []);

  // ── 3. SEND MESSAGE (Optimistic UI) ────────────────────────────────────────
  const sendMessage = useCallback(
    async (roomId: string, content: string) => {
      if (!roomId || !content?.trim() || !profile) return;

      const tempId = `temp-${crypto.randomUUID()}`;
      const optimisticMsg = normalizeMessage({
        id: tempId,
        chat_id: roomId,
        sender_id: profile.id,
        content: content.trim(),
        status: 'sending',
        is_edited: false,
        is_deleted: false,
        edited_at: null,
        created_at: new Date().toISOString(),
        sender: {
          id: profile.id,
          username: profile.username || 'You',
          avatar_url: profile.avatar_url || null,
        },
      });

      // Instant UI feedback
      applyIncomingMessage(optimisticMsg);

      try {
        setIsSending(true);
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({
            chat_id: roomId,
            sender_id: profile.id,
            content: content.trim(),
            status: 'sent',
          })
          .select('*, sender:chat_profiles(id, username, avatar_url)')
          .single();

        if (error) throw error;

        if (data) {
          // Replace optimistic message with confirmed server record
          applyIncomingMessage(data);
        }
      } catch (err) {
        console.error('🔥 SEND_MESSAGE_ERROR:', err);
        // Rollback optimistic message on failure
        setMessageMap(prev => ({
          ...prev,
          [roomId]: safeArray<NormalizedMessage>(prev[roomId]).filter(
            m => m.id !== tempId
          ),
        }));
      } finally {
        setIsSending(false);
      }
    },
    [profile]
  );

  // ── 4. REAL-TIME — WebSocket handler ───────────────────────────────────────
  useEffect(() => {
    if (!isConnected) return;

    // Join all current rooms
    rooms.forEach(room => wsSendMessage('join_room', { room_id: room.id }));

    const unsubscribe = subscribe('new_message', (payload: any) => {
      const raw = payload.message;
      const senderOverride = payload.sender;
      if (!raw || !raw.chat_id) return;

      applyIncomingMessage({
        ...raw,
        sender: senderOverride || raw.sender,
      });
    });

    return unsubscribe;
  }, [isConnected, rooms.length, subscribe, wsSendMessage]);

  // ── 5. CLEAR ROOM (on navigation) ──────────────────────────────────────────
  const clearRoomMessages = useCallback((roomId: string) => {
    setMessageMap(prev => ({ ...prev, [roomId]: [] }));
  }, []);

  // ── Expose getMessages by roomId (no activeRoomId lock) ───────────────────
  const getMessages = useCallback(
    (roomId: string): NormalizedMessage[] =>
      safeArray<NormalizedMessage>(messageMap[roomId]),
    [messageMap]
  );

  return {
    rooms,
    messageMap,
    getMessages,
    isLoadingRooms,
    isLoadingMessages,
    isSending,
    fetchRooms,
    fetchMessages,
    sendMessage,
    clearRoomMessages,
    applyIncomingMessage,
  };
}
