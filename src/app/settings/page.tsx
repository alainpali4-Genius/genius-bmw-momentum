'use client';

import { Settings, ShieldCheck, Database, Palette, MapPin, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const sections = [
  { icon: MapPin, title: "Zonas logísticas", detail: "Exposición (P1–P15), stock, terraza, entreplanta, lavadero, zona de entrega y taller.", status: "Configurado" },
  { icon: ClipboardList, title: "Estados de vehículo", detail: "Exposición, stock, demo, reservado, preparación de entrega, entregado y cedido.", status: "Configurado" },
  { icon: Palette, title: "Identidad visual", detail: "Interfaz Momentum con paleta BMW, tipografía clara y densidad equilibrada.", status: "Activo" },
  { icon: Database, title: "Almacenamiento", detail: "Los vehículos, movimientos, entregas e incidencias se gestionan mediante Firebase / Firestore.", status: "Conectado" },
  { icon: ShieldCheck, title: "Acceso y seguridad", detail: "La autenticación y las reglas privadas de Firestore requieren una fase específica antes de restringir el acceso.", status: "Pendiente" },
];

export default function SettingsPage() {
  return <div className="h-full overflow-y-auto bg-slate-50"><div className="mx-auto max-w-[1100px] space-y-6 px-5 py-7 md:px-8 md:py-9">
    <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0066b3]">Sistema · Momentum Navarra</p><h1 className="text-3xl font-semibold tracking-tight text-slate-900">Configuración</h1><p className="mt-1 text-sm text-slate-500">Resumen de los parámetros y servicios que utiliza GENIUS.</p></div>
    <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm"><CardContent className="flex items-start gap-4 p-5"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0066b3]"><Settings className="h-5 w-5"/></div><div><h2 className="font-semibold text-slate-900">Parámetros del sistema</h2><p className="mt-1 text-sm leading-6 text-slate-500">Esta pantalla recoge la configuración actual. Los cambios estructurales de ubicaciones, estados y permisos se habilitarán cuando estén validados para no alterar los datos operativos.</p></div></CardContent></Card>
    <div className="space-y-3">{sections.map(item=><Card key={item.title} className="rounded-xl border-slate-200/80 bg-white shadow-sm"><CardContent className="flex items-start gap-4 p-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><item.icon className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-800">{item.title}</h3><Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-600">{item.status}</Badge></div><p className="mt-1 text-sm text-slate-500">{item.detail}</p></div></CardContent></Card>)}</div>
  </div></div>;
}
