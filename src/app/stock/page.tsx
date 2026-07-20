
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
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { BMW_COLORS } from "../showroom/page";

type FilterType = 'all' | 'terraza' | 'entreplanta' | 'lavadero' | 'entrega' | 'exposicion';

export default function StockManagement() {
  const db = useFirestore();
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
    exposicion: vehiculos.filter(v => v.ubicacion?.startsWith('P')).length,
    terraza: vehiculos.filter(v => v.ubicacion?.toLowerCase() === 'terraza').length,
    entreplanta: vehiculos.filter(v => v.ubicacion?.toLowerCase() === 'entreplanta').length,
    lavadero: vehiculos.filter(v => v.ubicacion?.toLowerCase() === 'lavadero').length,
    entrega: vehiculos.filter(v => v.ubicacion?.toLowerCase().includes('entrega')).length,
  }), [vehiculos]);

  const QuickFilterCard = ({ type, label, val, color, icon: Icon }: any) => {
    const isActive = activeFilter === type;
    return (
      <Card 
        onClick={() => setActiveFilter(isActive ? 'all' : type)}
        className={cn(
          "border-none shadow-sm cursor-pointer transition-all h-12 flex items-center bg-white rounded-md shrink-0", 
          isActive && "ring-2 ring-primary bg-primary/5"
        )}
      >
        <CardContent className="p-1.5 px-2.5 w-full">
          <p className={cn("text-[6px] font-black uppercase mb-0.5 tracking-widest", isActive ? "text-primary" : "text-slate-400")}>{label}</p>
          <div className="flex items-center justify-between">
            <p className={cn("text-xs font-black leading-none", isActive ? "text-primary" : color)}>{val}</p>
            <Icon className={cn("w-2.5 h-2.5 opacity-20", isActive && "opacity-80 text-primary")} />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-1.5 md:p-6 max-w-[1600px] mx-auto h-screen flex flex-col overflow-hidden">
      {/* Header Compacto */}
      <div className="flex justify-between items-center gap-2 mb-2 shrink-0 px-1">
        <h1 className="text-sm md:text-2xl font-black text-secondary uppercase italic tracking-tighter">STOCK <span className="text-primary not-italic">VN</span></h1>
        <div className="flex gap-1.5">
          <Button variant="outline" className="h-8 text-[8px] font-black uppercase rounded-md" onClick={() => router.push('/showroom')}>PLANO</Button>
          <Button className="h-8 bg-secondary text-white text-[8px] font-black uppercase rounded-md shadow-md" onClick={() => router.push('/showroom?add=true')}>
            <Plus className="w-3 h-3 mr-1" /> ALTA
          </Button>
        </div>
      </div>

      {/* Filtros Compactos */}
      <div className="grid grid-cols-5 gap-1 mb-2 shrink-0">
        <QuickFilterCard type="exposicion" label="EXPO" val={stats.exposicion} color="text-secondary" icon={Car} />
        <QuickFilterCard type="terraza" label="TERRAZA" val={stats.terraza} color="text-blue-500" icon={MapPin} />
        <QuickFilterCard type="entreplanta" label="PLANTA" val={stats.entreplanta} color="text-blue-700" icon={MapPin} />
        <QuickFilterCard type="entrega" label="ENTREGA" val={stats.entrega} color="text-emerald-600" icon={ArrowRightCircle} />
        <QuickFilterCard type="lavadero" label="LAVADO" val={stats.lavadero} color="text-sky-500" icon={Droplets} />
      </div>

      <div className="relative mb-2 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
        <Input 
          className="pl-9 h-9 bg-white border-none shadow-sm rounded-md text-[9px] font-black uppercase" 
          placeholder="BUSCAR MODELO O BASTIDOR..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
        />
      </div>

      {/* Listado Principal */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filteredVehiculos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border-2 border-dashed border-slate-50 font-black uppercase text-[8px] text-slate-300">Sin resultados</div>
        ) : (
          <div className="h-full overflow-y-auto scrollbar-none pb-20">
            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow className="border-none h-10">
                    <TableHead className="font-black text-[9px] uppercase">Modelo</TableHead>
                    <TableHead className="font-black text-[9px] uppercase">Color</TableHead>
                    <TableHead className="font-black text-[9px] uppercase">Bastidor</TableHead>
                    <TableHead className="font-black text-[9px] uppercase">Ubicación</TableHead>
                    <TableHead className="font-black text-[9px] uppercase text-center">Días</TableHead>
                    <TableHead className="text-right px-4">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehiculos.map((car) => {
                    const days = car.fechaEntrada ? differenceInDays(new Date(), parseISO(car.fechaEntrada)) : 0;
                    const colorObj = BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW));
                    return (
                      <TableRow key={car.id} onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="hover:bg-slate-50/50 cursor-pointer h-12 border-slate-50 group">
                        <TableCell className="font-black text-[10px] uppercase text-secondary">{car.modelo}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                            <span className="text-[8px] uppercase font-bold text-slate-500 truncate max-w-[100px]">{car.colorExterior}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[9px] font-bold text-slate-400">{car.vin7}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-[8px] font-black uppercase px-2 py-0.5 border-none", car.ubicacion?.startsWith('P') ? "bg-primary text-white" : "bg-slate-100 text-secondary")}>{car.ubicacion}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-black text-[10px]">{days}D</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); if(confirm("¿Eliminar?")) deleteDoc(doc(db, "vehiculos", car.id)); }}>
                            <Trash2 className="w-3.5 h-3.5 text-slate-200 hover:text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-1">
              {filteredVehiculos.map((car) => {
                const days = car.fechaEntrada ? differenceInDays(new Date(), parseISO(car.fechaEntrada)) : 0;
                const colorObj = BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW));
                return (
                  <Card key={car.id} onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="bg-white border-none shadow-sm rounded-md active:scale-[0.99]">
                    <CardContent className="p-2 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-[9px] uppercase text-secondary leading-none truncate">{car.modelo}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[7px] font-bold text-slate-400">{car.vin7}</span>
                          <span className="text-[7px] font-black text-slate-300">{days}D</span>
                          <div className="w-1.5 h-1.5 rounded-full border border-slate-200 ml-1" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={cn("text-[6px] font-black uppercase px-1.5 py-0.5 border-none", car.ubicacion?.startsWith('P') ? "bg-primary text-white" : "bg-slate-100 text-secondary")}>{car.ubicacion}</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-200" onClick={(e) => { e.stopPropagation(); if(confirm("¿Eliminar?")) deleteDoc(doc(db, "vehiculos", car.id)); }}>
                          <Trash2 className="w-3 h-3" />
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
