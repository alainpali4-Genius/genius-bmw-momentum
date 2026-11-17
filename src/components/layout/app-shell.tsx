'use client';

import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  if (isLogin) return <div className="h-screen w-full overflow-hidden bg-white">{children}</div>;

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full overflow-hidden">
        <div className="hidden md:flex shrink-0 h-full border-r bg-secondary"><AppSidebar /></div>
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <MobileHeader />
          <main className="flex-1 overflow-hidden relative bg-[#f4f7fa] pb-24 md:pb-0">{children}</main>
          <BottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
