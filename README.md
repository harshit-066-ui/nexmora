# Nexmora — Real-Time Chat Platform

A complete WhatsApp-like real-time chat application featuring a Next.js front-end, a secure Supabase backend, a Node/Express REST API layer, and a stateless WebSocket server for real-time presence/events.

---

## 🏛️ Architecture Overview

Nexmora is designed using a decoupled, highly scalable architecture ensuring **Supabase acts as the single source of truth** for all persistent data. 

*   **Frontend**: Next.js 14 App Router, built with React Hooks for optimistic UI, local caching, and unified state resolution.
*   **Database & Auth**: Supabase handles User Authentication (Session tokens), Data Storage (`chat_rooms`, `chat_messages`, `chat_participants`), and Row Level Security (RLS) policies.
*   **Backend (REST Layer)**: Express acts as an orchestration router to parse secure API inputs, bypass complex transactions through Supabase Service Role (for actions like Group creation), and enforce business logic before data hits the Database.
*   **WebSocket Engine**: A stateless Node.js WebSocket relay used strictly for ephemeral status broadcating (e.g., online/offline presence updates) and pushing `new_message` signaling, but **not** for data persistence.

---

## 📂 Project Structure

```text
nexmora/
├── frontend/             # Next.js Application
│   ├── src/app/          # App Router configuration & Pages
│   ├── src/components/   # Render components (Dumb & Smart)
│   ├── src/hooks/        # Local state and real-time syncing hooks
│   ├── src/lib/          # Shared utilities and configurations
│
├── backend/              # Express REST API Server
│   ├── controllers/      # Route handlers for chat/auth logic
│   ├── middleware/       # JWT and Supabase Validation
│   ├── routes/           # API Endpoints mapped
│
├── websocket/            # Stateless Real-time Engine
│   ├── server.ts         # Handles connection, disconnections, rooms
│
├── shared/               # Shared Types between Microservices
│   ├── types.ts          # Unified TypeScript interfaces
│
└── supabase_fix.sql      # Database Migrations and RLS policies
```

---

## 🧠 Core Mechanics & Concepts

### 1. Hard Normalization (The Single Source of Truth)
Because messages arrive from three wildly different lifecycles—**REST Database Fetches**, **Stateless WebSockets**, and **Instant Optimistic UI Arrays**—frontend pipelines funnel *everything* through a global `normalizeMessage()` hook. This solves the "missing username" or "blank message" problem common in distributed chats. 

### 2. URL-Driven State Management
Instead of duplicating route paths and local memory states, navigation relies on a URL-Driven architecture (`useParams()`). `setActiveRoomId` mutations are intentionally omitted. If `URL = /chat/abc123`, the app implicitly guarantees the chat window renders `.getMessages('abc123')`.

### 3. Immediate Optimistic Updates + Supabase Realtime Replaces
When a user sends a message, it is instantly given a `"temp-"` uuid and pushed to the array so the UI feels native and zero-latency. When Supabase (Database) or WebSockets confirm the receipt with the actual database ID, it actively maps and **overwrites** the temporary message seamlessly.

---

## 📄 File Manifest & Functionality

### 🌐 Frontend (Next.js)

#### `/frontend/src/app/...`
*   **`layout.tsx`**: Maps the `ChatSidebar` alongside the primary dynamic views. Listens to `fetchRooms()` purely on initialization to cache sidebar metadata.
*   **`[roomId]/page.tsx`**: Dynamic Room container. Drives `useChat` queries by calling `clearRoomMessages()` on every route modification to prevent "Ghost Swiping" UI flashes. Connects directly to `Supabase.channel()` to subscribe to isolated room `INSERT` triggers.

#### `/frontend/src/components/...`
*   **`ChatSidebar.tsx`**: Sidebar interface for Room navigation. Reads active User presence mapping (green online dots) from WebSockets and formats generic room names efficiently. 
*   **`ChatWindow.tsx`**: Safely unwraps rendered message threads. Fully shielded against crashes via optional chaning (`msg?.sender?.username ?? 'Unknown'`). Not dependent on `React.memo` blocking bounds to preserve strict re-rendering.
*   **`CreateChatModal.tsx`**: Modal calling orchestration endpoints to group arrays of friends into `chat_participants`.

#### `/frontend/src/hooks/...`
*   **`useChat.ts`**: The most critical state engine.
    *   `normalizeMessage(raw)`: Maps raw varying shapes into the guaranteed `NormalizedMessage` format.
    *   `applyIncomingMessage(msg)`: Safely processes deduplications array updates for optimistic/socket pushes.
    *   `fetchMessages()`: Hydrates local cache on deep load.
    *   `sendMessage()`: Handles optimistic mapping and Supabase insertions synchronously.
*   **`useWebSocket.ts`**: Connects via JWT to the `websocket/` service. Pushes presence state and dispatches ephemeral events globally via standard publish/subscribe.
*   **`useAuth.ts`**: Integrates Supabase `@supabase/auth-helpers` natively.

#### `/frontend/src/lib/...`
*   **`supabase.ts`**: Initializes the global client instance.
*   **`utils.ts`**: Houses `safeArray()` which ensures crash-less `.map()` renders even if Supabase unexpectedly faults during transmission loops.

---

### 📡 WebSocket Server (`/websocket`)
*   **`server.ts`**: Accepts WS connections mapped with tokens. Groups connections into virtual `Rooms` (Chat_Ids) and iterates through global connected arrays to broadcase `presence` statuses to the `useWebSocket` hook recursively. Stateless nature means if server restarts, clients auto-reconnect and state restores instantly.

### ⚙️ REST API Layer (`/backend`)
*   Provides heavy database modifications that require skipping Supabase's strict RLS mapping rules safely using the `SERVICE_ROLE` key securely within Express. Example: Setting up 5-way matching permutations when generating a new unique `Group Chat` payload safely before pushing to Database.

### 🗄️ Database (`Supabase / SQL`)
*   **`chat_rooms`**: Stores ID and is_group settings.
*   **`chat_participants`**: Many-to-Many mapping index.
*   **`chat_messages`**: Central message table, enforces RLS "Select if mapped to group in chat_participants".
*   **`chat_profiles`**: Trigger synced metadata linking auth_id to public usernames + avatars.

---

## 🛠 Flow Maps

### Receiving a Message
1. User B pushes to Supabase database.
2. User A's `supabase.channel()` actively listens to `chat_messages` `INSERT` event.
3. Hook extracts `payload.new`, runs it through `normalizeMessage()`.
4. Extracted payload checks against `messageMap` arrays using ID to ensure it hasn't already been delivered by the WS server.
5. React array is shallow-cloned to break memorization trees, state is updated seamlessly. 
