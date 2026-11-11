'use client';

import { useMemo, useState } from "react";
import { Search, Plus, Loader2, Car, MapPin, ArrowUpRight, Building2, User, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { differenceInDays, parseISO, isValid } from "date-fns";
import { useRouter } from "next/navigation";
import { BMW_COLORS } from "../showroom/page";

type FilterType = 'all' | 'terraza' | 'entreplanta' | 'entrega' | 'exposicion' | 'demo';

export default function StockManagement() {
  const db = useFirestore();
  const router = useRouter();
  const vehiclesQuery = useMemo(() => query(collection(db, "vehiculos"), orderBy("createdAt", "desc")), [db]);
  const { data: rawVehicles, loading } = useCollection(vehiclesQuery);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const vehicles = (rawVehicles || []) as any[];

  const stats = useMemo(() => ({
    total: vehicles.length,
    exposicion: vehicles.filter(v => v.ubicacion?.startsWith('P')).length,
    terraza: vehicles.filter(v => v.ubicacion?.toLowerCase() === 'terraza').length,
    entreplanta: vehicles.filter(v => v.ubicacion?.toLowerCase() === 'entreplanta').length,
    lavadero: vehicles.filter(v => v.ubicacion?.toLowerCase() === 'lavadero').length,
    entrega: vehicles.filter(v => v.ubicacion?.toLowerCase().includes('entrega')).length,
  }), [vehicles]);

  const filtered = useMemo(() => {
    let result = vehicles;
    if (activeFilter === 'terraza') result = result.filter(v => v.ubicacion?.toLowerCase() === 'terraza');
    else if (activeFilter === 'entreplanta') result = result.filter(v => v.ubicacion?.toLowerCase() === 'entreplanta');
    else if (activeFilter === 'demo') result = result.filter(v => v.ubicacion === 'Demo en uso');
    else if (activeFilter === 'entrega') result = result.filter(v => v.ubicacion?.toLowerCase().includes('entrega'));
    else if (activeFilter === 'exposicion') result = result.filter(v => v.ubicacion?.startsWith('P'));
    const q = searchTerm.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (q) result = result.filter(v => [v.modelo,v.vin,v.vin7,v.matricula,v.entidadRenting,v.motor,v.destinoLogistico,v.clienteLogistica,v.colorExterior].some(x => String(x || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)));
    return result;
  }, [vehicles, activeFilter, searchTerm]);

  const filters = [
    {key:'exposicion' as const,label:'Exposición',value:stats.exposicion,icon:Car},
    {key:'terraza' as const,label:'Terraza',value:stats.terraza,icon:MapPin},
    {key:'entreplanta' as const,label:'Entreplanta',value:stats.entreplanta,icon:LayoutGrid},
    {key:'entrega' as const,label:'Entrega',value:stats.entrega,icon:ArrowUpRight},
    {key:'demo' as const,label:'Demos en uso',value:stats.demo,icon:Car},
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 px-5 py-7 md:px-8 md:py-9">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0066b3]">Inventario · Momentum Navarra</p><h1 className="text-3xl font-semibold tracking-tight text-slate-900">Gestión de stock</h1><p className="mt-1 text-sm text-slate-500">{stats.total} vehículos registrados en las zonas logísticas.</p></div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => router.push('/showroom')}><LayoutGrid className="mr-2 h-4 w-4"/> Ver plano</Button>
            <Button className="h-10 rounded-lg bg-[#0066b3] text-white hover:bg-[#00549a]" onClick={() => router.push('/showroom?add=true')}><Plus className="mr-2 h-4 w-4"/> Añadir vehículo</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {filters.map(f => {
            const active = activeFilter === f.key;
            return <button key={f.key} onClick={() => setActiveFilter(active ? 'all' : f.key)} className={`rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-200 ${active ? 'border-[#0066b3] ring-1 ring-[#0066b3]/20' : 'border-slate-200/80'}`}>
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{f.label}</span><f.icon className={`h-4 w-4 ${active ? 'text-[#0066b3]' : 'text-slate-400'}`}/></div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{f.value}</div>
            </button>
          })}
        </div>

        <Card className="overflow-hidden rounded-xl border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold text-slate-900">Vehículos en stock</h2><p className="mt-1 text-xs text-slate-500">Mostrando {filtered.length} de {vehicles.length} unidades</p></div>
            <div className="relative w-full sm:max-w-[360px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Buscar modelo, bastidor, matrícula…" className="h-10 rounded-lg border-slate-200 pl-9 text-sm"/></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50/80"><tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Vehículo</th><th className="px-4 py-3">Motor</th><th className="px-4 py-3">Color</th><th className="px-4 py-3">Tipo logístico</th><th className="px-4 py-3">Ubicación</th><th className="px-4 py-3 text-right">Días</th><th className="px-5 py-3"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/> Cargando vehículos…</td></tr> :
                filtered.length===0 ? <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-400">No hay vehículos que coincidan con la búsqueda.</td></tr> :
                filtered.map(car=>{
                  const color=BMW_COLORS.find(c=>c.code===(car.colorCodigo||car.colorBMW));
                  const parsed=car.fechaEntrada?parseISO(car.fechaEntrada):null;
                  const days=parsed&&isValid(parsed)?Math.max(0,differenceInDays(new Date(),parsed)):null;
                  return <tr key={car.id} onClick={()=>router.push(`/showroom?s=${car.vin7||car.vin}`)} className="cursor-pointer transition-colors hover:bg-slate-50/80">
                    <td className="px-5 py-4"><div className="text-sm font-semibold text-slate-800">{car.modelo||'Modelo sin definir'}</div><div className="mt-1 font-mono text-[10px] text-slate-400">{car.vin7||car.vin||'Sin bastidor'}{car.matricula? ` · ${car.matricula}`:''}</div></td>
                    <td className="px-4 py-4 text-sm text-slate-600">{car.motor||'—'}</td>
                    <td className="px-4 py-4"><div className="flex items-center gap-2 text-sm text-slate-600"><span className="h-3 w-3 rounded-full border border-slate-200" style={{backgroundColor:color?.hex||'#e5e7eb'}}/>{color?.name||car.colorExterior||'—'}</div></td>
                    <td className="px-4 py-4"><Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">{car.tipoLogistico||'Stock Expo'}</Badge>{car.entidadRenting&&<div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">{car.tipoLogistico==='Entrega Cliente'?<User className="h-3 w-3"/>:<Building2 className="h-3 w-3"/>}{car.entidadRenting}</div>}</td>
                    <td className="px-4 py-4"><Badge className={`rounded-full border-0 px-2.5 py-1 text-[10px] font-medium ${car.ubicacion?.startsWith('P')?'bg-blue-50 text-[#00549a]':'bg-slate-100 text-slate-600'}`}>{car.ubicacion?.startsWith('P')?`Exposición · ${car.ubicacion}`:(car.ubicacion||'Sin ubicación')}</Badge>{car.ubicacion==='Demo en uso'&&<div className="mt-1 text-[10px] text-slate-400">Lo tiene: {car.demoAsignadoA||'Sin asignar'}</div>}</td>
                    <td className="px-4 py-4 text-right text-sm tabular-nums text-slate-600">{days===null?'—':days}</td>
                    <td className="px-5 py-4 text-right"><ArrowUpRight className="ml-auto h-4 w-4 text-slate-400"/></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
