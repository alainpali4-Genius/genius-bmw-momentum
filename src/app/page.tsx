
'use client';

import { useMemo, useState, useEffect } from "react";
import { 
  Package, Grid3X3, Car, CalendarCheck, Clock, Search, ChevronRight, Scan, History, Trash2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BMW_COLORS } from "./showroom/page";

type LocationFilter = 'ALL' | 'EXPO' | 'TERRAZA' | 'ENTREPLANTA' | 'LAVADERO' | 'ENTREGA' | 'STOCK';

export default function GeniusDashboard() {
  const db = useFirestore();
  const router = useRouter();
  const { data: vehiculosRaw, loading } = useCollection(query(collection(db, "vehiculos"), orderBy("createdAt", "desc")));
  const vehiculos = (vehiculosRaw || []) as any[];
  
  const [fastSearch, setFastSearch] = useState("");
  const [activeLocation, setActiveLocation] = useState<LocationFilter>('ALL');

  useEffect(() => {
    if (!loading && vehiculos.length === 0) {
      const seedData = async () => {
        try {
          const demo1 = {
            vin: "WBA11AA1234567890",
            vin7: "4567890",
            modelo: "BMW X1 sDrive20i",
            motor: "sDrive20i",
            bodyType: "SUV",
            colorExterior: "Portimao Blue Metallic (C31)",
            colorCodigo: "C31",
            estado: "Exposicion",
            ubicacion: "P5",
            comercial: "Alain",
            fechaEntrada: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            checklist: { lavado: false, combustible: false, documentacion: false, llaves: false, revision: false }
          };
          addDoc(collection(db, "vehiculos"), demo1);
        } catch (e) {
          console.error("DASHBOARD SEED ERROR", e);
        }
      };
      seedData();
    }
  }, [loading, vehiculos.length, db]);

  const filteredStock = useMemo(() => {
    let list = vehiculos;
    
    // Filtro por ubicación
    if (activeLocation === 'EXPO') list = list.filter(v => v.ubicacion?.startsWith('P'));
    else if (activeLocation === 'TERRAZA') list = list.filter(v => v.ubicacion?.toLowerCase() === 'terraza');
    else if (activeLocation === 'ENTREPLANTA') list = list.filter(v => v.ubicacion?.toLowerCase() === 'entreplanta');
    else if (activeLocation === 'LAVADERO') list = list.filter(v => v.ubicacion?.toLowerCase() === 'lavadero');
    else if (activeLocation === 'ENTREGA') list = list.filter(v => v.ubicacion?.toLowerCase().includes('entrega'));
    else if (activeLocation === 'STOCK') list = list.filter(v => v.ubicacion?.toLowerCase() === 'stock');

    // Filtro por búsqueda
    if (fastSearch) {
      const s = fastSearch.toLowerCase();
      list = list.filter(v => 
        v.modelo?.toLowerCase().includes(s) || 
        v.vin?.toLowerCase().includes(s) || 
        v.vin7?.toLowerCase().includes(s)
      );
    }
    
    return list;
  }, [vehiculos, activeLocation, fastSearch]);

  const stats = useMemo(() => {
    const total = vehiculos.length;
    const expo = vehiculos.filter(v => v.ubicacion?.startsWith('P')).length;
    const demo = vehiculos.filter(v => v.estado === 'Demo').length;
    const reserved = vehiculos.filter(v => v.estado === 'Reservado').length;
    const prep = vehiculos.filter(v => v.estado === 'Preparacion Entrega').length;
    
    return { total, expo, demo, reserved, prep };
  }, [vehiculos]);

  const kpis = [
    { label: "TOTAL VN", value: stats.total, icon: Package, href: "/stock", color: "text-[#00AEEF]" },
    { label: "EXPO", value: stats.expo, icon: Grid3X3, href: "/showroom", color: "text-[#003399]" },
    { label: "DEMO", value: stats.demo, icon: Car, href: "/showroom", color: "text-[#003399]" },
    { label: "RESERVADOS", value: stats.reserved, icon: CalendarCheck, href: "/showroom", color: "text-[#ED1C24]" },
    { label: "PREP", value: stats.prep, icon: Clock, href: "/showroom", color: "text-[#ED1C24]" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f4f7fa]">
      {/* Header & Search Compacted */}
      <div className="p-3 md:p-4 space-y-3 shrink-0">
        <div className="bg-[#003399] rounded-2xl p-4 md:p-5 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full translate-x-16 -translate-y-16 blur-2xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase italic leading-none">
                MOMENTUM <span className="text-white not-italic">VN</span>
              </h1>
              <p className="text-white/30 text-[7px] md:text-[8px] font-black uppercase tracking-[0.3em]">Operativa Genius</p>
            </div>

            <div className="flex gap-2 w-full md:w-[400px]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input 
                  className="h-10 bg-white/10 border-none rounded-xl text-xs font-black uppercase placeholder:text-white/20 pl-10 focus:bg-white/15 transition-all text-white" 
                  placeholder="BUSCAR VIN7 O MODELO..."
                  value={fastSearch}
                  onChange={(e) => setFastSearch(e.target.value)}
                />
              </div>
              <Button onClick={() => router.push(`/showroom?s=${fastSearch}`)} className="h-10 w-10 rounded-xl bg-[#ED1C24] hover:scale-105 shadow-md border-none transition-all">
                <Scan className="h-4 w-4 text-white" />
              </Button>
            </div>
          </div>
        </div>

        {/* Quick KPIs - Compact height */}
        <div className="flex md:grid md:grid-cols-5 gap-2 overflow-x-auto pb-1 scrollbar-none">
          {kpis.map((kpi) => (
            <Link key={kpi.label} href={kpi.href} className="min-w-[100px] md:min-w-0 flex-1">
              <Card className="premium-card hover:border-[#ED1C24] transition-all border-none group h-16 flex items-center bg-white shadow-sm rounded-xl">
                <CardContent className="p-3 w-full">
                  <div className="flex flex-col">
                    <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
                    <div className="flex justify-between items-end mt-0.5">
                      <p className="text-lg font-black text-slate-800 leading-none">{kpi.value}</p>
                      <kpi.icon className={cn("w-3.5 h-3.5 opacity-20", kpi.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content Area: Maximize List View */}
      <div className="flex-1 px-3 md:px-4 pb-20 md:pb-4 overflow-hidden flex flex-col gap-3">
        <div className="bg-white rounded-[1.5rem] shadow-sm border-none flex-1 overflow-hidden flex flex-col">
          <div className="p-3 md:p-4 border-b shrink-0 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-[#00AEEF]" /> STOCK VN
              </h3>
              <Tabs value={activeLocation} onValueChange={(v: any) => setActiveLocation(v)} className="hidden sm:block">
                <TabsList className="bg-slate-100/50 p-0.5 rounded-lg h-8">
                  <TabsTrigger value="ALL" className="rounded-md text-[8px] font-black uppercase px-3 h-7">TODOS</TabsTrigger>
                  <TabsTrigger value="EXPO" className="rounded-md text-[8px] font-black uppercase px-3 h-7">EXPO</TabsTrigger>
                  <TabsTrigger value="TERRAZA" className="rounded-md text-[8px] font-black uppercase px-3 h-7">TERRAZA</TabsTrigger>
                  <TabsTrigger value="ENTREPLANTA" className="rounded-md text-[8px] font-black uppercase px-3 h-7">PLANTA</TabsTrigger>
                  <TabsTrigger value="LAVADERO" className="rounded-md text-[8px] font-black uppercase px-3 h-7">LAVADO</TabsTrigger>
                  <TabsTrigger value="ENTREGA" className="rounded-md text-[8px] font-black uppercase px-3 h-7">ENTREGA</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <Badge variant="outline" className="text-[8px] font-black px-2 py-0.5 rounded bg-slate-50 border-none shrink-0">
              {filteredStock.length} UNIDADES
            </Badge>
          </div>

          {/* Mobile Tab List (Alternative) */}
          <div className="sm:hidden px-3 pt-2 overflow-x-auto scrollbar-none shrink-0">
            <Tabs value={activeLocation} onValueChange={(v: any) => setActiveLocation(v)} className="w-full">
              <TabsList className="bg-slate-100/50 p-0.5 rounded-lg h-7 flex w-fit">
                <TabsTrigger value="ALL" className="text-[7px] font-black px-2 h-6">TODOS</TabsTrigger>
                <TabsTrigger value="EXPO" className="text-[7px] font-black px-2 h-6">EXPO</TabsTrigger>
                <TabsTrigger value="TERRAZA" className="text-[7px] font-black px-2 h-6">TERRAZA</TabsTrigger>
                <TabsTrigger value="ENTREPLANTA" className="text-[7px] font-black px-2 h-6">PLT</TabsTrigger>
                <TabsTrigger value="LAVADERO" className="text-[7px] font-black px-2 h-6">LAV</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 scrollbar-none">
            {loading ? (
              <div className="flex justify-center py-10"><Clock className="animate-spin text-slate-200 h-8 w-8" /></div>
            ) : filteredStock.length === 0 ? (
              <div className="text-center py-20 text-[8px] font-black uppercase text-slate-300 tracking-widest italic">
                Sin unidades en esta ubicación
              </div>
            ) : (
              filteredStock.map((car) => {
                const days = car.fechaEntrada ? differenceInDays(new Date(), parseISO(car.fechaEntrada)) : 0;
                const colorObj = BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW));
                return (
                  <Card key={car.id} onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="border border-slate-50 bg-white hover:border-primary/20 transition-all rounded-xl shadow-sm overflow-hidden active:scale-[0.99] group">
                    <CardContent className="p-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                          <Car className="h-5 w-5 text-slate-300 group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h4 className="font-black text-[10px] md:text-[11px] uppercase text-secondary leading-none truncate">{car.modelo}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[8px] font-bold text-slate-400">{car.vin7}</span>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full border border-slate-200" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                              <span className="text-[7px] font-black text-slate-400 uppercase">{colorObj?.name.split(' ')[0]}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                           <p className={cn("text-[9px] font-black", days > 60 ? "text-red-600" : "text-emerald-600")}>{days} DÍAS</p>
                           <p className="text-[7px] font-black text-slate-300 uppercase">EN STOCK</p>
                        </div>
                        <Badge className={cn("text-[8px] font-black uppercase px-2 py-0.5 border-none rounded-lg", 
                          car.ubicacion?.startsWith('P') ? "bg-primary text-white" : "bg-slate-100 text-secondary"
                        )}>
                          {car.ubicacion}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-slate-50 text-slate-300 hover:text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); if(confirm("¿Eliminar?")) deleteDoc(doc(db, "vehiculos", car.id)); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Trazabilidad Bar - Compacted */}
        <Card className="premium-card bg-white border-none shadow-sm rounded-xl shrink-0">
          <CardContent className="p-2 px-4 flex items-center justify-between gap-4">
             <div className="flex items-center gap-3">
                <History className="h-4 w-4 text-slate-300" />
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Auditoría Logística Momentum Navarra</p>
             </div>
             <Link href="/history">
               <Button variant="ghost" className="h-8 text-[8px] font-black uppercase text-primary hover:bg-primary/5 px-3 rounded-lg">
                 VER HISTORIAL <ChevronRight className="ml-1 h-3 w-3" />
               </Button>
             </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
