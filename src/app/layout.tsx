import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { AppShell } from '@/components/layout/app-shell';

export const viewport: Viewport = {
  themeColor: '#003399',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Forzamos la versión del icono para romper la caché del navegador
const ICON_VERSION = "9.0";

export const metadata: Metadata = {
  title: 'GENIUS BMW EXPO | Momentum Navarra',
  description: 'Sistema Logístico VN Momentum Navarra',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Genius BMW',
  },
  icons: {
    icon: [
      { url: `/icon.svg?v=${ICON_VERSION}`, type: 'image/svg+xml' },
    ],
    shortcut: `/icon.svg?v=${ICON_VERSION}`,
    apple: `/icon.svg?v=${ICON_VERSION}`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Genius BMW" />
        <link rel="icon" href={`/icon.svg?v=${ICON_VERSION}`} sizes="any" />
      </head>
      <body className="font-body antialiased bg-[#f4f7fa] h-full overflow-hidden">
        <FirebaseClientProvider>
          <AppShell>{children}</AppShell>
          <FirebaseErrorListener />
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
