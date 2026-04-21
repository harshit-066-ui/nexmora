'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import ChatSidebar from '@/components/ChatSidebar';
import CreateChatModal from '@/components/CreateChatModal';
import { useChat } from '@/hooks/useChat';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  // ✅ URL-DRIVEN: roomId is the single source of truth — no setActiveRoomId
  const { rooms, fetchRooms, isLoadingRooms } = useChat();
  const { onlineUsers } = useWebSocket();
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const params = useParams();
  const roomId = params?.roomId as string | undefined;

  // Fetch rooms once on mount
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <div style={{ width: '320px', position: 'relative' }}>
          <ChatSidebar 
            rooms={rooms ?? []}
            onlineUsers={onlineUsers}
            activeRoomId={roomId ?? null}
            onNewChat={() => setShowModal(true)}
          />
          
          {/* Loading Overlay for Sidebar */}
          {isLoadingRooms && rooms.length === 0 && (
            <div className="flex-center" style={{ 
              position: 'absolute', 
              top: 0, left: 0, right: 0, bottom: 0, 
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 10
            }}>
              <Loader2 className="animate-spin" size={24} color="var(--primary)" />
            </div>
          )}
        </div>
        
        {/* Main Content Area */}
        <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
          {children}
        </div>

        {showModal && (
          <CreateChatModal 
            onClose={() => setShowModal(false)}
            existingRooms={rooms}
            onChatCreated={(newId) => {
              fetchRooms();
              router.push(`/chat/${newId}`);
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
