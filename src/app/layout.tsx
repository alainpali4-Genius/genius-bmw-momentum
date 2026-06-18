import type {Metadata} from 'next';
import './globals.css';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { MobileHeader } from '@/components/layout/mobile-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export const metadata: Metadata = {
  title: 'GENIUS BMW EXPO | Momentum Navarra',
  description: 'Sistema Logístico VN Momentum Navarra',
  icons: {
    icon: '/logo-momentum.png',
    shortcut: '/logo-momentum.png',
    apple: '/logo-momentum.png',
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
      </head>
      <body className="font-body antialiased bg-[#f4f7fa] h-full overflow-hidden">
        <FirebaseClientProvider>
          <SidebarProvider defaultOpen={true}>
            <div className="flex h-screen w-full overflow-hidden">
              <div className="hidden md:flex shrink-0 h-full border-r bg-secondary">
                <AppSidebar />
              </div>
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <MobileHeader />
                <main className="flex-1 overflow-hidden relative bg-[#f4f7fa] pb-24 md:pb-0">
                  {children}
                </main>
                <BottomNav />
              </div>
            </div>
          </SidebarProvider>
          <FirebaseErrorListener />
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
