'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useWebSocket } from './useWebSocket';
import { useAuth } from './useAuth';
import { useRouter } from 'next/navigation';

// ─── Shared Types ────────────────────────────────────────────────────────────
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

// ✅ 🎯 1. SAFE NORMALIZER (CRITICAL)
const normalizeMessage = (msg: any): NormalizedMessage => ({
  id: msg?.id ?? '',
  chat_id: msg?.chat_id ?? msg?.roomId ?? '',
  sender_id: msg?.sender_id ?? msg?.sender?.id ?? '',
  content: msg?.content ?? '',
  created_at: msg?.created_at ?? new Date().toISOString(),
  status: msg?.status ?? 'sent',
  is_edited: msg?.is_edited ?? false,
  is_deleted: msg?.is_deleted ?? false,
  edited_at: msg?.edited_at ?? null,
  sender: {
    id: msg?.sender?.id ?? msg?.sender_id ?? msg?.user_id ?? '',
    username: msg?.sender?.username ?? msg?.profile?.username ?? msg?.user?.username ?? msg?.username ?? 'Unknown',
    avatar_url: msg?.sender?.avatar_url ?? msg?.profile?.avatar_url ?? msg?.avatar_url ?? null,
  },
});

function safeArray<T>(val: T[] | undefined | null): T[] {
  return Array.isArray(val) ? val : [];
}

