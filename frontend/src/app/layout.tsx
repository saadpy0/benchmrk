import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { GoogleAuthProvider } from '@/components/GoogleAuthProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Benchmrk — Get Paid for Posting',
  description: 'The marketplace for content creators and brands in India',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GoogleAuthProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </GoogleAuthProvider>
      </body>
    </html>
  );
}
