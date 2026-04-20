import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/hooks/useAuth';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Nexmora Chat — Premium Messenger',
  description: 'A production-grade portfolio real-time chat application.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
