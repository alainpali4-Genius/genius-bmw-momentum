
'use client';

import { useMemo, useState, useEffect } from "react";
import { 
  Package, Grid3X3, Car, CalendarCheck, Clock, Search, Scan, Trash2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
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
    
    if (activeLocation === 'EXPO') list = list.filter(v => v.ubicacion?.startsWith('P'));
    else if (activeLocation === 'TERRAZA') list = list.filter(v => v.ubicacion?.toLowerCase() === 'terraza');
    else if (activeLocation === 'ENTREPLANTA') list = list.filter(v => v.ubicacion?.toLowerCase() === 'entreplanta');
    else if (activeLocation === 'LAVADERO') list = list.filter(v => v.ubicacion?.toLowerCase() === 'lavadero');
    else if (activeLocation === 'ENTREGA') list = list.filter(v => v.ubicacion?.toLowerCase().includes('entrega'));
    else if (activeLocation === 'STOCK') list = list.filter(v => v.ubicacion?.toLowerCase() === 'stock');

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
    { label: "TOTAL", value: stats.total, icon: Package, href: "/stock", color: "text-[#00AEEF]" },
    { label: "EXPO", value: stats.expo, icon: Grid3X3, href: "/showroom", color: "text-[#003399]" },
    { label: "DEMO", value: stats.demo, icon: Car, href: "/showroom", color: "text-[#003399]" },
    { label: "RESERV", value: stats.reserved, icon: CalendarCheck, href: "/showroom", color: "text-[#ED1C24]" },
    { label: "PREP", value: stats.prep, icon: Clock, href: "/showroom", color: "text-[#ED1C24]" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f4f7fa]">
      <div className="p-2 md:p-4 space-y-2 shrink-0">
        <div className="bg-[#003399] rounded-xl p-3 md:p-4 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-3">
            <h1 className="text-lg md:text-xl font-black tracking-tighter uppercase italic leading-none">
              MOMENTUM <span className="text-white not-italic">VN</span>
            </h1>

            <div className="flex gap-2 w-full md:w-[350px]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                <Input 
                  className="h-9 bg-white/10 border-none rounded-lg text-[10px] font-black uppercase placeholder:text-white/20 pl-9 text-white" 
                  placeholder="BUSCAR VIN7 O MODELO..."
                  value={fastSearch}
                  onChange={(e) => setFastSearch(e.target.value)}
                />
              </div>
              <Button onClick={() => router.push(`/showroom?s=${fastSearch}`)} className="h-9 w-9 rounded-lg bg-[#ED1C24] hover:scale-105 border-none transition-all">
                <Scan className="h-4 w-4 text-white" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex md:grid md:grid-cols-5 gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="min-w-[85px] md:min-w-0 flex-1 h-14 bg-white border-none shadow-sm rounded-lg overflow-hidden">
              <CardContent className="p-2 px-3 h-full flex flex-col justify-center">
                <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest leading-none">{kpi.label}</p>
                <div className="flex justify-between items-end mt-1">
                  <p className="text-sm font-black text-slate-800 leading-none">{kpi.value}</p>
                  <kpi.icon className={cn("w-3 h-3 opacity-20", kpi.color)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex-1 px-2 md:px-4 pb-20 md:pb-4 overflow-hidden flex flex-col">
        <div className="bg-white rounded-xl shadow-sm border-none flex-1 overflow-hidden flex flex-col">
          <div className="p-2 md:p-3 border-b shrink-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-[8px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5">
                <Package className="h-3 w-3 text-[#00AEEF]" /> STOCK VN
              </h3>
              <Tabs value={activeLocation} onValueChange={(v: any) => setActiveLocation(v)} className="hidden sm:block">
                <TabsList className="bg-slate-100/50 p-0.5 rounded-md h-7">
                  <TabsTrigger value="ALL" className="rounded-sm text-[7px] font-black uppercase px-2.5 h-6">TODOS</TabsTrigger>
                  <TabsTrigger value="EXPO" className="rounded-sm text-[7px] font-black uppercase px-2.5 h-6">EXPO</TabsTrigger>
                  <TabsTrigger value="TERRAZA" className="rounded-sm text-[7px] font-black uppercase px-2.5 h-6">TERRAZA</TabsTrigger>
                  <TabsTrigger value="ENTREPLANTA" className="rounded-sm text-[7px] font-black uppercase px-2.5 h-6">PLANTA</TabsTrigger>
                  <TabsTrigger value="LAVADERO" className="rounded-sm text-[7px] font-black uppercase px-2.5 h-6">LAVADO</TabsTrigger>
                  <TabsTrigger value="ENTREGA" className="rounded-sm text-[7px] font-black uppercase px-2.5 h-6">ENTREGA</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <Badge variant="outline" className="text-[7px] font-black px-1.5 py-0.5 rounded-sm bg-slate-50 border-none">
              {filteredStock.length} UNIDADES
            </Badge>
          </div>

          <div className="sm:hidden px-2 pt-1.5 overflow-x-auto scrollbar-none shrink-0">
            <Tabs value={activeLocation} onValueChange={(v: any) => setActiveLocation(v)} className="w-full">
              <TabsList className="bg-slate-100/50 p-0.5 rounded-md h-6 flex w-fit">
                <TabsTrigger value="ALL" className="text-[6px] font-black px-2 h-5">TODOS</TabsTrigger>
                <TabsTrigger value="EXPO" className="text-[6px] font-black px-2 h-5">EXPO</TabsTrigger>
                <TabsTrigger value="TERRAZA" className="text-[6px] font-black px-2 h-5">TERRAZA</TabsTrigger>
                <TabsTrigger value="ENTREPLANTA" className="text-[6px] font-black px-2 h-5">PLT</TabsTrigger>
                <TabsTrigger value="LAVADERO" className="text-[6px] font-black px-2 h-5">LAV</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-1.5 scrollbar-none">
            {loading ? (
              <div className="flex justify-center py-10"><Clock className="animate-spin text-slate-200 h-6 w-6" /></div>
            ) : filteredStock.length === 0 ? (
              <div className="text-center py-20 text-[7px] font-black uppercase text-slate-300 tracking-widest italic">
                Sin unidades en esta ubicación
              </div>
            ) : (
              filteredStock.map((car) => {
                const days = car.fechaEntrada ? differenceInDays(new Date(), parseISO(car.fechaEntrada)) : 0;
                const colorObj = BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW));
                return (
                  <Card key={car.id} onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="border border-slate-50 bg-white hover:border-primary/20 transition-all rounded-lg shadow-sm overflow-hidden active:scale-[0.99] group">
                    <CardContent className="p-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="h-8 w-8 bg-slate-50 rounded-md flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                          <Car className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h4 className="font-black text-[9px] md:text-[10px] uppercase text-secondary leading-none truncate">{car.modelo}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[7px] font-bold text-slate-400">{car.vin7}</span>
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full border border-slate-200" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                              <span className="text-[6px] font-black text-slate-400 uppercase">{colorObj?.name.split(' ')[0]}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right hidden sm:block">
                           <p className={cn("text-[8px] font-black", days > 60 ? "text-red-600" : "text-emerald-600")}>{days} D</p>
                        </div>
                        <Badge className={cn("text-[7px] font-black uppercase px-1.5 py-0.5 border-none rounded-md", 
                          car.ubicacion?.startsWith('P') ? "bg-primary text-white" : "bg-slate-100 text-secondary"
                        )}>
                          {car.ubicacion}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md bg-slate-50 text-slate-300 hover:text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); if(confirm("¿Eliminar?")) deleteDoc(doc(db, "vehiculos", car.id)); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
