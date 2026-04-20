// =============================================
// Chat Routes — Express Backend
// All DB writes go through Supabase service role
// =============================================
import { Router, Response } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { AuthenticatedRequest, verifyJWT } from '../middleware/auth.js';
import type {
  ApiResponse,
  ChatRoom,
  ChatMessage,
  ChatProfile,
  ChatRoomWithDetails,
  MessageWithSender,
} from '../../../shared/types/index.js';

// WS broadcast function — injected from index.ts
let broadcastToRoom: (roomId: string, event: Record<string, unknown>) => void = () => {};

export const setBroadcastFn = (fn: typeof broadcastToRoom) => {
  broadcastToRoom = fn;
};

const router = Router();

// All routes require JWT
router.use(verifyJWT as any);

// ─── GET /chat/rooms ─────────────────────────────────
// Fetch all rooms the current user participates in
router.get('/rooms', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get all chat_ids for this user
    const { data: participantRows, error: partErr } = await supabaseAdmin
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', userId);

    if (partErr) {
      res.status(500).json({ success: false, error: partErr.message } as ApiResponse);
      return;
    }

    if (!participantRows || participantRows.length === 0) {
      res.json({ success: true, data: [] } as ApiResponse);
      return;
    }

    const chatIds = participantRows.map((p) => p.chat_id);

    // Get rooms
    const { data: rooms, error: roomErr } = await supabaseAdmin
      .from('chat_rooms')
      .select('*')
      .in('id', chatIds)
      .order('created_at', { ascending: false });

    if (roomErr) {
      res.status(500).json({ success: false, error: roomErr.message } as ApiResponse);
      return;
    }

    // For each room, get participants + last message
    const roomDetails: ChatRoomWithDetails[] = await Promise.all(
      (rooms || []).map(async (room: ChatRoom) => {
        // Get participants
        const { data: parts } = await supabaseAdmin
          .from('chat_participants')
          .select('user_id')
          .eq('chat_id', room.id);

        const userIds = (parts || []).map((p) => p.user_id);

        const { data: profiles } = await supabaseAdmin
          .from('chat_profiles')
          .select('*')
          .in('id', userIds);

        // Get last message
        const { data: lastMsgs } = await supabaseAdmin
          .from('chat_messages')
          .select('*')
          .eq('chat_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1);

        return {
          ...room,
          participants: (profiles || []) as ChatProfile[],
          last_message: lastMsgs?.[0] || undefined,
        };
      })
    );

    res.json({ success: true, data: roomDetails } as ApiResponse);
  } catch (err) {
    console.error('GET /chat/rooms error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch rooms' } as ApiResponse);
  }
});

