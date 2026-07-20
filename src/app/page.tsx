
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
    { label: "TOTAL", value: stats.total, icon: Package, color: "text-[#00AEEF]" },
    { label: "EXPO", value: stats.expo, icon: Grid3X3, color: "text-[#003399]" },
    { label: "DEMO", value: stats.demo, icon: Car, color: "text-[#003399]" },
    { label: "RESERV", value: stats.reserved, icon: CalendarCheck, color: "text-[#ED1C24]" },
    { label: "PREP", value: stats.prep, icon: Clock, color: "text-[#ED1C24]" },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f4f7fa]">
      {/* Header Compacto */}
      <div className="p-1.5 md:p-3 space-y-1.5 shrink-0">
        <div className="bg-[#003399] rounded-lg p-2 md:p-3 text-white shadow-md">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base md:text-xl font-black italic tracking-tighter leading-none shrink-0">
              MOMENTUM <span className="text-white not-italic">VN</span>
            </h1>

            <div className="flex gap-1.5 w-full max-w-[400px]">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40" />
                <Input 
                  className="h-8 bg-white/10 border-none rounded-md text-[9px] font-black uppercase placeholder:text-white/20 pl-8 text-white" 
                  placeholder="BUSCAR VIN7 O MODELO..."
                  value={fastSearch}
                  onChange={(e) => setFastSearch(e.target.value)}
                />
              </div>
              <Button onClick={() => router.push(`/showroom?s=${fastSearch}`)} className="h-8 w-8 rounded-md bg-[#ED1C24] hover:bg-red-700 p-0 border-none shrink-0">
                <Scan className="h-4 w-4 text-white" />
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs Compactos */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="min-w-[75px] md:min-w-0 flex-1 h-12 bg-white border-none shadow-sm rounded-md">
              <CardContent className="p-1.5 px-2.5 h-full flex flex-col justify-center">
                <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{kpi.label}</p>
                <div className="flex justify-between items-center">
                  <p className="text-xs md:text-sm font-black text-slate-800 leading-none">{kpi.value}</p>
                  <kpi.icon className={cn("w-2.5 h-2.5 opacity-20", kpi.color)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Listado de Stock Expandido */}
      <div className="flex-1 px-1.5 md:px-3 pb-2 overflow-hidden flex flex-col">
        <div className="bg-white rounded-lg shadow-sm border-none flex-1 overflow-hidden flex flex-col">
          <div className="p-1.5 md:p-2 border-b shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tabs value={activeLocation} onValueChange={(v: any) => setActiveLocation(v)}>
                <TabsList className="bg-slate-50 p-0.5 rounded-md h-7">
                  <TabsTrigger value="ALL" className="text-[7px] font-black uppercase px-2 h-6">STOCK</TabsTrigger>
                  <TabsTrigger value="EXPO" className="text-[7px] font-black uppercase px-2 h-6">EXPO</TabsTrigger>
                  <TabsTrigger value="TERRAZA" className="text-[7px] font-black uppercase px-2 h-6">TERRAZA</TabsTrigger>
                  <TabsTrigger value="ENTREPLANTA" className="text-[7px] font-black uppercase px-2 h-6">PLANTA</TabsTrigger>
                  <TabsTrigger value="LAVADERO" className="text-[7px] font-black uppercase px-2 h-6">LAVADO</TabsTrigger>
                  <TabsTrigger value="ENTREGA" className="text-[7px] font-black uppercase px-2 h-6">ENTREGA</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Badge variant="outline" className="text-[7px] font-black px-1.5 py-0.5 rounded-sm bg-slate-50 border-none">
              {filteredStock.length} U
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 md:p-2 space-y-1 scrollbar-none">
            {loading ? (
              <div className="flex justify-center py-10"><Clock className="animate-spin text-slate-200 h-5 w-5" /></div>
            ) : filteredStock.length === 0 ? (
              <div className="text-center py-20 text-[8px] font-black uppercase text-slate-300 tracking-widest italic">Sin unidades</div>
            ) : (
              filteredStock.map((car) => {
                const colorObj = BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW));
                return (
                  <Card key={car.id} onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="border border-slate-50 bg-white hover:border-primary/20 transition-all rounded-md shadow-sm overflow-hidden active:scale-[0.99] group cursor-pointer">
                    <CardContent className="p-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="h-7 w-7 bg-slate-50 rounded flex items-center justify-center shrink-0">
                          <Car className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h4 className="font-black text-[9px] uppercase text-secondary leading-none truncate">{car.modelo}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[7px] font-bold text-slate-400">{car.vin7}</span>
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full border border-slate-200" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                              <span className="text-[6px] font-black text-slate-400 uppercase truncate">{colorObj?.name.split(' ')[0]}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={cn("text-[6px] font-black uppercase px-1 py-0.5 border-none rounded-md", 
                          car.ubicacion?.startsWith('P') ? "bg-primary text-white" : "bg-slate-100 text-secondary"
                        )}>
                          {car.ubicacion}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md text-slate-200 hover:text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); if(confirm("¿Eliminar?")) deleteDoc(doc(db, "vehiculos", car.id)); }}>
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
