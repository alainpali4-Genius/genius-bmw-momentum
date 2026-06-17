
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid3X3, Package, ClipboardCheck, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Inicio', icon: Home, href: '/' },
  { label: 'Expo', icon: Grid3X3, href: '/showroom' },
  { label: 'Stock', icon: Package, href: '/stock' },
  { label: 'Inventario', icon: ClipboardCheck, href: '/inventory' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t z-50 flex items-center px-2 md:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => (
        <Link 
          key={item.href} 
          href={item.href} 
          className={cn(
            "bottom-nav-item",
            pathname === item.href && "active"
          )}
        >
          <item.icon className="w-6 h-6 mb-1" />
          <span className="text-[9px] font-black uppercase tracking-tight">{item.label}</span>
        </Link>
      ))}
      <Link href="/showroom?add=true" className="bottom-nav-item">
        <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all">
          <PlusCircle className="w-7 h-7 text-white" />
        </div>
      </Link>
    </nav>
  );
}
