'use client';

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { useAuth } from "@/firebase";
import { useUser } from "@/firebase/auth/use-user";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { BottomNav } from "@/components/layout/bottom-nav";

const ALLOWED_EMAIL = "a.henares@momentummotor.es";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { user, loading } = useUser();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!user && !isLogin) router.replace("/login");
    else if (user && user.email?.toLowerCase() !== ALLOWED_EMAIL) {
      signOut(auth).finally(() => router.replace("/login"));
    } else if (user && isLogin) router.replace("/");
  }, [user, loading, isLogin, router, auth]);

  if (loading || (!user && !isLogin) || (user && user.email?.toLowerCase() !== ALLOWED_EMAIL)) {
    return <div className="flex h-screen items-center justify-center bg-white"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#0066b3]"/></div>;
  }
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
