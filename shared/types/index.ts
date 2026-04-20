// =============================================
// Nexmora Chat App — Shared Types
// =============================================

// --- Database Models ---

export interface ChatProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

export interface ChatRoom {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ChatParticipant {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  status: MessageStatus;
  is_edited: boolean;
  is_deleted: boolean;
  edited_at: string | null;
  created_at: string;
}

// --- API Request/Response ---

export interface CreateChatRequest {
  participant_ids: string[];
  name?: string;
  is_group?: boolean;
}

export interface SendMessageRequest {
  chat_id: string;
  content: string;
}

export interface MarkReadRequest {
  chat_id: string;
  message_ids: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- WebSocket Events ---

export type WSEventType =
  | 'join_room'
  | 'leave_room'
  | 'new_message'
  | 'message_edited'
  | 'message_deleted'
  | 'typing_start'
  | 'typing_stop'
  | 'presence'
  | 'ping'
  | 'error';

export interface WSEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
  room_id?: string;
  sender_id?: string;
  timestamp?: string;
}

export interface WSNewMessagePayload {
  message: ChatMessage;
  sender: ChatProfile;
}

export interface WSTypingPayload {
  user_id: string;
  username: string;
  chat_id: string;
}

export interface WSReadReceiptPayload {
  chat_id: string;
  user_id: string;
  message_ids: string[];
}

// --- Extended types for frontend ---

export interface ChatRoomWithDetails extends ChatRoom {
  participants: ChatProfile[];
  last_message?: ChatMessage;
  unread_count?: number;
}

export interface MessageWithSender extends ChatMessage {
  sender?: ChatProfile;
}
