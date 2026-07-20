
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

type FilterType = 'all' | 'terraza' | 'entreplanta' | 'lavadero' | 'entrega' | 'exposicion';

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
    exposicion: vehiculos.filter(v => v.ubicacion?.startsWith('P')).length
  }), [vehiculos]);

  const QuickFilterCard = ({ type, label, val, color, icon: Icon }: any) => {
    const isActive = activeFilter === type;
    return (
      <Card 
        onClick={() => setActiveFilter(isActive ? 'all' : type)}
        className={cn(
          "premium-card border-none shadow-sm cursor-pointer transition-all h-20 md:h-24 flex items-center bg-white", 
          isActive && "ring-2 ring-primary bg-primary/5 shadow-md scale-105 z-10"
        )}
      >
        <CardContent className="p-3 md:p-4 w-full">
          <p className={cn("text-[7px] md:text-[8px] font-black uppercase mb-1 tracking-widest", isActive ? "text-primary" : "text-slate-400")}>{label}</p>
          <div className="flex items-end justify-between">
            <p className={cn("text-lg md:text-xl font-black leading-none", isActive ? "text-primary" : color)}>{val}</p>
            <Icon className={cn("w-4 h-4 md:w-5 md:h-5 opacity-20", isActive && "opacity-80 text-primary")} />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-4 md:space-y-6 h-full flex flex-col overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-secondary uppercase italic leading-none tracking-tighter">STOCK <span className="text-primary not-italic">VN</span></h1>
          <p className="text-muted-foreground mt-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest">LOGÍSTICA MOMENTUM NAVARRA</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none h-10 md:h-12 text-[9px] md:text-[10px] font-black uppercase rounded-xl border-slate-200" onClick={() => router.push('/showroom')}>
            PLANO EXPOSICIÓN
          </Button>
          <Button className="flex-1 md:flex-none h-10 md:h-12 bg-secondary text-white text-[9px] md:text-[10px] font-black uppercase rounded-xl shadow-lg" onClick={() => router.push('/showroom?add=true')}>
            <Plus className="w-4 h-4 mr-1 md:mr-2" /> NUEVA ALTA
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 shrink-0">
        <QuickFilterCard type="exposicion" label="EXPOSICIÓN" val={stats.exposicion} color="text-secondary" icon={Car} />
        <QuickFilterCard type="terraza" label="TERRAZA" val={stats.terraza} color="text-blue-500" icon={MapPin} />
        <QuickFilterCard type="entreplanta" label="ENTREPLANTA" val={stats.entreplanta} color="text-blue-700" icon={MapPin} />
        <QuickFilterCard type="entrega" label="ZONA ENTREGA" val={stats.entrega} color="text-emerald-600" icon={ArrowRightCircle} />
        <QuickFilterCard type="lavadero" label="LAVADERO" val={stats.lavadero} color="text-sky-500" icon={Droplets} />
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
        <Input 
          className="pl-12 h-12 md:h-14 bg-white border-none shadow-sm rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest" 
          placeholder="BUSCAR POR MODELO O BASTIDOR..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredVehiculos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-100 font-black uppercase text-[10px] text-slate-300 tracking-widest">Sin resultados</div>
        ) : (
          <div className="h-full overflow-y-auto scrollbar-none pb-24 md:pb-0">
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border-none overflow-hidden">
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
                  {filteredVehiculos.map((car) => {
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

            <div className="md:hidden space-y-3">
              {filteredVehiculos.map((car) => {
                const days = car.fechaEntrada ? differenceInDays(new Date(), parseISO(car.fechaEntrada)) : 0;
                const colorObj = BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW));
                return (
                  <Card key={car.id} onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="premium-card border-none shadow-sm bg-white overflow-hidden active:scale-[0.98] transition-all">
                    <CardContent className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h3 className="font-black text-[11px] uppercase text-secondary leading-tight line-clamp-1">{car.modelo}</h3>
                          <p className="font-mono text-[10px] font-bold text-slate-400">{car.vin7}</p>
                        </div>
                        <Badge className={cn(
                          "text-[8px] font-black uppercase px-3 py-0.5 border-none h-fit", 
                          car.ubicacion?.startsWith('P') ? "bg-primary text-white" : "bg-slate-100 text-secondary"
                        )}>
                          {car.ubicacion}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                          <span className="text-[9px] uppercase font-black text-slate-500">{car.colorExterior?.split(' ')[0]}</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className={cn("text-[10px] font-black", days > 60 ? "text-red-600" : "text-slate-400")}>{days} DÍAS</span>
                           <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-slate-50" onClick={(e) => { e.stopPropagation(); if(confirm("¿Eliminar?")) deleteDoc(doc(db, "vehiculos", car.id)); }}>
                            <Trash2 className="w-3.5 h-3.5 text-slate-300" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
