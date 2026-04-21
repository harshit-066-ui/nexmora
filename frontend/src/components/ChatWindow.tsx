'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { NormalizedMessage } from '@/hooks/useChat';
import ChatHeader from './ChatHeader';
import MessageItem from './MessageItem';
import { useParams } from 'next/navigation';

interface ChatWindowProps {
  messages: NormalizedMessage[];
  onSendMessage: (content: string) => void;
  onDeleteMessage: (id: string) => void;
  onUpdateMessage: (id: string, content: string) => void;
  onDeleteChat: (id: string) => void;
  isSending: boolean;
  activeRoomName: string;
  isOnline?: boolean;
}

export default function ChatWindow({ 
  messages, 
  onSendMessage,
  onDeleteMessage,
  onUpdateMessage,
  onDeleteChat,
  isSending, 
  activeRoomName,
  isOnline = false
}: ChatWindowProps) {
  const params = useParams();
  const roomId = params?.roomId as string;
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // ✅ Auto scroll on new messages
  useEffect(() => {
    scrollToBottom(true);
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'rgba(0,0,0,0.2)' }}>
      {/* ✅ Modular Header */}
      <ChatHeader 
        roomId={roomId} 
        roomName={activeRoomName} 
        isOnline={isOnline} 
        onDelete={onDeleteChat}
      />

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {!messages?.length ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗨️</div>
            <p className="text-gray-200">No messages here yet.</p>
            <p className="text-gray-400" style={{ fontSize: '0.875rem' }}>Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageItem 
                key={msg.id || idx} 
                message={msg} 
                onDelete={onDeleteMessage}
                onUpdate={onUpdateMessage}
            />
          ))
        )}
        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '1.25rem', backgroundColor: 'var(--background)', borderTop: '1px solid var(--border)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.75rem', maxWidth: '1000px', margin: '0 auto' }}>
          <input 
            type="text" 
            placeholder="Type your message..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="chat-input"
            style={{ 
              flex: 1, 
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
              outline: 'none',
              fontSize: '0.9375rem',
              color: 'white'
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

      <style jsx>{`
        .chat-input::placeholder {
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}