// ─── POST /chat/create ───────────────────────────────
// Create a new chat room with participants
router.post('/create', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { participant_ids, name, is_group } = req.body;

    if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length === 0) {
      res.status(400).json({ success: false, error: 'participant_ids required' } as ApiResponse);
      return;
    }

    // Include the creator in the participants
    const allParticipants: string[] = Array.from(new Set([userId, ...participant_ids]));

    // For 1-on-1 chats, check if room already exists and enforce size
    if (!is_group) {
      if (allParticipants.length !== 2) {
        res.status(400).json({ success: false, error: 'Direct chat must have exactly 2 participants' } as ApiResponse);
        return;
      }

      const { data: existingParts } = await supabaseAdmin
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', userId);

      if (existingParts) {
        for (const part of existingParts) {
          const { data: otherPart } = await supabaseAdmin
            .from('chat_participants')
            .select('chat_id')
            .eq('chat_id', part.chat_id)
            .eq('user_id', participant_ids[0]);

          if (otherPart && otherPart.length > 0) {
            // Check it's not a group chat
            const { data: existingRoom } = await supabaseAdmin
              .from('chat_rooms')
              .select('*')
              .eq('id', part.chat_id)
              .eq('is_group', false)
              .single();

            if (existingRoom) {
              // Return existing room
              const { data: profiles } = await supabaseAdmin
                .from('chat_profiles')
                .select('*')
                .in('id', allParticipants);

              res.json({
                success: true,
                data: { ...existingRoom, participants: profiles || [] },
              } as ApiResponse);
              return;
            }
          }
        }
      }
    }

    // Validate group size
    if (is_group && allParticipants.length < 3) {
      res.status(400).json({ success: false, error: 'Group chat must have at least 3 participants' } as ApiResponse);
      return;
    }

    // Create the room
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('chat_rooms')
      .insert({
        name: name || (is_group ? 'New Group' : null),
        is_group: is_group || false,
        created_by: userId,
      })
      .select()
      .single();

    if (roomErr || !room) {
      console.error('Room creation error:', roomErr);
      res.status(500).json({ success: false, error: 'Failed to create room' } as ApiResponse);
      return;
    }

    // Add all participants with roles
    const participantInserts = allParticipants.map((uid) => ({
      chat_id: room.id,
      user_id: uid,
      role: uid === userId ? 'admin' : 'member',
    }));

    const { error: partErr } = await supabaseAdmin
      .from('chat_participants')
      .insert(participantInserts);

    if (partErr) {
      console.error('Participant insert error:', partErr);
      // Cleanup room on failure
      await supabaseAdmin.from('chat_rooms').delete().eq('id', room.id);
      res.status(500).json({ success: false, error: 'Failed to add participants' } as ApiResponse);
      return;
    }

    // Get participant profiles
    const { data: profiles } = await supabaseAdmin
      .from('chat_profiles')
      .select('*')
      .in('id', allParticipants);

    const result = { ...room, participants: profiles || [] };

    res.status(201).json({ success: true, data: result } as ApiResponse);
  } catch (err) {
    console.error('POST /chat/create error:', err);
    res.status(500).json({ success: false, error: 'Failed to create chat' } as ApiResponse);
  }
});

// ─── POST /chat/message ──────────────────────────────
// Send a message to a room
router.post('/message', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { chat_id, content } = req.body;

    if (!chat_id || !content) {
      res.status(400).json({ success: false, error: 'chat_id and content required' } as ApiResponse);
      return;
    }

    // Verify user is participant
    const { data: participant } = await supabaseAdmin
      .from('chat_participants')
      .select('id')
      .eq('chat_id', chat_id)
      .eq('user_id', userId)
      .single();

    if (!participant) {
      res.status(403).json({ success: false, error: 'Not a participant of this chat' } as ApiResponse);
      return;
    }

    // Insert message
    const { data: message, error: msgErr } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        chat_id,
        sender_id: userId,
        content,
        status: 'sent',
      })
      .select()
      .single();

    if (msgErr || !message) {
      console.error('Message insert error:', msgErr);
      res.status(500).json({ success: false, error: 'Failed to send message' } as ApiResponse);
      return;
    }

    // Get sender profile
    const { data: sender } = await supabaseAdmin
      .from('chat_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Broadcast via WebSocket
    broadcastToRoom(chat_id, {
      type: 'new_message',
      payload: {
        message,
        sender: sender || { id: userId, username: 'Unknown' },
      },
      room_id: chat_id,
      sender_id: userId,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: { ...message, sender } } as ApiResponse);
  } catch (err) {
    console.error('POST /chat/message error:', err);
    res.status(500).json({ success: false, error: 'Failed to send message' } as ApiResponse);
  }
});

// ─── GET /chat/:id/messages ──────────────────────────
// Fetch messages for a room with joined sender info
router.get('/:id/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const chatId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Verify user is participant
    const { data: participant } = await supabaseAdmin
      .from('chat_participants')
      .select('id')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (!participant) {
      res.status(403).json({ success: false, error: 'Not a participant of this chat' } as ApiResponse);
      return;
    }

    // Fetch messages with nested profiles
    const { data: messages, error: msgErr } = await supabaseAdmin
      .from('chat_messages')
      .select('*, sender:chat_profiles(username)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (msgErr) {
      res.status(500).json({ success: false, error: msgErr.message } as ApiResponse);
      return;
    }

    res.json({ success: true, data: messages || [] } as ApiResponse);
  } catch (err) {
    console.error('GET /chat/:id/messages error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' } as ApiResponse);
  }
});

