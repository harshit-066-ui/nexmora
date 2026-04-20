// =============================================
// WebSocket Relay Server
// REAL-TIME PRESENCE & EVENT RELAY
// =============================================
import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { IncomingMessage } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

const WS_PORT = parseInt(process.env.WS_PORT || '3001');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const clients = new Map<WebSocket, string>(); // ws -> userId
const onlineUsers = new Map<string, boolean>(); // userId -> true

const wss = new WebSocketServer({ port: WS_PORT });

console.log(`🔌 WebSocket relay server running on ws://localhost:${WS_PORT}`);

wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || '', `http://localhost:${WS_PORT}`);
  const token = url.searchParams.get('token');
  const role = url.searchParams.get('role');

  // Server-side relay (from Express)
  if (role === 'server') {
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'server_broadcast' && parsed.room_id) {
          broadcastToRoom(parsed.room_id, parsed.event);
        }
      } catch {}
    });
    return;
  }

  if (!token) return ws.close(4001);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return ws.close(4001);

    const userId = user.id;
    clients.set(ws, userId);
    onlineUsers.set(userId, true);

    console.log(`✅ User connected: ${userId}`);
    broadcastPresence();

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'join_room' && parsed.room_id) {
          // In this simple relay, "joining" is just a filter marker if we held room state,
          // but for now we just handle it as a protocol marker.
          (ws as any).currentRoom = parsed.room_id;
        }
      } catch {}
    });

    ws.on('close', () => {
      onlineUsers.delete(userId);
      clients.delete(ws);
      console.log(`❌ User disconnected: ${userId}`);
      broadcastPresence();
    });
  } catch (err) {
    ws.close(4001);
  }
});

function broadcastPresence() {
  const payload = JSON.stringify({
    type: 'presence',
    payload: { onlineUsers: Array.from(onlineUsers.keys()) }
  });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function broadcastToRoom(roomId: string, event: any) {
  const payload = JSON.stringify(event);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && (client as any).currentRoom === roomId) {
      client.send(payload);
    }
  });
}
