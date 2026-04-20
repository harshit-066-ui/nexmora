'use client';

export default function ChatLandingPage() {
  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: 'var(--input)', 
      color: 'var(--muted)',
      height: '100%'
    }}>
      <div style={{ textAlign: 'center' }} className="animate-fade-in">
        <div style={{ 
          width: '120px', 
          height: '120px', 
          borderRadius: '50%', 
          backgroundColor: 'rgba(139, 92, 246, 0.05)', 
          margin: '0 auto 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '3rem', opacity: 0.2 }}>💬</div>
        </div>
        <h2 style={{ color: 'var(--foreground)', marginBottom: '0.5rem' }}>Your Messages</h2>
        <p>Select a chat from the sidebar to start messaging.</p>
      </div>
    </div>
  );
}
