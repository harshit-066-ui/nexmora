// =============================================
// Express Server Entry — Port 4000
// Connects to WebSocket server as a CLIENT
// =============================================
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import WebSocket from 'ws';
import chatRoutes, { setBroadcastFn } from './routes/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

const PORT = parseInt(process.env.BACKEND_PORT || '4000');
const WS_PORT = parseInt(process.env.WS_PORT || '3001');

const app = express();

// Middleware
app.use(cors({ origin: ['http://localhost:3000'], credentials: true }));
app.use(express.json());

// ─── WebSocket Client Connection ──────────────────
// Express connects to the WS server as a client to push events
let wsClient: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connectToWSServer() {
  try {
    wsClient = new WebSocket(`ws://localhost:${WS_PORT}?role=server`);

    wsClient.on('open', () => {
      console.log('✅ Express connected to WebSocket server');
    });

    wsClient.on('close', () => {
      console.log('⚠️  WebSocket connection closed, reconnecting in 3s...');
      wsReconnectTimer = setTimeout(connectToWSServer, 3000);
    });

    wsClient.on('error', (err) => {
      console.error('WebSocket client error:', err.message);
    });
  } catch (err) {
    console.error('Failed to connect to WS server:', err);
    wsReconnectTimer = setTimeout(connectToWSServer, 3000);
  }
}

// Broadcast function — sends events through the WS server
function broadcastToRoom(roomId: string, event: Record<string, unknown>) {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(
      JSON.stringify({
        type: 'server_broadcast',
        room_id: roomId,
        event,
      })
    );
  } else {
    console.warn('WS client not connected, event not broadcast:', event.type);
  }
}

// Inject broadcast function into routes
setBroadcastFn(broadcastToRoom);

// Routes
app.use('/chat', chatRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nexmora-backend', port: PORT });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Express backend running on http://localhost:${PORT}`);
  // Connect to WS server after Express starts
  connectToWSServer();
});

// Cleanup on shutdown
process.on('SIGTERM', () => {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  if (wsClient) wsClient.close();
  process.exit(0);
});
