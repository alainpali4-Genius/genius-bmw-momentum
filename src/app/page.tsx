
'use client';

import { useMemo, useState, useEffect } from "react";
import { 
  Package, Grid3X3, Car, CalendarCheck, Clock, Search, ChevronRight, TrendingUp, Scan, ShieldCheck, History, MapPin, Droplets, ArrowRightCircle, Trash2
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
    
    const aging = {
      plus30: vehiculos.filter(v => v.fechaEntrada && differenceInDays(new Date(), parseISO(v.fechaEntrada)) > 30).length,
      plus60: vehiculos.filter(v => v.fechaEntrada && differenceInDays(new Date(), parseISO(v.fechaEntrada)) > 60).length,
      plus90: vehiculos.filter(v => v.fechaEntrada && differenceInDays(new Date(), parseISO(v.fechaEntrada)) > 90).length,
    };

    const avgDays = total > 0 
      ? Math.round(vehiculos.reduce((acc, v) => {
          const entry = v.fechaEntrada ? parseISO(v.fechaEntrada) : new Date();
          return acc + Math.max(0, differenceInDays(new Date(), entry));
        }, 0) / total)
      : 0;

    return { total, expo, demo, reserved, prep, aging, avgDays };
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
      {/* Header & Search */}
      <div className="p-4 md:p-6 space-y-4 shrink-0">
        <div className="bg-[#003399] rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-32 -translate-y-32 blur-3xl" />
          <div className="relative z-10 space-y-4">
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase italic leading-none">
                MOMENTUM <span className="text-white not-italic">VN</span>
              </h1>
              <p className="text-white/30 text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em]">Operativa Premium Genius</p>
            </div>

            <div className="flex gap-2 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input 
                  className="h-12 bg-white/10 border-none rounded-2xl text-sm font-black uppercase placeholder:text-white/20 pl-11 focus:bg-white/15 transition-all text-white" 
                  placeholder="BUSCAR VIN7 O MODELO..."
                  value={fastSearch}
                  onChange={(e) => setFastSearch(e.target.value)}
                />
              </div>
              <Button onClick={() => router.push(`/showroom?s=${fastSearch}`)} className="h-12 w-12 rounded-2xl bg-[#ED1C24] hover:scale-105 shadow-lg border-none transition-all">
                <Scan className="w-5 h-5 text-white" />
              </Button>
            </div>
          </div>
        </div>

        {/* Quick KPIs - Mobile Horizontal Scroll */}
        <div className="flex md:grid md:grid-cols-5 gap-3 overflow-x-auto pb-2 scrollbar-none">
          {kpis.map((kpi) => (
            <Link key={kpi.label} href={kpi.href} className="min-w-[120px] md:min-w-0">
              <Card className="premium-card hover:border-[#ED1C24] transition-all border-none group h-20 flex items-center bg-white shadow-sm rounded-2xl">
                <CardContent className="p-4 w-full">
                  <div className="flex flex-col">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
                    <div className="flex justify-between items-end mt-1">
                      <p className="text-xl font-black text-slate-800 leading-none">{kpi.value}</p>
                      <kpi.icon className={cn("w-4 h-4 opacity-20", kpi.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content Area: Stock List with Tabs */}
      <div className="flex-1 px-4 md:px-6 pb-24 md:pb-6 overflow-hidden flex flex-col gap-4">
        <div className="bg-white rounded-[2rem] shadow-sm border-none flex-1 overflow-hidden flex flex-col">
          <div className="p-4 md:p-6 border-b shrink-0 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#00AEEF]" /> LISTADO DE STOCK VN
              </h3>
              <Badge variant="outline" className="text-[9px] font-black px-3 py-1 rounded-lg bg-slate-50 border-none">
                {filteredStock.length} UNIDADES
              </Badge>
            </div>
            
            <div className="flex overflow-x-auto pb-1 scrollbar-none">
              <Tabs value={activeLocation} onValueChange={(v: any) => setActiveLocation(v)} className="w-full">
                <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto flex flex-nowrap w-fit">
                  <TabsTrigger value="ALL" className="rounded-lg text-[8px] md:text-[9px] font-black uppercase px-3 py-1.5">TODOS</TabsTrigger>
                  <TabsTrigger value="EXPO" className="rounded-lg text-[8px] md:text-[9px] font-black uppercase px-3 py-1.5">EXPO</TabsTrigger>
                  <TabsTrigger value="TERRAZA" className="rounded-lg text-[8px] md:text-[9px] font-black uppercase px-3 py-1.5">TERRAZA</TabsTrigger>
                  <TabsTrigger value="ENTREPLANTA" className="rounded-lg text-[8px] md:text-[9px] font-black uppercase px-3 py-1.5">PLANTA</TabsTrigger>
                  <TabsTrigger value="LAVADERO" className="rounded-lg text-[8px] md:text-[9px] font-black uppercase px-3 py-1.5">LAVADO</TabsTrigger>
                  <TabsTrigger value="ENTREGA" className="rounded-lg text-[8px] md:text-[9px] font-black uppercase px-3 py-1.5">ENTREGA</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 scrollbar-none">
            {loading ? (
              <div className="flex justify-center py-10"><Clock className="animate-spin text-slate-200 w-8 h-8" /></div>
            ) : filteredStock.length === 0 ? (
              <div className="text-center py-20 text-[9px] font-black uppercase text-slate-300 tracking-widest italic">
                Sin unidades en esta ubicación
              </div>
            ) : (
              filteredStock.map((car) => {
                const days = car.fechaEntrada ? differenceInDays(new Date(), parseISO(car.fechaEntrada)) : 0;
                const colorObj = BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW));
                return (
                  <Card key={car.id} onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="border border-slate-50 bg-white hover:border-primary/20 transition-all rounded-2xl shadow-sm overflow-hidden active:scale-[0.98]">
                    <CardContent className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <h4 className="font-black text-[11px] md:text-xs uppercase text-secondary leading-tight truncate max-w-[200px]">{car.modelo}</h4>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] font-bold text-slate-400">{car.vin7}</span>
                            <Badge className={cn("text-[8px] font-black px-2 py-0 h-auto border-none", 
                              days > 60 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                            )}>{days} DÍAS</Badge>
                          </div>
                        </div>
                        <Badge className={cn("text-[9px] font-black uppercase px-3 py-1 border-none rounded-lg", 
                          car.ubicacion?.startsWith('P') ? "bg-primary text-white" : "bg-slate-100 text-secondary"
                        )}>
                          {car.ubicacion}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-full border border-slate-200" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                          <span className="text-[9px] uppercase font-black text-slate-400">{car.colorExterior?.split(' ')[0]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl bg-slate-50 hover:text-red-600" onClick={(e) => { e.stopPropagation(); if(confirm("¿Eliminar?")) deleteDoc(doc(db, "vehiculos", car.id)); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" className="h-8 w-8 rounded-xl bg-secondary text-white">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom Aging Stats Bar */}
        <Card className="premium-card bg-white border-none shadow-sm rounded-2xl shrink-0">
          <CardContent className="p-4 flex items-center justify-between gap-4">
             <div className="flex-1 space-y-1">
                <div className="flex justify-between text-[8px] font-black uppercase text-slate-400">
                  <span>Aging Crítico (+60d)</span>
                  <span>{stats.aging.plus60} UDS</span>
                </div>
                <Progress value={(stats.aging.plus60 / (stats.total || 1)) * 100} className="h-1 bg-slate-50" />
             </div>
             <Link href="/history">
               <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-slate-50 text-slate-400">
                 <History className="w-5 h-5" />
               </Button>
             </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

