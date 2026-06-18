
"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Grid3X3,
  Car,
  CalendarDays,
  Package,
  History,
  Settings,
  ShieldCheck,
  LogOut,
  X
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BrandLogo } from "./brand-logo"

const items = [
  {
    title: "Panel de Control",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Plano de Exposición",
    url: "/showroom",
    icon: Grid3X3,
  },
  {
    title: "Gestión Stock VN",
    url: "/stock",
    icon: Package,
  },
  {
    title: "Gestión de Entregas",
    url: "/delivery",
    icon: CalendarDays,
  },
  {
    title: "Inventario",
    url: "/inventory",
    icon: Car,
  },
]

const administrationItems = [
  {
    title: "Incidencias",
    url: "/incidents",
    icon: ShieldCheck,
  },
  {
    title: "Historial",
    url: "/history",
    icon: History,
  },
  {
    title: "Configuración",
    url: "/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile, state } = useSidebar();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="bg-[#003399] border-none text-white overflow-hidden">
      <SidebarHeader className="h-64 flex flex-col justify-center px-4 shrink-0">
        <div className="flex items-center justify-between w-full">
          {state === 'expanded' ? (
            <div className="px-2 flex flex-col items-center w-full text-center space-y-4">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-2xl font-black italic tracking-tighter text-white leading-none">GENIUS</span>
                  <span className="text-2xl font-black italic tracking-tighter text-[#ED1C24] leading-none">VN</span>
                </div>
                <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/40 leading-none">MOMENTUM NAVARRA</span>
              </div>
              <div className="pt-2">
                <BrandLogo variant="sidebar" className="w-[180px] md:w-[200px]" />
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-8 h-8 bg-[#ED1C24] rounded-lg flex items-center justify-center font-black italic text-white text-xs shadow-lg">G</div>
            </div>
          )}
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setOpenMobile(false)} className="text-white hover:bg-white/10 ml-auto">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-4 py-2 gap-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/40 text-[9px] uppercase font-black tracking-[0.2em] px-4 mb-4">Operaciones</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild 
                  className={cn(
                    "transition-all h-12 text-white hover:bg-white/10 px-4 rounded-xl border-none group/btn",
                    pathname === item.url && "bg-white/10"
                  )}
                  onClick={handleLinkClick}
                >
                  <Link href={item.url} className="flex items-center gap-4">
                    <item.icon className="w-5 h-5 shrink-0 text-white/70 group-hover/btn:text-[#ED1C24] transition-colors" />
                    <span className="text-[11px] uppercase font-black tracking-tight text-white group-hover/btn:text-[#ED1C24] transition-colors">
                      {item.title}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        
        <SidebarGroup className="mt-8">
          <SidebarGroupLabel className="text-white/40 text-[9px] uppercase font-black tracking-[0.2em] px-4 mb-4">Administración</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {administrationItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild 
                  className={cn(
                    "transition-all h-12 text-white hover:bg-white/10 px-4 rounded-xl border-none group/adminbtn",
                    pathname === item.url && "bg-white/10"
                  )}
                  onClick={handleLinkClick}
                >
                  <Link href={item.url} className="flex items-center gap-4">
                    <item.icon className="w-5 h-5 shrink-0 text-white/70 group-hover/adminbtn:text-[#ED1C24] transition-colors" />
                    <span className="text-[11px] uppercase font-black tracking-tight text-white group-hover/adminbtn:text-[#ED1C24] transition-colors">
                      {item.title}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-6 border-t border-white/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-white/40 hover:text-white hover:bg-white/10 h-12 transition-colors px-4 rounded-xl border-none group/logout">
              <LogOut className="w-5 h-5 text-white/40 group-hover/logout:text-[#ED1C24] transition-colors" />
              <span className="text-[11px] font-black uppercase tracking-tight text-white group-hover/logout:text-[#ED1C24] transition-colors">Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
