'use client';

import { useState, useEffect } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { NormalizedMessage } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface MessageItemProps {
  message: NormalizedMessage;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string) => void;
}

export default function MessageItem({ message, onDelete, onUpdate }: MessageItemProps) {
  const { profile } = useAuth();
  const isMe = message.sender_id === profile?.id;
  
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNew, setIsNew] = useState(true);

  // Clear 'new' state after 2s
  useEffect(() => {
      const timer = setTimeout(() => setIsNew(false), 2000);
      return () => clearTimeout(timer);
  }, []);

  const handleUpdate = async () => {
    if (!message?.id || !editValue.trim() || editValue === message.content) {
      setIsEditing(false);
      return;
    }
    await onUpdate(message.id, editValue.trim());
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!message?.id || !confirm("Delete this message?")) return;
    await onDelete(message.id);
  };

  return (
    <div 
      style={{ 
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        maxWidth: '75%',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
      }}
      className="message-item-container"
    >
      {!isMe && (
        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600', marginLeft: '0.5rem', marginBottom: '2px' }}>
          {message?.sender?.username || 'Unknown'}
        </span>
      )}
      
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
        <div style={{ 
          padding: '0.625rem 1rem',
          borderRadius: isMe ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
          backgroundColor: isMe ? 'var(--primary)' : 'var(--card)',
          color: isMe ? 'white' : 'var(--foreground)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          minWidth: '60px'
        }}
        className={isNew ? (isMe ? 'animate-new-message-me' : 'animate-new-message') : ''}
        >
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  color: 'white',
                  padding: '4px 8px',
                  outline: 'none',
                  fontSize: '0.9375rem',
                  resize: 'none'
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleUpdate();
                    }
                    if (e.key === 'Escape') setIsEditing(false);
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => setIsEditing(false)} style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer', opacity: 0.8 }}><X size={16} /></button>
                <button onClick={handleUpdate} style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}><Check size={16} /></button>
              </div>
            </div>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: '0.9375rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {message?.content || ""}
              </p>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                alignItems: 'center', 
                gap: '4px', 
                marginTop: '4px',
                fontSize: '0.625rem',
                opacity: 0.7
              }}>
                <span>{message.created_at ? format(new Date(message.created_at), 'HH:mm') : ''}</span>
                {message.is_edited && <span style={{ color: 'var(--muted)' }}>(edited)</span>}
              </div>
            </>
          )}
        </div>

        {/* ✅ Edit/Delete Buttons (Visible on hover or mobile always) */}
        {isMe && !isEditing && (
            <div className="message-actions" style={{ 
                display: 'flex', gap: '4px', opacity: 0, transition: 'opacity 0.2s',
                backgroundColor: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px'
            }}>
                <button onClick={() => setIsEditing(true)} style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer', padding: '2px' }}><Pencil size={14} /></button>
                <button onClick={handleDelete} disabled={isDeleting} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', padding: '2px' }}><Trash2 size={14} /></button>
            </div>
        )}
      </div>

      <style jsx>{`
        .message-item-container:hover .message-actions {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
