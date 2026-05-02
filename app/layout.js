import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'Netrik Shop — Restaurant OS',
  description: 'Premium multi-tenant restaurant management platform with AI Waiter, QR ordering, kitchen ticketing & analytics.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
