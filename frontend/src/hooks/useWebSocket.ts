'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';

// 🚨 SHARED STATE OUTSIDE THE HOOK to prevent multiple connections
// This ensures that even if the hook is called in multiple places,
// they share the same socket and presence state.
let sharedSocket: WebSocket | null = null;
let sharedOnlineUsers: Set<string> = new Set();
const sharedHandlers: Map<string, Set<(payload: any) => void>> = new Map();

export function useWebSocket() {
  const { session } = useAuth();
  const [isConnected, setIsConnected] = useState(!!sharedSocket && sharedSocket.readyState === WebSocket.OPEN);
  
  // ✅ Single source of truth for presence
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set(sharedOnlineUsers));
  
  const accessToken = session?.access_token;
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!accessToken) return;
    
    // 🚨 Prevent multiple connections or redundant attempts
    if (sharedSocket && (sharedSocket.readyState === WebSocket.OPEN || sharedSocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    console.log('🔌 Attempting WebSocket Connection...');
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'}?token=${accessToken}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✅ WebSocket Connected');
      sharedSocket = ws;
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const { type, payload } = parsed;

        if (type === 'presence') {
          sharedOnlineUsers = new Set(payload.onlineUsers);
          setOnlineUsers(new Set(sharedOnlineUsers));
          return;
        }

        const typeHandlers = sharedHandlers.get(type);
        if (typeHandlers) {
          typeHandlers.forEach(handler => handler(payload));
        }
      } catch (err) {
        console.error('WS Message parsing error:', err);
      }
    };

    ws.onclose = () => {
      console.log('❌ WebSocket Disconnected');
      sharedSocket = null;
      setIsConnected(false);
      
      // Stable Reconnect logic
      if (accessToken) {
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('WS Error:', err);
      ws.close();
    };

    sharedSocket = ws;
  }, [accessToken]);

  useEffect(() => {
    connect();
    return () => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    };
  }, [connect]);

  const subscribe = useCallback((type: string, handler: (payload: any) => void) => {
    if (!sharedHandlers.has(type)) {
      sharedHandlers.set(type, new Set());
    }
    const handlers = sharedHandlers.get(type)!;
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }, []);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (sharedSocket?.readyState === WebSocket.OPEN) {
      sharedSocket.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  return {
    isConnected,
    onlineUsers, // ✅ Export Set
    subscribe,
    sendMessage
  };
}