// ─── PUT /chat/message/:id ───────────────────────────
// Edit a message (20-minute rule)
router.put('/message/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const messageId = req.params.id;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ success: false, error: 'content required' } as ApiResponse);
      return;
    }

    // Fetch message
    const { data: message, error: fetchErr } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchErr || !message) {
      res.status(404).json({ success: false, error: 'Message not found' } as ApiResponse);
      return;
    }

    // Validate sender
    if (message.sender_id !== userId) {
      res.status(403).json({ success: false, error: 'Only the sender can edit this message' } as ApiResponse);
      return;
    }

    // Validate 20-minute rule
    const createdTime = new Date(message.created_at).getTime();
    const now = Date.now();
    const diffMins = (now - createdTime) / (1000 * 60);

    if (diffMins > 20) {
      res.status(400).json({ success: false, error: 'Editing window (20 mins) has expired' } as ApiResponse);
      return;
    }

    // Perform update
    const { data: updatedMsg, error: updateErr } = await supabaseAdmin
      .from('chat_messages')
      .update({
        content,
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select('*, sender:chat_profiles(username)')
      .single();

    if (updateErr) {
      res.status(500).json({ success: false, error: updateErr.message } as ApiResponse);
      return;
    }

    // Broadcast update
    broadcastToRoom(message.chat_id, {
      type: 'message_edited',
      payload: updatedMsg,
      room_id: message.chat_id,
      sender_id: userId,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: updatedMsg } as ApiResponse);
  } catch (err) {
    console.error('PUT /chat/message/:id error:', err);
    res.status(500).json({ success: false, error: 'Failed to edit message' } as ApiResponse);
  }
});

// ─── DELETE /chat/message/:id ────────────────────────
// Soft delete a message
router.delete('/message/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const messageId = req.params.id;

    // Fetch message
    const { data: message, error: fetchErr } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchErr || !message) {
      res.status(404).json({ success: false, error: 'Message not found' } as ApiResponse);
      return;
    }

    // Validate sender
    if (message.sender_id !== userId) {
      res.status(403).json({ success: false, error: 'Only the sender can delete this message' } as ApiResponse);
      return;
    }

    // Perform soft delete
    const { data: deletedMsg, error: delErr } = await supabaseAdmin
      .from('chat_messages')
      .update({
        content: '[deleted]',
        is_deleted: true,
      })
      .eq('id', messageId)
      .select('*, sender:chat_profiles(username)')
      .single();

    if (delErr) {
      res.status(500).json({ success: false, error: delErr.message } as ApiResponse);
      return;
    }

    // Broadcast delete event
    broadcastToRoom(message.chat_id, {
      type: 'message_deleted',
      payload: deletedMsg,
      room_id: message.chat_id,
      sender_id: userId,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: deletedMsg } as ApiResponse);
  } catch (err) {
    console.error('DELETE /chat/message/:id error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete message' } as ApiResponse);
  }
});

// ─── POST /chat/read ─────────────────────────────────
// Mark messages as read
router.post('/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { chat_id, message_ids } = req.body;

    if (!chat_id || !message_ids || !Array.isArray(message_ids)) {
      res.status(400).json({ success: false, error: 'chat_id and message_ids required' } as ApiResponse);
      return;
    }

    // Update message status to 'read'
    const { error } = await supabaseAdmin
      .from('chat_messages')
      .update({ status: 'read' })
      .in('id', message_ids)
      .eq('chat_id', chat_id)
      .neq('sender_id', userId); // Only mark others' messages

    if (error) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
      return;
    }

    // Broadcast read receipt
    broadcastToRoom(chat_id, {
      type: 'read_receipt',
      payload: {
        chat_id,
        user_id: userId,
        message_ids,
      },
      room_id: chat_id,
      sender_id: userId,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true } as ApiResponse);
  } catch (err) {
    console.error('POST /chat/read error:', err);
    res.status(500).json({ success: false, error: 'Failed to mark as read' } as ApiResponse);
  }
});

// ─── GET /chat/users ─────────────────────────────────
// Fetch all users (for creating new chats)
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const { data: profiles, error } = await supabaseAdmin
      .from('chat_profiles')
      .select('*')
      .neq('id', userId)
      .order('username');

    if (error) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
      return;
    }

    res.json({ success: true, data: profiles || [] } as ApiResponse);
  } catch (err) {
    console.error('GET /chat/users error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch users' } as ApiResponse);
  }
});

export default router;
