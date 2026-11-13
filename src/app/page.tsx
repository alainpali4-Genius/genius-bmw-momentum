'use client';

import { useMemo } from "react";
import { Car, MapPin, Package, CalendarCheck, Clock3, ArrowUpRight, Plus, Warehouse, Truck, KeyRound, LayoutGrid, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getVehicleColor, suggestedMotor } from "./showroom/page";
import { ScannerPanel } from "@/components/scanner-panel";

const norm = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const isDemo = (v: any) => norm(v.tipoLogistico).includes("demo") || norm(v.ubicacion) === "demo en uso";
const isDelivered = (v: any) => norm(v.estado) === "entregado" || norm(v.ubicacion) === "entregado";
const isExpo = (v: any) => /^P(?:1[0-5]|[1-9])$/i.test(String(v.ubicacion || "").trim());
const isStockExpo = (v: any) => norm(v.tipoLogistico).includes("stock expo") || norm(v.tipoLogistico).includes("stock exposicion");

export default function GeniusDashboard() {
  const db = useFirestore();
  const router = useRouter();
  // Sin orderBy: los vehículos antiguos sin createdAt también deben entrar en el panel.
  const vehiclesQuery = useMemo(() => query(collection(db, "vehiculos")), [db]);
  const { data: rawVehicles, loading } = useCollection(vehiclesQuery);
  const vehicles = (rawVehicles || []) as any[];

  const stats = useMemo(() => {
    const active = vehicles.filter(v => !isDelivered(v));
    return {
      total: vehicles.length,
      expo: active.filter(isExpo).length,
      entreplanta: active.filter(v => norm(v.ubicacion) === "entreplanta").length,
      terraza: active.filter(v => norm(v.ubicacion) === "terraza").length,
      entrega: active.filter(v => norm(v.ubicacion).includes("entrega")).length,
      demos: active.filter(isDemo).length,
      stockExpo: active.filter(isStockExpo).length,
      renting: active.filter(v => norm(v.tipoLogistico).includes("renting") || !!v.entidadRenting).length,
      cliente: active.filter(v => norm(v.tipoLogistico).includes("cliente") || (!!v.clienteLogistica && !v.entidadRenting)).length,
      delivered: vehicles.filter(isDelivered).length,
      reserved: active.filter(v => norm(v.estado).includes("reserv")).length,
      prep: active.filter(v => norm(v.estado).includes("preparacion entrega")).length,
    };
  }, [vehicles]);

  const recent = useMemo(() => [...vehicles].sort((a,b) => {
    const da = Date.parse(a.updatedAt || a.createdAt || "") || 0;
    const db = Date.parse(b.updatedAt || b.createdAt || "") || 0;
    return db - da;
  }).slice(0,6), [vehicles]);

  const locationCards = [
    { label: "Exposición", value: stats.expo, note: "Plazas P1–P15", icon: LayoutGrid, href: "/showroom" },
    { label: "Entreplanta", value: stats.entreplanta, note: "Vehículos sobre piso", icon: Warehouse, href: "/stock?filter=entreplanta" },
    { label: "Terraza", value: stats.terraza, note: "Tercer piso", icon: MapPin, href: "/stock?filter=terraza" },
    { label: "Zona de entrega", value: stats.entrega, note: "Preparación / recogida", icon: Truck, href: "/delivery" },
  ];
  const useCards = [
    { label: "Stock exposición", value: stats.stockExpo, icon: Car },
    { label: "Demos en uso", value: stats.demos, icon: KeyRound },
    { label: "Renting", value: stats.renting, icon: Package },
    { label: "Clientes", value: stats.cliente, icon: CalendarCheck },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#f3f6fa]">
      <div className="mx-auto max-w-[1600px] space-y-6 px-5 py-7 md:px-8 md:py-9">
        <div className="relative overflow-hidden rounded-2xl bg-[#102b50] px-6 py-7 text-white shadow-sm md:px-8 md:py-8">
          <div className="absolute -right-10 -top-24 h-72 w-72 rounded-full border-[36px] border-white/5" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">Momentum Navarra · Genius Showroom</p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-[36px]">Centro de operaciones</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-300">Vista general de la flota, su destino logístico y su ubicación física.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-10 border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={() => router.refresh()}><RefreshCw className="mr-2 h-4 w-4"/> Actualizar vista</Button>
              <Button className="h-10 bg-[#1682d4] px-4 text-white hover:bg-[#0870bd]" onClick={() => router.push("/showroom?add=true")}><Plus className="mr-2 h-4 w-4"/> Añadir vehículo</Button>
            </div>
          </div>
          <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 md:grid-cols-4">
            <div><p className="text-xs text-slate-300">Vehículos registrados</p><p className="mt-1 text-3xl font-semibold">{loading ? "—" : stats.total}</p></div>
            <div><p className="text-xs text-slate-300">En plazas de exposición</p><p className="mt-1 text-3xl font-semibold">{loading ? "—" : stats.expo}</p></div>
            <div><p className="text-xs text-slate-300">Demos en uso</p><p className="mt-1 text-3xl font-semibold">{loading ? "—" : stats.demos}</p></div>
            <div><p className="text-xs text-slate-300">Entregados</p><p className="mt-1 text-3xl font-semibold">{loading ? "—" : stats.delivered}</p></div>
          </div>
        </div>

        <section aria-label="Identificación rápida de vehículos" className="space-y-3">
          <div className="flex items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0872bd]">Acceso rápido</p><h2 className="text-xl font-semibold text-slate-900">Identificar vehículo</h2></div><Link href="/scanner" className="text-sm font-medium text-[#0066b3] hover:underline">Abrir escáner completo <ArrowUpRight className="ml-1 inline h-4 w-4"/></Link></div>
          <ScannerPanel compact />
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0872bd]">Ubicación física</p><h2 className="text-xl font-semibold text-slate-900">¿Dónde están los vehículos?</h2></div><Link href="/stock" className="text-sm font-medium text-[#0066b3] hover:underline">Ver stock completo <ArrowUpRight className="ml-1 inline h-4 w-4"/></Link></div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {locationCards.map((item,index)=><Link href={item.href} key={item.label} className="group">
              <Card className="h-full rounded-xl border-slate-200 bg-white shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md">
                <CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-600">{item.label}</span><span className="rounded-lg bg-blue-50 p-2 text-[#0066b3]"><item.icon className="h-4 w-4"/></span></div><p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{loading?"—":item.value}</p><p className="mt-1 text-xs text-slate-400">{item.note}</p></CardContent>
              </Card>
            </Link>)}
          </div>
        </section>

        <section className="space-y-3">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0872bd]">Destino / uso</p><h2 className="text-xl font-semibold text-slate-900">¿Para qué está destinado cada vehículo?</h2></div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {useCards.map(item=><Card key={item.label} className="rounded-xl border-slate-200 bg-white shadow-sm"><CardContent className="flex items-center gap-4 p-4"><div className="rounded-xl bg-slate-100 p-3 text-slate-600"><item.icon className="h-5 w-5"/></div><div><p className="text-xs text-slate-500">{item.label}</p><p className="text-2xl font-semibold text-slate-900">{loading?"—":item.value}</p></div></CardContent></Card>)}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
          <Card className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Actividad de flota</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Últimos vehículos modificados</h2></div><Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">En directo</Badge></div>
            <div className="divide-y divide-slate-100">
              {loading ? <p className="p-8 text-center text-sm text-slate-400">Cargando vehículos…</p> : recent.map(car=>{const color=getVehicleColor(car);return <button key={car.id} onClick={()=>router.push(`/showroom?s=${car.vin7||car.vin}`)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Car className="h-5 w-5"/></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{car.modelo||"Modelo sin definir"}</span><span className="mt-0.5 block truncate text-xs text-slate-400">{car.vin7||car.vin||"Sin bastidor"} · {car.ubicacion||"Sin ubicación"}</span></span>
                <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span className="h-2.5 w-2.5 rounded-full border border-slate-200" style={{backgroundColor:color?.hex||"#e5e7eb"}}/>{car.motor||suggestedMotor(car.modelo||"")||"Motor pendiente"}</span><ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400"/>
              </button>})}
            </div>
            <div className="border-t border-slate-100 p-3 text-right"><Link href="/stock" className="text-sm font-medium text-[#0066b3] hover:underline">Abrir gestión de stock <ArrowUpRight className="ml-1 inline h-4 w-4"/></Link></div>
          </Card>
          <div className="space-y-5">
            <Card className="rounded-xl border-slate-200 bg-white shadow-sm"><CardContent className="p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Seguimiento comercial</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Pendientes</h2><div className="mt-5 flex items-center justify-between border-b border-slate-100 pb-4"><span className="flex items-center gap-2 text-sm text-slate-600"><CalendarCheck className="h-4 w-4 text-amber-500"/> Reservados</span><strong className="text-xl text-slate-900">{loading?"—":stats.reserved}</strong></div><div className="flex items-center justify-between pt-4"><span className="flex items-center gap-2 text-sm text-slate-600"><Clock3 className="h-4 w-4 text-blue-500"/> Preparación entrega</span><strong className="text-xl text-slate-900">{loading?"—":stats.prep}</strong></div><Button asChild variant="outline" className="mt-5 w-full"><Link href="/delivery">Ir a gestión de entregas <ArrowUpRight className="ml-2 h-4 w-4"/></Link></Button></CardContent></Card>
            <Card className="rounded-xl border-slate-200 bg-[#eaf3fb] shadow-none"><CardContent className="p-5"><div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-[#0066b3]"/><h3 className="font-semibold text-slate-900">Plano de exposición</h3></div><p className="mt-2 text-sm text-slate-600">Consulta y organiza las 15 plazas del showroom.</p><Button asChild className="mt-4 w-full bg-[#0066b3] text-white hover:bg-[#00549a]"><Link href="/showroom">Abrir plano <ArrowUpRight className="ml-2 h-4 w-4"/></Link></Button></CardContent></Card>
          </div>
        </div>
      </div>
    </div>
  );
}
