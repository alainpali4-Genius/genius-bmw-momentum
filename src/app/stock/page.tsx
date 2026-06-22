
'use client';

import { useState, useMemo, useRef } from "react";
import { 
  Search, 
  Plus, 
  Loader2, 
  FileSpreadsheet,
  Trash2,
  Car,
  Filter,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { BMW_COLORS } from "../showroom/page";

type FilterType = 'all' | 'terraza' | 'entreplanta' | 'lavadero' | 'entrega' | 'aging';

export default function StockManagement() {
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const vehiculosQuery = useMemo(() => query(collection(db, "vehiculos"), orderBy("createdAt", "desc")), [db]);
  const { data: vehiculosRaw, loading } = useCollection(vehiculosQuery);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const vehiculos = useMemo(() => (vehiculosRaw || []) as any[], [vehiculosRaw]);

  const filteredVehiculos = useMemo(() => {
    let result = vehiculos;

    // Filtro por categorías rápidas
    if (activeFilter === 'terraza') {
      result = result.filter(v => v.ubicacion?.toUpperCase().includes('TERRAZA'));
    } else if (activeFilter === 'entreplanta') {
      result = result.filter(v => v.ubicacion?.toUpperCase().includes('ENTREPLANTA'));
    } else if (activeFilter === 'lavadero') {
      result = result.filter(v => v.ubicacion?.toUpperCase().includes('LAVADERO'));
    } else if (activeFilter === 'entrega') {
      result = result.filter(v => v.ubicacion?.toUpperCase().includes('ENTREGA'));
    } else if (activeFilter === 'aging') {
      result = result.filter(v => v.fechaEntrada && differenceInDays(new Date(), parseISO(v.fechaEntrada)) > 60);
    }

    // Filtro por término de búsqueda
    const s = searchTerm.toLowerCase();
    if (s) {
      result = result.filter(v => 
        v.modelo?.toLowerCase().includes(s) ||
        v.vin?.toLowerCase().includes(s) ||
        v.vin7?.toLowerCase().includes(s) ||
        v.ubicacion?.toLowerCase().includes(s) ||
        v.colorExterior?.toLowerCase().includes(s)
      );
    }
    
    return result;
  }, [vehiculos, searchTerm, activeFilter]);

  const stats = useMemo(() => {
    const total = vehiculos.length;
    const terraza = vehiculos.filter(v => v.ubicacion?.toUpperCase().includes('TERRAZA')).length;
    const entreplanta = vehiculos.filter(v => v.ubicacion?.toUpperCase().includes('ENTREPLANTA')).length;
    const lavadero = vehiculos.filter(v => v.ubicacion?.toUpperCase().includes('LAVADERO')).length;
    const entrega = vehiculos.filter(v => v.ubicacion?.toUpperCase().includes('ENTREGA')).length;
    const aging = vehiculos.filter(v => v.fechaEntrada && differenceInDays(new Date(), parseISO(v.fechaEntrada)) > 60).length;
    return { total, terraza, entreplanta, lavadero, entrega, aging };
  }, [vehiculos]);

  const handleDelete = (vehicleId: string, info: string) => {
    if (confirm(`¿Estás seguro de eliminar el vehículo ${info}?`)) {
      const docRef = doc(db, "vehiculos", vehicleId);
      deleteDoc(docRef).then(() => {
          toast({ title: "Vehículo eliminado" });
          addDoc(collection(db, "movimientos"), {
            vehiculoId: vehicleId,
            vehiculoInfo: info,
            tipoAccion: 'Eliminacion',
            fecha: new Date().toISOString(),
            usuario: "OPERADOR STOCK",
            detalles: "Baja manual de inventario."
          });
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
        
        let successCount = 0;
        const creationPromises = jsonData.map(async (row) => {
          const vin = String(row.VIN || row.Bastidor || "").trim().toUpperCase();
          if (!vin) return;
          const payload = {
            vin, vin7: vin.slice(-7), modelo: String(row.Modelo || "BMW"), 
            colorExterior: String(row.Color || "Alpine White III (300)"), 
            colorCodigo: "300", ubicacion: String(row.Ubicacion || "Stock"), 
            estado: "Stock", bodyType: "SUV",
            createdAt: new Date().toISOString(), fechaEntrada: new Date().toISOString().split('T')[0],
            checklist: { lavado: false, combustible: false, documentacion: false, llaves: false, revision: false }
          };
          await addDoc(collection(db, "vehiculos"), payload);
          successCount++;
        });
        await Promise.allSettled(creationPromises);
        toast({ title: "Importación finalizada", description: `Añadidos ${successCount} vehículos.` });
      } catch (error) {
        toast({ variant: "destructive", title: "Error Excel" });
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const QuickFilterCard = ({ type, label, val, color, icon: Icon }: any) => {
    const isActive = activeFilter === type;
    return (
      <Card 
        onClick={() => setActiveFilter(isActive ? 'all' : type)}
        className={cn(
          "premium-card border-none shadow-sm cursor-pointer transition-all active:scale-95 group relative overflow-hidden",
          isActive ? "ring-2 ring-primary bg-primary/5 shadow-md" : "bg-white hover:bg-slate-50"
        )}
      >
        <div className={cn("absolute top-0 right-0 p-2 opacity-5", isActive && "opacity-10")}><Icon className="w-12 h-12" /></div>
        <CardContent className="p-4 relative z-10">
          <p className={cn("text-[8px] font-black uppercase mb-1 tracking-widest", isActive ? "text-primary" : "text-slate-400")}>
            {label}
          </p>
          <div className="flex items-end justify-between">
            <p className={cn("text-xl font-black leading-none", color, isActive && "scale-110 origin-left transition-transform")}>{val}</p>
            {isActive && <X className="w-3 h-3 text-primary animate-in fade-in" />}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto space-y-4 h-full flex flex-col overflow-hidden animate-in fade-in duration-500">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-secondary uppercase italic leading-none">
            CONTROL <span className="text-primary not-italic">VN</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-[9px] font-black uppercase tracking-widest">MOMENTUM NAVARRA • FILTROS ACTIVOS</p>
        </div>
        <div className="flex items-center gap-2">
          {activeFilter !== 'all' && (
            <Button variant="ghost" onClick={() => setActiveFilter('all')} className="h-10 text-[9px] font-black uppercase text-primary">
              <Filter className="w-3.5 h-3.5 mr-2" /> LIMPIAR FILTROS
            </Button>
          )}
          <Button disabled={isImporting} variant="outline" className="h-10 rounded-xl bg-white text-[10px] font-black uppercase tracking-widest px-4 shadow-sm border-slate-200" onClick={() => fileInputRef.current?.click()}>
            <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-slate-400" /> EXCEL
          </Button>
          <Button className="bg-primary hover:bg-[#ED1C24] h-10 rounded-xl text-[10px] font-black uppercase tracking-widest px-6 shadow-lg text-white" onClick={() => router.push('/showroom?add=true')}>
            <Plus className="w-4 h-4 mr-2" /> NUEVO
          </Button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
        <QuickFilterCard type="terraza" label="TERRAZA" val={stats.terraza} color="text-[#00AEEF]" icon={Car} />
        <QuickFilterCard type="entreplanta" label="ENTREPLANTA" val={stats.entreplanta} color="text-secondary" icon={Car} />
        <QuickFilterCard type="entrega" label="ZONA ENTREGA" val={stats.entrega} color="text-emerald-600" icon={Car} />
        <QuickFilterCard type="lavadero" label="LAVADERO" val={stats.lavadero} color="text-blue-400" icon={Car} />
        <QuickFilterCard type="aging" label="AGING > 60D" val={stats.aging} color="text-accent" icon={Car} />
      </div>

      <div className="relative group shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary transition-colors" />
        <Input 
          className="pl-11 h-12 bg-white border-none shadow-sm rounded-xl text-xs font-black uppercase tracking-widest" 
          placeholder="BUSCAR VIN7, MODELO O UBICACIÓN..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="premium-card flex-1 min-h-0 overflow-hidden border-none shadow-sm rounded-xl bg-white">
        <div className="h-full overflow-y-auto">
          <Table>
            <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="font-black text-[9px] uppercase py-4 tracking-widest text-slate-400">Modelo</TableHead>
                <TableHead className="font-black text-[9px] uppercase tracking-widest text-slate-400">Color</TableHead>
                <TableHead className="font-black text-[9px] uppercase tracking-widest text-slate-400">VIN7</TableHead>
                <TableHead className="font-black text-[9px] uppercase tracking-widest text-slate-400">Ubicación</TableHead>
                <TableHead className="font-black text-[9px] uppercase text-center tracking-widest text-slate-400">Aging</TableHead>
                <TableHead className="font-black text-[9px] uppercase text-right tracking-widest text-slate-400 pr-8">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></TableCell></TableRow>
              ) : filteredVehiculos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No hay vehículos con este filtro</TableCell></TableRow>
              ) : filteredVehiculos.map((car) => {
                const days = car.fechaEntrada ? differenceInDays(new Date(), parseISO(car.fechaEntrada)) : 0;
                const colorObj = BMW_COLORS.find(c => c.code === car.colorCodigo || car.colorExterior?.includes(c.code));
                return (
                  <TableRow 
                    key={car.id} 
                    className="hover:bg-slate-50 border-slate-50 group cursor-pointer transition-colors" 
                  >
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7 || car.vin?.slice(-7)}`)} className="font-black text-[10px] text-slate-800 uppercase py-4">{car.modelo}</TableCell>
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7 || car.vin?.slice(-7)}`)}>
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-200" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                        <span className="text-[9px] font-bold text-slate-500 uppercase truncate max-w-[150px]">{car.colorExterior}</span>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7 || car.vin?.slice(-7)}`)} className="font-mono text-[10px] font-bold text-slate-400">{car.vin7 || car.vin?.slice(-7)}</TableCell>
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7 || car.vin?.slice(-7)}`)}>
                      <Badge className={cn(
                        "text-[8px] font-black uppercase px-2.5 py-0.5 rounded-lg border-none shadow-sm",
                        car.ubicacion?.startsWith('P') ? "bg-primary text-white" : "bg-slate-100 text-secondary"
                      )}>
                        {car.ubicacion}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7 || car.vin?.slice(-7)}`)} className="text-center">
                      <div className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-full border text-[8px] font-black",
                        days > 60 ? "border-accent text-accent bg-accent/5" : "border-slate-100 text-slate-400"
                      )}>{days}D</div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-red-600 rounded-lg transition-all" onClick={(e) => { e.stopPropagation(); handleDelete(car.id, `${car.modelo} (${car.vin7})`); }}>
                        <Trash2 className="w-3.5 h-3.5" />
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
