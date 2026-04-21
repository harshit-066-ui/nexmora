# Nexmora — Real-Time Chat Platform

A modern real-time chat application built with **Next.js, Supabase, and WebSockets**, focused on clean architecture, optimistic UI, and scalable state management.

---

## 🏛️ Architecture Overview

Nexmora follows a **decoupled architecture** where Supabase acts as the primary data source while the frontend ensures responsive user experience through optimistic updates.

- **Frontend**: Next.js 14 (App Router), React Hooks for state and UI rendering  
- **Database & Auth**: Supabase (PostgreSQL + Authentication + Realtime)  
- **Backend (REST Layer)**: Express for controlled data operations and business logic  
- **WebSocket Engine**: Node.js server for presence (online/offline) and lightweight event signaling  

---

## 📂 Project Structure

```text
nexmora/
├── frontend/
│   ├── src/app/
│   ├── src/components/
│   ├── src/hooks/
│   ├── src/lib/
│
├── backend/
│   ├── routes/
│   ├── middleware/
│
├── websocket/
│   ├── server.ts
│
├── shared/
│   ├── types.ts
│
└── supabase_fix.sql
🧠 Core Concepts
1. Message Normalization

All incoming data (API, Realtime, Optimistic UI) is passed through a unified normalizeMessage() function to ensure consistent structure and prevent UI crashes.

2. Optimistic UI

Messages are instantly rendered using temporary IDs before confirmation from the database.
Once confirmed, they are seamlessly replaced with actual records.

3. Realtime Synchronization

Supabase Realtime listens to:

INSERT → new messages
UPDATE → edited messages
DELETE → removed messages

State updates are handled immutably to guarantee React re-renders.

4. URL-Driven State

Chat navigation is controlled entirely via route parameters (/chat/[roomId]), avoiding redundant local state and ensuring predictable rendering.

📄 Key Components
Frontend
ChatSidebar.tsx
Displays chat rooms
Shows online users (via WebSocket presence)
ChatWindow.tsx
Renders messages safely using optional chaining
Handles dynamic updates without crashes
ChatHeader.tsx
Displays chat metadata and status
MessageItem.tsx
Handles individual message rendering
Supports edit + delete actions
CreateChatModal.tsx
UI for initiating conversations
Hooks
useChat.ts
Central state manager
Handles:
message normalization
realtime updates
optimistic UI
edit/delete logic
useWebSocket.ts
Tracks online users
Handles presence updates
useAuth.ts
Supabase authentication integration
Backend
Express API for controlled operations
Handles message creation and validation
WebSocket Server
Stateless server for:
user presence (online/offline)
lightweight event broadcasting
Database (Supabase)
chat_rooms
chat_messages
chat_participants
chat_profiles

RLS policies ensure secure access control.

🔄 Message Flow
Sending a Message
Message is added instantly (optimistic UI)
Sent to Supabase
Realtime event confirms and syncs across users
Receiving a Message
Supabase emits realtime event
Message is normalized
State updates immutably
UI re-renders instantly
🛠 Features
Real-time messaging (Supabase Realtime)
Optimistic UI for instant feedback
Edit & delete messages
Online/offline presence tracking
Modular component architecture
Error-safe rendering (no crashes on missing data)
⚠️ Notes
Realtime updates are implemented using Supabase subscriptions and optimized state handling
WebSocket layer is used for presence, not persistence
Designed with scalability and maintainability in mind
🚀 Tech Stack
Next.js 14
React
Supabase (Auth + DB + Realtime)
Node.js (Express + WebSocket)
TypeScript
📌 Future Improvements
Enhanced realtime consistency across edge cases
Message delivery/read receipts
Media/file sharing
Performance optimization for large chat histories
💡 Author Note

This project focuses on solving real-world challenges like:

state synchronization
optimistic UI handling
realtime data consistency

Built as a portfolio project to demonstrate full-stack system design and frontend architecture.
