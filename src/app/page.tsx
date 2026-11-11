'use client';

import { useMemo, useState } from "react";
import { Car, MapPin, Package, CalendarCheck, Clock3, Search, ArrowUpRight, Plus, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BMW_COLORS } from "./showroom/page";

export default function GeniusDashboard() {
  const db = useFirestore();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const vehiclesQuery = useMemo(() => query(collection(db, "vehiculos"), orderBy("createdAt", "desc")), [db]);
  const { data: rawVehicles, loading } = useCollection(vehiclesQuery);
  const vehicles = (rawVehicles || []) as any[];

  const stats = useMemo(() => ({
    total: vehicles.length,
    expo: vehicles.filter(v => v.ubicacion?.startsWith("P")).length,
    stock: vehicles.filter(v => ["stock", "terraza", "entreplanta", "lavadero"].includes((v.ubicacion || "").toLowerCase())).length,
    reserved: vehicles.filter(v => v.estado === "Reservado").length,
    prep: vehicles.filter(v => v.estado === "Preparacion Entrega" || v.estado === "Preparación Entrega").length,
  }), [vehicles]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!s) return vehicles.slice(0, 8);
    return vehicles.filter(v =>
      [v.modelo, v.vin, v.vin7, v.matricula, v.entidadRenting, v.destinoLogistico, v.clienteLogistica, v.colorExterior].some(x => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(s))
    ).slice(0, 8);
  }, [vehicles, search]);

  const kpis = [
    { label: "Vehículos totales", value: stats.total, icon: Car, note: "Unidades registradas" },
    { label: "En exposición", value: stats.expo, icon: MapPin, note: "Plazas de showroom" },
    { label: "En stock", value: stats.stock, icon: Package, note: "Zonas logísticas" },
    { label: "Reservados", value: stats.reserved, icon: CalendarCheck, note: "Pendientes de gestión" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 px-5 py-7 md:px-8 md:py-9">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0066b3]">Momentum Navarra · Gestión VN</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-[34px]">Panel de control</h1>
            <p className="mt-1.5 text-sm text-slate-500">Resumen de vehículos, exposición y operativa del concesionario.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white text-slate-700" onClick={() => router.refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
            </Button>
            <Button className="h-10 rounded-lg bg-[#0066b3] px-4 text-white hover:bg-[#00549a]" onClick={() => router.push("/showroom?add=true")}>
              <Plus className="mr-2 h-4 w-4" /> Añadir vehículo
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item, index) => (
            <Card key={item.label} className="rounded-xl border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{item.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{loading ? "—" : item.value}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.note}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${index === 1 ? "bg-blue-50 text-[#0066b3]" : "bg-slate-100 text-slate-600"}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
          <Card className="overflow-hidden rounded-xl border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Vehículos</h2>
                <p className="mt-1 text-xs text-slate-500">{vehicles.length} unidades registradas</p>
              </div>
              <div className="relative w-full sm:max-w-[280px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar modelo, VIN o matrícula" className="h-9 rounded-lg border-slate-200 pl-9 text-sm" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead className="bg-slate-50/80">
                  <tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3">Vehículo</th><th className="px-4 py-3">Motor</th><th className="px-4 py-3">Color</th><th className="px-4 py-3">Ubicación</th><th className="px-4 py-3">Estado</th><th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">Cargando vehículos…</td></tr> :
                  filtered.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">No se han encontrado vehículos.</td></tr> :
                  filtered.map(car => {
                    const color = BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW));
                    return <tr key={car.id} onClick={() => router.push(`/showroom?s=${car.vin7 || car.vin}`)} className="cursor-pointer transition-colors hover:bg-slate-50/80">
                      <td className="px-5 py-4"><div className="font-medium text-sm text-slate-800">{car.modelo || "Modelo sin definir"}</div><div className="mt-1 font-mono text-[10px] text-slate-400">{car.vin7 || car.vin || "Sin VIN"}</div></td>
                      <td className="px-4 py-4 text-sm text-slate-600">{car.motor || "—"}</td>
                      <td className="px-4 py-4"><div className="flex items-center gap-2 text-sm text-slate-600"><span className="h-3 w-3 rounded-full border border-slate-200" style={{backgroundColor: color?.hex || "#e5e7eb"}} />{color?.name || car.color || "—"}</div></td>
                      <td className="px-4 py-4 text-sm text-slate-600">{car.ubicacion || "Sin ubicación"}</td>
                      <td className="px-4 py-4"><Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">{car.estado || "Disponible"}</Badge></td>
                      <td className="px-5 py-4 text-right"><ArrowUpRight className="ml-auto h-4 w-4 text-slate-400" /></td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-slate-100 p-3">
              <Button asChild variant="ghost" className="h-9 text-sm font-medium text-[#0066b3] hover:bg-blue-50"><Link href="/stock">Ver todo el stock <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold text-slate-900">Accesos rápidos</h2><span className="text-xs text-slate-400">Operativa</span></div>
                <div className="space-y-2">
                  <Link href="/showroom" className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition-colors hover:border-blue-100 hover:bg-blue-50/50"><span className="flex items-center gap-3 text-sm font-medium text-slate-700"><MapPin className="h-4 w-4 text-[#0066b3]"/> Plano de exposición</span><ArrowUpRight className="h-4 w-4 text-slate-400"/></Link>
                  <Link href="/delivery" className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition-colors hover:border-blue-100 hover:bg-blue-50/50"><span className="flex items-center gap-3 text-sm font-medium text-slate-700"><CalendarCheck className="h-4 w-4 text-[#0066b3]"/> Gestión de entregas</span><ArrowUpRight className="h-4 w-4 text-slate-400"/></Link>
                  <Link href="/inventory" className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition-colors hover:border-blue-100 hover:bg-blue-50/50"><span className="flex items-center gap-3 text-sm font-medium text-slate-700"><Package className="h-4 w-4 text-[#0066b3]"/> Movimientos de inventario</span><ArrowUpRight className="h-4 w-4 text-slate-400"/></Link>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-base font-semibold text-slate-900">Pendientes de gestión</h2>
                <p className="mt-1 text-xs text-slate-500">Vehículos que requieren seguimiento.</p>
                <div className="mt-5 flex items-center justify-between border-b border-slate-100 pb-3"><span className="flex items-center gap-2 text-sm text-slate-600"><CalendarCheck className="h-4 w-4 text-amber-500"/> Reservados</span><strong className="text-lg font-semibold text-slate-900">{stats.reserved}</strong></div>
                <div className="flex items-center justify-between pt-3"><span className="flex items-center gap-2 text-sm text-slate-600"><Clock3 className="h-4 w-4 text-blue-500"/> Preparación entrega</span><strong className="text-lg font-semibold text-slate-900">{stats.prep}</strong></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
