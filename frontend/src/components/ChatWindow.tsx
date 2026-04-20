'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User as UserIcon, Loader2 } from 'lucide-react';
import { NormalizedMessage } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface ChatWindowProps {
  messages: NormalizedMessage[];
  onSendMessage: (content: string) => void;
  onEditMessage?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  isSending: boolean;
  activeRoomName: string;
  isOnline?: boolean;
}

export default function ChatWindow({ 
  messages, 
  onSendMessage, 
  isSending, 
  activeRoomName,
  isOnline = false
}: ChatWindowProps) {
  const { profile } = useAuth();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isSending) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'rgba(0,0,0,0.1)' }}>
      {/* Room Header */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <UserIcon size={20} color="var(--muted)" />
          {isOnline && (
            <div style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: '12px',
              height: '12px',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              border: '2px solid var(--background)'
            }} />
          )}
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', margin: 0 }}>{activeRoomName}</h3>
          <p style={{ fontSize: '0.75rem', margin: 0, color: isOnline ? 'var(--success)' : 'var(--muted)' }}>
            {isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {!messages?.length ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗨️</div>
            <p>No messages here yet.</p>
            <p style={{ fontSize: '0.875rem' }}>Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg?.sender_id === profile?.id;
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const showSender = !isMe && (!prevMsg || prevMsg.sender_id !== msg.sender_id);

            return (
              <div 
                key={msg?.id || idx} 
                style={{ 
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                {showSender && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600', marginLeft: '0.5rem', marginBottom: '2px' }}>
                    {msg?.sender?.username ?? 'Unknown'}
                  </span>
                )}
                <div style={{ 
                  padding: '0.625rem 1rem',
                  borderRadius: isMe ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                  backgroundColor: isMe ? 'var(--primary)' : 'var(--card)',
                  color: isMe ? 'white' : 'inherit',
                  position: 'relative',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  opacity: msg.is_deleted ? 0.6 : 1,
                  fontStyle: msg.is_deleted ? 'italic' : 'normal'
                }}>
                  <p style={{ margin: 0, fontSize: '0.9375rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {msg.is_deleted ? '[deleted]' : (msg.content ?? '')}
                  </p>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'flex-end', 
                    alignItems: 'center', 
                    gap: '4px', 
                    marginTop: '2px',
                    fontSize: '0.625rem',
                    opacity: 0.7
                  }}>
                    <span>{msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : ''}</span>
                    {msg.is_edited && !msg.is_deleted && <span>| edited</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '1.25rem', backgroundColor: 'var(--background)', borderTop: '1px solid var(--border)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.75rem', maxWidth: '900px', margin: '0 auto' }}>
          <input 
            type="text" 
            placeholder="Type your message..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ 
              flex: 1, 
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
              outline: 'none',
              fontSize: '0.9375rem'
            }}
          />
          <button 
            type="submit"
            disabled={!input.trim() || isSending}
            style={{ 
              backgroundColor: input.trim() && !isSending ? 'var(--primary)' : 'var(--border)', 
              color: 'white', 
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              border: 'none',
              cursor: input.trim() && !isSending ? 'pointer' : 'not-allowed'
            }}
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
