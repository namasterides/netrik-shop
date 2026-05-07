import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'Netrik Shop — Restaurant OS',
  description: 'Premium multi-tenant restaurant management platform with AI Waiter, QR ordering, kitchen ticketing & analytics.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/brand/original/netrikshop%20update%20logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
