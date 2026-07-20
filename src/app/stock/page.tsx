
'use client';

import { useState, useMemo } from "react";
import { 
  Search, 
  Plus, 
  Loader2, 
  Trash2,
  Car,
  MapPin,
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
          "border-none shadow-sm cursor-pointer transition-all h-14 md:h-16 flex items-center bg-white rounded-lg", 
          isActive && "ring-2 ring-primary bg-primary/5 shadow-md scale-[1.02] z-10"
        )}
      >
        <CardContent className="p-2 md:p-3 w-full">
          <p className={cn("text-[6px] md:text-[7px] font-black uppercase mb-0.5 tracking-widest", isActive ? "text-primary" : "text-slate-400")}>{label}</p>
          <div className="flex items-end justify-between">
            <p className={cn("text-xs md:text-lg font-black leading-none", isActive ? "text-primary" : color)}>{val}</p>
            <Icon className={cn("w-3 h-3 md:w-4 md:h-4 opacity-20", isActive && "opacity-80 text-primary")} />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-2 md:p-6 max-w-[1600px] mx-auto space-y-2 md:space-y-4 h-full flex flex-col overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4 shrink-0">
        <div>
          <h1 className="text-lg md:text-2xl font-black text-secondary uppercase italic leading-none tracking-tighter">STOCK <span className="text-primary not-italic">VN</span></h1>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none h-8 md:h-10 text-[7px] md:text-[9px] font-black uppercase rounded-lg border-slate-200" onClick={() => router.push('/showroom')}>
            PLANO
          </Button>
          <Button className="flex-1 md:flex-none h-8 md:h-10 bg-secondary text-white text-[7px] md:text-[9px] font-black uppercase rounded-lg shadow-lg" onClick={() => router.push('/showroom?add=true')}>
            <Plus className="w-3 w-3 mr-1" /> NUEVA ALTA
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1 md:gap-3 shrink-0">
        <QuickFilterCard type="exposicion" label="EXPO" val={stats.exposicion} color="text-secondary" icon={Car} />
        <QuickFilterCard type="terraza" label="TERRAZA" val={stats.terraza} color="text-blue-500" icon={MapPin} />
        <QuickFilterCard type="entreplanta" label="PLANTA" val={stats.entreplanta} color="text-blue-700" icon={MapPin} />
        <QuickFilterCard type="entrega" label="ENTREGA" val={stats.entrega} color="text-emerald-600" icon={ArrowRightCircle} />
        <QuickFilterCard type="lavadero" label="LAVADO" val={stats.lavadero} color="text-sky-500" icon={Droplets} />
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
        <Input 
          className="pl-9 h-9 md:h-11 bg-white border-none shadow-sm rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest" 
          placeholder="BUSCAR POR MODELO O BASTIDOR..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filteredVehiculos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-100 font-black uppercase text-[8px] text-slate-300 tracking-widest">Sin resultados</div>
        ) : (
          <div className="h-full overflow-y-auto scrollbar-none pb-24 md:pb-4">
            <div className="hidden md:block bg-white rounded-xl shadow-sm border-none overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow className="border-none h-12">
                    <TableHead className="font-black text-[9px] uppercase px-6">Modelo</TableHead>
                    <TableHead className="font-black text-[9px] uppercase">Color</TableHead>
                    <TableHead className="font-black text-[9px] uppercase">Bastidor</TableHead>
                    <TableHead className="font-black text-[9px] uppercase">Ubicación</TableHead>
                    <TableHead className="font-black text-[9px] uppercase text-center">Días</TableHead>
                    <TableHead className="text-right px-6">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehiculos.map((car) => {
                    const days = car.fechaEntrada ? differenceInDays(new Date(), parseISO(car.fechaEntrada)) : 0;
                    const colorObj = BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW));
                    return (
                      <TableRow key={car.id} onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="hover:bg-slate-50/50 cursor-pointer border-slate-50 h-14 group">
                        <TableCell className="font-black text-[10px] uppercase text-secondary px-6">{car.modelo}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                            <span className="text-[8px] uppercase font-bold text-slate-500">{car.colorExterior?.slice(0, 15)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[9px] font-bold text-slate-400">{car.vin7}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[8px] font-black uppercase px-3 py-0.5 border-none", 
                            car.ubicacion?.startsWith('P') ? "bg-primary text-white" : "bg-slate-100 text-secondary"
                          )}>
                            {car.ubicacion}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn("text-[10px] font-black", days > 60 ? "text-red-600" : "text-secondary")}>{days} d</span>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <Button variant="ghost" size="icon" className="rounded-md opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); if(confirm("¿Eliminar?")) deleteDoc(doc(db, "vehiculos", car.id)); }}>
                            <Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="md:hidden space-y-1.5">
              {filteredVehiculos.map((car) => {
                const days = car.fechaEntrada ? differenceInDays(new Date(), parseISO(car.fechaEntrada)) : 0;
                const colorObj = BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW));
                return (
                  <Card key={car.id} onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="bg-white border-none shadow-sm rounded-lg overflow-hidden active:scale-[0.98] transition-all">
                    <CardContent className="p-2.5 flex flex-col gap-1.5">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <h3 className="font-black text-[9px] uppercase text-secondary leading-tight line-clamp-1">{car.modelo}</h3>
                          <div className="flex items-center gap-1.5">
                            <p className="font-mono text-[8px] font-bold text-slate-400">{car.vin7}</p>
                            <span className={cn("text-[8px] font-black", days > 60 ? "text-red-600" : "text-slate-300")}>{days}D</span>
                          </div>
                        </div>
                        <Badge className={cn(
                          "text-[6px] font-black uppercase px-1.5 py-0.5 border-none h-fit", 
                          car.ubicacion?.startsWith('P') ? "bg-primary text-white" : "bg-slate-100 text-secondary"
                        )}>
                          {car.ubicacion}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full border border-slate-200" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                          <span className="text-[7px] uppercase font-black text-slate-400">{colorObj?.name.split(' ')[0]}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md bg-slate-50" onClick={(e) => { e.stopPropagation(); if(confirm("¿Eliminar?")) deleteDoc(doc(db, "vehiculos", car.id)); }}>
                          <Trash2 className="w-2.5 h-2.5 text-slate-300" />
                        </Button>
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
