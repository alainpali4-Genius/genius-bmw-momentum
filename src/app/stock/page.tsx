
'use client';

import { useState, useMemo } from "react";
import { 
  Search, 
  Plus, 
  Loader2, 
  Trash2,
  Car,
  MapPin,
  Clock,
  Droplets,
  ArrowRightCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { BMW_COLORS } from "../showroom/page";

type FilterType = 'all' | 'terraza' | 'entreplanta' | 'lavadero' | 'entrega' | 'exposicion' | 'aging';

export default function StockManagement() {
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const vehiculosQuery = useMemo(() => query(collection(db, "vehiculos"), orderBy("createdAt", "desc")), [db]);
  const { data: vehiculosRaw, loading } = useCollection(vehiculosQuery);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const vehiculos = useMemo(() => (vehiculosRaw || []) as any[], [vehiculosRaw]);

  const filteredVehiculos = useMemo(() => {
    let result = vehiculos;
    const filter = activeFilter.toLowerCase();

    if (filter === 'terraza') result = result.filter(v => v.ubicacion?.toLowerCase() === 'terraza');
    else if (filter === 'entreplanta') result = result.filter(v => v.ubicacion?.toLowerCase() === 'entreplanta');
    else if (filter === 'lavadero') result = result.filter(v => v.ubicacion?.toLowerCase() === 'lavadero');
    else if (filter === 'entrega') result = result.filter(v => v.ubicacion?.toLowerCase().includes('entrega'));
    else if (filter === 'exposicion') result = result.filter(v => v.ubicacion?.startsWith('P'));
    else if (filter === 'aging') result = result.filter(v => v.fechaEntrada && differenceInDays(new Date(), parseISO(v.fechaEntrada)) > 60);

    const s = searchTerm.toLowerCase();
    if (s) {
      result = result.filter(v => 
        v.modelo?.toLowerCase().includes(s) || v.vin?.toLowerCase().includes(s) || v.vin7?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [vehiculos, searchTerm, activeFilter]);

  const stats = useMemo(() => ({
    total: vehiculos.length,
    terraza: vehiculos.filter(v => v.ubicacion?.toLowerCase() === 'terraza').length,
    entreplanta: vehiculos.filter(v => v.ubicacion?.toLowerCase() === 'entreplanta').length,
    lavadero: vehiculos.filter(v => v.ubicacion?.toLowerCase() === 'lavadero').length,
    entrega: vehiculos.filter(v => v.ubicacion?.toLowerCase().includes('entrega')).length,
    exposicion: vehiculos.filter(v => v.ubicacion?.startsWith('P')).length,
    aging: vehiculos.filter(v => v.fechaEntrada && differenceInDays(new Date(), parseISO(v.fechaEntrada)) > 60).length
  }), [vehiculos]);

  const QuickFilterCard = ({ type, label, val, color, icon: Icon }: any) => {
    const isActive = activeFilter === type;
    return (
      <Card 
        onClick={() => setActiveFilter(isActive ? 'all' : type)}
        className={cn(
          "premium-card border-none shadow-sm cursor-pointer transition-all h-24 flex items-center bg-white", 
          isActive && "ring-2 ring-primary bg-primary/5 shadow-md scale-105 z-10"
        )}
      >
        <CardContent className="p-4 w-full">
          <p className={cn("text-[8px] font-black uppercase mb-1 tracking-widest", isActive ? "text-primary" : "text-slate-400")}>{label}</p>
          <div className="flex items-end justify-between">
            <p className={cn("text-xl font-black leading-none", isActive ? "text-primary" : color)}>{val}</p>
            <Icon className={cn("w-5 h-5 opacity-20", isActive && "opacity-80 text-primary")} />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 h-full flex flex-col overflow-hidden">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-black text-secondary uppercase italic leading-none tracking-tighter">STOCK <span className="text-primary not-italic">VN</span></h1>
          <p className="text-muted-foreground mt-1 text-[10px] font-black uppercase tracking-widest">LOGÍSTICA MOMENTUM NAVARRA</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-12 text-[10px] font-black uppercase rounded-xl border-slate-200" onClick={() => router.push('/showroom')}>
            PLANO EXPOSICIÓN
          </Button>
          <Button className="h-12 bg-secondary text-white text-[10px] font-black uppercase rounded-xl px-6" onClick={() => router.push('/showroom?add=true')}>
            <Plus className="w-4 h-4 mr-2" /> NUEVA ALTA
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 shrink-0">
        <QuickFilterCard type="exposicion" label="EXPOSICIÓN" val={stats.exposicion} color="text-secondary" icon={Car} />
        <QuickFilterCard type="terraza" label="TERRAZA" val={stats.terraza} color="text-blue-500" icon={MapPin} />
        <QuickFilterCard type="entreplanta" label="ENTREPLANTA" val={stats.entreplanta} color="text-blue-700" icon={MapPin} />
        <QuickFilterCard type="entrega" label="ZONA ENTREGA" val={stats.entrega} color="text-emerald-600" icon={ArrowRightCircle} />
        <QuickFilterCard type="lavadero" label="LAVADERO" val={stats.lavadero} color="text-sky-500" icon={Droplets} />
        <QuickFilterCard type="aging" label="STOCK AGING" val={stats.aging} color="text-red-600" icon={Clock} />
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
        <Input 
          className="pl-12 h-14 bg-white border-none shadow-sm rounded-xl text-xs font-black uppercase tracking-widest" 
          placeholder="BUSCAR POR MODELO O BASTIDOR..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
        />
      </div>

      <Card className="premium-card flex-1 overflow-hidden border-none shadow-sm rounded-2xl bg-white">
        <div className="h-full overflow-y-auto scrollbar-none">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10">
              <TableRow className="border-none h-14">
                <TableHead className="font-black text-[10px] uppercase px-6">Modelo</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Color</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Bastidor</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Ubicación</TableHead>
                <TableHead className="font-black text-[10px] uppercase text-center">Días</TableHead>
                <TableHead className="text-right px-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></TableCell></TableRow>
              ) : filteredVehiculos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Sin resultados</TableCell></TableRow>
              ) : filteredVehiculos.map((car) => {
                const days = car.fechaEntrada ? differenceInDays(new Date(), parseISO(car.fechaEntrada)) : 0;
                const colorObj = BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW));
                return (
                  <TableRow key={car.id} onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="hover:bg-slate-50/50 cursor-pointer border-slate-50 h-16 group">
                    <TableCell className="font-black text-[11px] uppercase text-secondary px-6">{car.modelo}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-200" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                        <span className="text-[9px] uppercase font-bold text-slate-500">{car.colorExterior?.slice(0, 15)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[10px] font-bold text-slate-400">{car.vin7}</TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "text-[9px] font-black uppercase px-4 py-1 border-none", 
                        car.ubicacion?.startsWith('P') ? "bg-primary text-white" : "bg-slate-100 text-secondary"
                      )}>
                        {car.ubicacion}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("text-[11px] font-black", days > 60 ? "text-red-600" : "text-secondary")}>{days} d</span>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button variant="ghost" size="icon" className="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); if(confirm("¿Eliminar?")) deleteDoc(doc(db, "vehiculos", car.id)); }}>
                        <Trash2 className="w-4 h-4 text-slate-300 hover:text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
