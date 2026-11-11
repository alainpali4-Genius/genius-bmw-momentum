"use client"

import * as React from "react"
import {
  LayoutDashboard, Grid3X3, Car, CalendarDays, Package,
  History, Settings, ShieldAlert, LogOut, X
} from "lucide-react"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarGroup, SidebarGroupLabel, useSidebar
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BrandLogo } from "./brand-logo"

const operations = [
  { title: "Inicio", url: "/", icon: LayoutDashboard },
  { title: "Stock", url: "/stock", icon: Car },
  { title: "Plano de exposición", url: "/showroom", icon: Grid3X3 },
  { title: "Entregas", url: "/delivery", icon: CalendarDays },
  { title: "Inventario", url: "/inventory", icon: Package },
]
const management = [
  { title: "Incidencias", url: "/incidents", icon: ShieldAlert },
  { title: "Historial", url: "/history", icon: History },
  { title: "Configuración", url: "/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const handleLinkClick = () => { if (isMobile) setOpenMobile(false) }

  const renderItems = (items: any[]) => items.map((item) => {
    const active = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url))
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild onClick={handleLinkClick}
          className={cn(
            "h-10 rounded-lg px-3 transition-colors text-slate-600 hover:bg-slate-100 hover:text-[#003399]",
            active && "bg-[#eaf1fb] text-[#003399] font-semibold hover:bg-[#eaf1fb]"
          )}>
          <Link href={item.url} className="flex items-center gap-3">
            <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[#003399]" : "text-slate-400")} />
            <span className="text-[13px] font-medium tracking-normal">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  })

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200 bg-white text-slate-800">
      <SidebarHeader className="h-[116px] justify-center border-b border-slate-100 px-5">
        <div className="flex items-center justify-between gap-2">
          {state === "expanded" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#55c5e8]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0877bd]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#e51b32]" />
                </div>
                <span className="text-[17px] font-semibold tracking-tight text-slate-900">Momentum</span>
              </div>
              <span className="pl-[34px] text-[9px] font-medium uppercase tracking-[0.25em] text-slate-400">GENIUS SHOWROOM</span>
            </div>
          ) : (
            <div className="flex gap-1"><span className="h-2 w-2 rounded-full bg-[#55c5e8]" /><span className="h-2 w-2 rounded-full bg-[#0877bd]" /><span className="h-2 w-2 rounded-full bg-[#e51b32]" /></div>
          )}
          {isMobile && <Button variant="ghost" size="icon" onClick={() => setOpenMobile(false)} className="ml-auto text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></Button>}
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-5 px-3 py-5">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Operaciones</SidebarGroupLabel>
          <SidebarMenu className="gap-1">{renderItems(operations)}</SidebarMenu>
        </SidebarGroup>
        <SidebarGroup className="border-t border-slate-100 pt-4">
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Gestión</SidebarGroupLabel>
          <SidebarMenu className="gap-1">{renderItems(management)}</SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-slate-100 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-10 rounded-lg px-3 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <LogOut className="h-[18px] w-[18px]" />
              <span className="text-[13px] font-medium">Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
