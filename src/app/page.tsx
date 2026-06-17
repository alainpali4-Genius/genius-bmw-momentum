'use client';

import { useMemo, useState, useEffect } from "react";
import { 
  Package, Grid3X3, Car, CalendarCheck, Clock, Search, ChevronRight, TrendingUp, Scan, ShieldCheck, History
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, query, orderBy } from "firebase/firestore";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function GeniusDashboard() {
  const db = useFirestore();
  const router = useRouter();
  const { data: vehiculosRaw, loading } = useCollection(query(collection(db, "vehiculos"), orderBy("createdAt", "desc")));
  const vehiculos = (vehiculosRaw || []) as any[];
  const [fastSearch, setFastSearch] = useState("");

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
            fechaEntrada: "2026-06-01",
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

  const stats = useMemo(() => {
    const total = vehiculos.length;
    const expo = vehiculos.filter(v => v.ubicacion?.startsWith('P')).length;
    const stock = vehiculos.filter(v => v.estado === 'Stock').length;
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

    return { total, expo, stock, demo, reserved, prep, aging, avgDays };
  }, [vehiculos]);

  const kpis = [
    { label: "TOTAL VN", value: stats.total, icon: Package, href: "/stock", color: "text-[#00AEEF]", bg: "bg-white" },
    { label: "EXPO", value: stats.expo, icon: Grid3X3, href: "/showroom", color: "text-[#003399]", bg: "bg-white" },
    { label: "DEMO", value: stats.demo, icon: Car, href: "/showroom", color: "text-[#003399]", bg: "bg-white" },
    { label: "RESERVADOS", value: stats.reserved, icon: CalendarCheck, href: "/showroom", color: "text-[#ED1C24]", bg: "bg-white" },
    { label: "PREP", value: stats.prep, icon: Clock, href: "/showroom", color: "text-[#ED1C24]", bg: "bg-white" },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6 animate-in fade-in duration-500 h-full overflow-hidden">
      <div className="bg-[#003399] rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-32 -translate-y-32 blur-3xl" />
        <div className="relative z-10 space-y-5">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-3xl font-black tracking-tighter uppercase italic leading-none">
              LOCALIZADOR <span className="text-white not-italic">VN7</span>
            </h1>
            <p className="text-white/30 text-[9px] font-black uppercase tracking-[0.3em]">Momentum Navarra • Operativa Premium</p>
          </div>

          <div className="flex gap-2 max-w-lg">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <Input 
                className="h-12 bg-white/10 border-none rounded-xl text-lg font-black uppercase placeholder:text-white/10 pl-11 focus:bg-white/15 transition-all" 
                placeholder="BUSCAR BASTIDOR..."
                value={fastSearch}
                onChange={(e) => setFastSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && router.push(`/showroom?s=${fastSearch}`)}
              />
            </div>
            <Button onClick={() => router.push(`/showroom?s=${fastSearch}`)} className="h-12 w-12 rounded-xl bg-[#ED1C24] hover:scale-105 shadow-lg border-none transition-all">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card className={cn("premium-card hover:border-[#ED1C24] transition-all border-none group h-24 flex items-center", kpi.bg)}>
              <CardContent className="p-5 w-full">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest transition-colors">{kpi.label}</p>
                    <p className="text-2xl font-black text-slate-800 leading-none">{kpi.value}</p>
                  </div>
                  <kpi.icon className={cn("w-5 h-5 opacity-40", kpi.color)} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 premium-card overflow-hidden bg-white rounded-2xl">
          <div className="p-5 border-b flex justify-between items-center bg-slate-50/50">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#00AEEF]" /> AGING STOCK
            </h3>
            <Badge variant="outline" className="text-[8px] font-black px-3 py-1 rounded-lg">MEDIA: {stats.avgDays} DÍAS</Badge>
          </div>
          <CardContent className="p-8 space-y-6">
            {[
              { label: "ENVEJECIDO (> 30 DÍAS)", val: stats.aging.plus30, color: "bg-[#00AEEF]" },
              { label: "ALERTA (> 60 DÍAS)", val: stats.aging.plus60, color: "bg-[#003399]" },
              { label: "CRÍTICO (> 90 DÍAS)", val: stats.aging.plus90, color: "bg-[#ED1C24]" },
            ].map((alert) => (
              <div key={alert.label} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{alert.label}</span>
                  <span className="text-sm font-black text-slate-800">{alert.val} UND.</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                   <div 
                    className={cn("h-full transition-all duration-500", alert.color)} 
                    style={{ width: `${(alert.val / (stats.total || 1)) * 100}%` }} 
                   />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Link href="/inventory" className="flex-1">
            <Button className="w-full h-full min-h-[140px] rounded-2xl bg-[#003399] hover:bg-[#ED1C24] flex flex-col items-center justify-center gap-3 shadow-xl text-white group transition-all border-none">
              <Scan className="w-8 h-8 group-hover:scale-110 transition-transform" />
              <div className="text-center">
                <span className="text-xs font-black uppercase tracking-widest block">INVENTARIO IA</span>
                <span className="text-[7px] opacity-40 uppercase font-black tracking-widest">AUDITORÍA RÁPIDA</span>
              </div>
            </Button>
          </Link>
          
          <div className="grid grid-cols-2 gap-4">
            <Link href="/incidents">
              <Button variant="outline" className="w-full h-16 rounded-2xl border-slate-100 bg-white flex flex-col items-center justify-center gap-0.5 hover:text-[#ED1C24] transition-all hover:border-[#ED1C24]/20 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-[#ED1C24]" />
                <span className="text-[8px] font-black uppercase tracking-widest">INCIDENCIAS</span>
              </Button>
            </Link>
            <Link href="/history">
              <Button variant="outline" className="w-full h-16 rounded-2xl border-slate-100 bg-white flex flex-col items-center justify-center gap-0.5 hover:text-[#ED1C24] transition-all hover:border-[#ED1C24]/20 shadow-sm">
                <History className="w-4 h-4 text-slate-400" />
                <span className="text-[8px] font-black uppercase tracking-widest">HISTORIAL</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
