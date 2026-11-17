'use client';

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useAuth, useFirestore } from "@/firebase";
import { useUser } from "@/firebase/auth/use-user";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { BottomNav } from "@/components/layout/bottom-nav";

const LEGACY_ADMIN_EMAIL = "a.henares@momentummotor.es";

type AccessProfile = {
  active?: boolean;
  role?: "admin" | "manager" | "operator" | "viewer";
  tenantId?: string;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user, loading: authLoading } = useUser();
  const [profile, setProfile] = useState<AccessProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const isLogin = pathname === "/login";
  const isRegister = pathname === "/register";

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setProfile(null);
      setProfileUid(null);
      setProfileLoading(false);
      return;
    }
    // Mark the profile unresolved immediately. This prevents the route guard
    // from signing out during the render between Firebase auth and profile load.
    setProfileLoading(true);
    setProfileUid(null);
    if (user.email?.trim().toLowerCase() === LEGACY_ADMIN_EMAIL) {
      setProfile({ active: true, role: "admin", tenantId: "momentum-navarra" });
      setProfileUid(user.uid);
      setProfileLoading(false);
      return;
    }
    getDoc(doc(db, "users", user.uid))
      .then(snapshot => {
        if (cancelled) return;
        const data = snapshot.exists() ? snapshot.data() as AccessProfile : null;
        setProfile(data?.active === true && typeof data.tenantId === "string" ? data : null);
        setProfileUid(user.uid);
      })
      .catch(error => {
        console.error("No se pudo validar el perfil de acceso", error);
        if (!cancelled) setProfile(null);
      })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [user, db]);

  const loading = authLoading || (!!user && (profileLoading || profileUid !== user.uid));
  const isAuthorized = !!user && profile?.active === true;

  useEffect(() => {
    if (loading) return;
    if (!user && !isLogin && !isRegister) router.replace("/login");
    else if (user && !isAuthorized && !isRegister) {
      signOut(auth).finally(() => router.replace("/login"));
    } else if (user && isLogin && isAuthorized) router.replace("/");
  }, [user, loading, isLogin, isRegister, isAuthorized, router, auth]);

  if (isRegister && !user) return <div className="h-screen w-full overflow-hidden bg-white">{children}</div>;
  if (loading || (!user && !isLogin && !isRegister) || (user && !isAuthorized && !isRegister)) {
    return <div className="flex h-screen items-center justify-center bg-white"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#0066b3]"/></div>;
  }
  if (isLogin || isRegister) return <div className="h-screen w-full overflow-hidden bg-white">{children}</div>;

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
