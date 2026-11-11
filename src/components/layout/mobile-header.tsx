"use client"

import { useState } from "react"
import { Menu, LayoutDashboard, Grid3X3, Car, CalendarDays, Package, ShieldAlert, History, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { title: "Inicio", url: "/", icon: LayoutDashboard },
  { title: "Stock", url: "/stock", icon: Car },
  { title: "Plano de exposición", url: "/showroom", icon: Grid3X3 },
  { title: "Entregas", url: "/delivery", icon: CalendarDays },
  { title: "Inventario", url: "/inventory", icon: Package },
  { title: "Incidencias", url: "/incidents", icon: ShieldAlert },
  { title: "Historial", url: "/history", icon: History },
  { title: "Configuración", url: "/settings", icon: Settings },
]

export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  return (
    <header className="z-50 flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-600 hover:bg-slate-100"><Menu className="h-5 w-5" /></Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[290px] border-r border-slate-200 bg-white p-0 text-slate-800">
          <SheetHeader className="border-b border-slate-100 px-5 py-6 text-left">
            <SheetTitle className="flex items-center gap-2 text-slate-900">
              <span className="flex gap-1"><i className="h-2.5 w-2.5 rounded-full bg-[#55c5e8]"/><i className="h-2.5 w-2.5 rounded-full bg-[#0877bd]"/><i className="h-2.5 w-2.5 rounded-full bg-[#e51b32]"/></span>
              Momentum <span className="text-xs font-normal tracking-widest text-slate-400">GENIUS</span>
            </SheetTitle>
          </SheetHeader>
          <nav className="space-y-1 px-3 py-5">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Navegación</p>
            {navItems.map(item => {
              const active = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url))
              return <Link key={item.url} href={item.url} onClick={() => setOpen(false)} className={`flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ${active ? "bg-[#eaf1fb] text-[#003399]" : "text-slate-600 hover:bg-slate-100"}`}>
                <item.icon className={`h-[18px] w-[18px] ${active ? "text-[#003399]" : "text-slate-400"}`}/>{item.title}
              </Link>
            })}
          </nav>
        </SheetContent>
      </Sheet>
      <div className="ml-3 flex items-center gap-2">
        <span className="flex gap-1"><i className="h-2 w-2 rounded-full bg-[#55c5e8]"/><i className="h-2 w-2 rounded-full bg-[#0877bd]"/><i className="h-2 w-2 rounded-full bg-[#e51b32]"/></span>
        <span className="text-sm font-semibold tracking-tight text-slate-900">Momentum</span>
        <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400">Genius</span>
      </div>
    </header>
  )
}
