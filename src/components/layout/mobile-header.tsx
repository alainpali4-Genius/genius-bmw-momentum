
"use client"

import { useState } from 'react';
import { Menu, Car, LayoutDashboard, Grid3X3, Package, CalendarDays, ShieldCheck, History, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { title: "Panel de Control", url: "/", icon: LayoutDashboard },
  { title: "Plano de Exposición", url: "/showroom", icon: Grid3X3 },
  { title: "Gestión Stock VN", url: "/stock", icon: Package },
  { title: "Gestión de Entregas", url: "/delivery", icon: CalendarDays },
  { title: "Inventario", url: "/inventory", icon: Car },
];

const adminItems = [
  { title: "Incidencias", url: "/incidents", icon: ShieldCheck },
  { title: "Historial", url: "/history", icon: History },
  { title: "Configuración", url: "/settings", icon: Settings },
];

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="h-14 border-b bg-white flex items-center px-4 md:hidden shrink-0 z-50">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden h-10 w-10">
            <Menu className="h-6 w-6 text-slate-600" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] p-0 bg-[#003399] border-none text-white">
          <SheetHeader className="sr-only">
            <SheetTitle>Menú de Navegación</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full">
            <div className="h-24 flex items-center px-6 border-b border-white/10 shrink-0">
              <div className="flex flex-col">
                <span className="font-black text-lg tracking-tighter uppercase italic text-white">GENIUS BMW</span>
                <span className="text-[8px] opacity-60 font-black uppercase tracking-widest text-white/70">Momentum Navarra</span>
              </div>
            </div>
            
            <nav className="flex-1 overflow-y-auto px-2 py-6 space-y-8">
              <div>
                <p className="px-4 text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Operaciones</p>
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.url}
                      href={item.url}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all group/mobile-item ${
                        pathname === item.url ? 'bg-white/10 text-white' : 'text-white hover:bg-white/5'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 transition-colors ${pathname === item.url ? 'text-white' : 'text-white/70'}`} />
                      <span className="text-xs font-black uppercase tracking-wide group-hover/mobile-item:text-[#ED1C24] transition-colors">{item.title}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="px-4 text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Administración</p>
                <div className="space-y-1">
                  {adminItems.map((item) => (
                    <Link
                      key={item.url}
                      href={item.url}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all group/mobile-admin ${
                        pathname === item.url ? 'bg-white/10 text-white' : 'text-white hover:bg-white/5'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 transition-colors ${pathname === item.url ? 'text-white' : 'text-white/70'}`} />
                      <span className="text-xs font-black uppercase tracking-wide group-hover/mobile-admin:text-[#ED1C24] transition-colors">{item.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </nav>

            <div className="p-6 border-t border-white/10 shrink-0">
              <Button variant="ghost" className="w-full justify-start gap-4 text-white/60 hover:text-white uppercase font-black text-xs h-14 rounded-xl transition-colors group/mobile-logout">
                <LogOut className="w-5 h-5 text-white/60" /> 
                <span className="group-hover/mobile-logout:text-[#ED1C24] transition-colors text-white">Cerrar Sesión</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <div className="flex-1 flex items-center justify-center pr-10">
        <span className="font-black text-slate-800 text-sm uppercase tracking-tighter italic">GENIUS BMW</span>
      </div>
    </header>
  );
}