// ─── useChat Hook ─────────────────────────────────────────────────────────────
export function useChat(activeChatId?: string) {
  const { profile, session, user } = useAuth();
  const { isConnected, subscribe, sendMessage: wsSendMessage } = useWebSocket();
  const router = useRouter();

  const [rooms, setRooms] = useState<NormalizedRoom[]>([]);
  const [messageMap, setMessageMap] = useState<Record<string, NormalizedMessage[]>>({});
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // ✅ 🎯 2. SAFE INSERT HANDLER
  const applyIncomingMessage = useCallback((rawMsg: any) => {
    const incoming = normalizeMessage(rawMsg);
    
    // Safety Guard
    if (!incoming.chat_id || !incoming.id) return;

    setMessageMap(prev => {
      const existing = prev[incoming.chat_id] || [];
      
      const alreadyExists = existing.some(m => m.id === incoming.id);
      
      if (alreadyExists) {
          return { ...prev }; 
      }

      // Time-based deduplication
      const isOverlap = existing.some(m => 
          m.content === incoming.content && 
          m.sender_id === incoming.sender_id && 
          Math.abs(new Date(m.created_at).getTime() - new Date(incoming.created_at).getTime()) < 2000
      );

      if (isOverlap) return prev;

      let replaced = false;
      const updated = existing.map(m => {
        if (!replaced && (m.id.startsWith('temp-') && m.content === incoming.content && m.sender_id === incoming.sender_id)) {
          replaced = true;
          return incoming;
        }
        return m;
      });

      return {
        ...prev,
        [incoming.chat_id]: replaced ? [...updated] : [...existing, incoming]
      };
    });

    setRooms(prev => prev.map(r => r.id === incoming.chat_id ? { ...r, last_message: incoming } : r));
  }, []);

  const applyRef = useRef(applyIncomingMessage);
  applyRef.current = applyIncomingMessage;

  // ✅ 🎯 3. SAFE UPDATE (EDIT MESSAGE)
  const handleUpdate = useCallback((rawMsg: any) => {
    const updated = normalizeMessage(rawMsg);
    
    if (!updated.chat_id || !updated.id) return;

    setMessageMap(prev => {
        const msgs = prev[updated.chat_id] || [];
        return {
            ...prev,
            [updated.chat_id]: msgs.map(m => m.id === updated.id ? { ...m, ...updated } : m)
        };
    });

    setRooms(prev => prev.map(r => r.id === updated.chat_id ? { ...r, last_message: updated } : r));
  }, []);

  // ✅ 🎯 4. SAFE DELETE MESSAGE
  const handleDelete = useCallback((oldMsg: any) => {
    if (!oldMsg?.chat_id || !oldMsg?.id) return;
    
    setMessageMap(prev => {
        const msgs = prev[oldMsg.chat_id] || [];
        return {
            ...prev,
            [oldMsg.chat_id]: msgs.filter(m => m.id !== oldMsg.id)
        };
    });

    setRooms(prev => prev.map(r => {
        if (r.last_message?.id === oldMsg.id) {
            return { ...r, last_message: undefined };
        }
        return r;
    }));
  }, []);

  const updateRef = useRef(handleUpdate);
  updateRef.current = handleUpdate;
  const deleteRef = useRef(handleDelete);
  deleteRef.current = handleDelete;

  // 2. FETCH ROOMS
  const fetchRooms = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      setIsLoadingRooms(true);
      const { data, error } = await supabase
        .from('chat_participants')
        .select(`chat_id, chat_rooms (*, chat_participants (user_id, chat_profiles (id, username, avatar_url)), chat_messages (id, content, created_at, sender_id, sender:chat_profiles (id, username, avatar_url)))`)
        .eq('user_id', session.user.id);

      if (error) throw error;
      const mappedRooms: NormalizedRoom[] = (data || []).map((item: any) => {
        const room = item.chat_rooms;
        if (!room) return null;
        const participants = (room.chat_participants || []).map((p: any) => ({
          id: p.chat_profiles?.id || p.user_id, user_id: p.user_id,
          username: p.chat_profiles?.username || 'Unknown', avatar_url: p.chat_profiles?.avatar_url || null,
        }));
        const sortedMessages = (room.chat_messages || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return {
          id: room.id, name: room.name, is_group: room.is_group ?? false, created_at: room.created_at, participants,
          last_message: sortedMessages[0] ? normalizeMessage(sortedMessages[0]) : undefined,
        };
      }).filter(Boolean) as NormalizedRoom[];
      setRooms(mappedRooms);
    } catch (err) { console.error('🔥 FETCH_ROOMS_ERROR:', err); } finally { setIsLoadingRooms(false); }
  }, [session?.user?.id]);

  const roomsRef = useRef(fetchRooms);
  roomsRef.current = fetchRooms;

  // 3. CLEAR MESSAGES
  const clearRoomMessages = useCallback((roomId: string) => {
    setMessageMap(prev => ({ ...prev, [roomId]: [] }));
  }, []);

  // 4. FETCH MESSAGES
  const fetchMessages = useCallback(async (roomId: string) => {
    if (!roomId) return;
    try {
      setIsLoadingMessages(true);
      const { data, error } = await supabase.from('chat_messages').select('*, sender:chat_profiles(id, username, avatar_url)')
        .eq('chat_id', roomId).order('created_at', { ascending: true });
      if (error) throw error;
      const serverMsgs = (data || []).map(normalizeMessage);
      setMessageMap(prev => ({
          ...prev,
          [roomId]: serverMsgs
      }));
    } catch (err) { console.error('🔥 FETCH_MESSAGES_ERROR:', err); } finally { setIsLoadingMessages(false); }
  }, []);

  // 4. SEND MESSAGE (WS Primary)
  const sendMessage = useCallback(async (roomId: string, content: string) => {
    if (!roomId || !content?.trim() || !profile) return;
    
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticMsg = normalizeMessage({
      id: tempId, chat_id: roomId, sender_id: profile.id, content: content.trim(), status: 'sending',
      created_at: new Date().toISOString(), 
      sender: { id: profile.id, username: profile.username || 'You', avatar_url: profile.avatar_url || null }
    });

    applyIncomingMessage(optimisticMsg);

    wsSendMessage("new_message", {
      chat_id: roomId,
      content: content.trim(),
      sender: { id: profile.id, username: profile.username, avatar_url: profile.avatar_url }
    });

    try {
      setIsSending(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({ chat_id: roomId, sender_id: profile.id, content: content.trim(), status: 'sent' })
        .select('*, sender:chat_profiles(id, username, avatar_url)')
        .single();
      
      if (error) throw error;
      if (data) applyIncomingMessage(data);
    } catch (err) {
      console.error('🔥 Send Failure:', err);
    } finally {
      setIsSending(false);
    }
  }, [profile, applyIncomingMessage, wsSendMessage]);

  // ✅ 🎯 5. SAFE DELETE CHAT (NO SIDEBAR BUG)
  const deleteChat = useCallback(async (roomId: string) => {
    if (!roomId) return;

    const confirmDelete = confirm("Delete this chat? This will remove the conversation for everyone.");
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', roomId);

      if (!error) {
        setRooms(prev => prev.filter(r => r.id !== roomId));
        setMessageMap(prev => {
          const copy = { ...prev };
          delete copy[roomId];
          return copy;
        });

        router.push('/chat');
      } else {
          throw error;
      }
    } catch (err) {
        console.error('Delete Chat Error:', err);
        alert('Failed to delete chat');
    }
  }, [router]);

  // ✅ 🎯 6. SAFE EDIT MESSAGE API
  const editMessage = useCallback(async (id: string, content: string) => {
    if (!id || !content.trim()) return;

    try {
        const { error } = await supabase
          .from('chat_messages')
          .update({
            content: content.trim(),
            is_edited: true,
            edited_at: new Date().toISOString()
          })
          .eq('id', id);
        
        if (error) throw error;
    } catch (err) {
        console.error('Edit Message error:', err);
    }
  }, []);

  // ✅ 🎯 7. SAFE DELETE MESSAGE API
  const deleteMessage = useCallback(async (id: string) => {
    if (!id) return;

    try {
        const { error } = await supabase
          .from('chat_messages')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
    } catch (err) {
        console.error('Delete Message error:', err);
    }
  }, []);

  // 🔴 5. SUPABASE REALTIME (PRODUCTION STABILITY PATTERN)
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `chat-global-${user.id}`;

    supabase.getChannels().forEach((ch) => {
      if (ch.topic === channelName || ch.topic === `realtime:${channelName}`) {
        supabase.removeChannel(ch);
      }
    });

    const channel = supabase.channel(channelName);

    // ✅ INSERT
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      (payload) => applyRef.current(payload.new)
    );

    // ✅ UPDATE
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
      (payload) => updateRef.current(payload.new)
    );

    // ✅ DELETE
    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'chat_messages' },
      (payload) => deleteRef.current(payload.old)
    );

    // ✅ ROOM SYNC
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${user.id}` },
      () => roomsRef.current()
    );

    channel.subscribe((status) => {
      console.log('✅ REALTIME STATUS:', status);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // 6. WebSocket handler (PRIMARY TRANSPORT)
  useEffect(() => {
    if (!isConnected) return;
    rooms.forEach(room => wsSendMessage('join_room', { room_id: room.id }));

    const unsubscribe = subscribe('new_message', (msg: any) => {
      applyIncomingMessage(msg);
    });

    return unsubscribe;
  }, [isConnected, rooms.length, subscribe, wsSendMessage, applyIncomingMessage]);

  return { 
    rooms, 
    getMessages: (r: string) => messageMap[r] || [], 
    isLoadingRooms, 
    isLoadingMessages, 
    isSending, 
    fetchRooms, 
    fetchMessages, 
    sendMessage, 
    applyIncomingMessage,
    clearRoomMessages,
    deleteChat,
    editMessage,
    deleteMessage
  };
}
