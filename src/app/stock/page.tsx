
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
  X,
  ArrowRightCircle,
  MapPin,
  Clock
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
import { BMW_COLORS } from "../showroom/page";

type FilterType = 'all' | 'terraza' | 'entreplanta' | 'lavadero' | 'entrega' | 'aging' | 'exposicion';

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

    if (activeFilter === 'terraza') {
      result = result.filter(v => v.ubicacion?.toUpperCase().includes('TERRAZA'));
    } else if (activeFilter === 'entreplanta') {
      result = result.filter(v => v.ubicacion?.toUpperCase().includes('ENTREPLANTA'));
    } else if (activeFilter === 'lavadero') {
      result = result.filter(v => v.ubicacion?.toUpperCase().includes('LAVADERO'));
    } else if (activeFilter === 'entrega') {
      result = result.filter(v => v.ubicacion?.toUpperCase().includes('ENTREGA'));
    } else if (activeFilter === 'exposicion') {
      result = result.filter(v => v.ubicacion?.startsWith('P'));
    } else if (activeFilter === 'aging') {
      result = result.filter(v => v.fechaEntrada && differenceInDays(new Date(), parseISO(v.fechaEntrada)) > 60);
    }

    const s = searchTerm.toLowerCase();
    if (s) {
      result = result.filter(v => 
        v.modelo?.toLowerCase().includes(s) ||
        v.vin?.toLowerCase().includes(s) ||
        v.vin7?.toLowerCase().includes(s) ||
        v.ubicacion?.toLowerCase().includes(s)
      );
    }
    
    return result;
  }, [vehiculos, searchTerm, activeFilter]);

  const stats = useMemo(() => {
    return {
      total: vehiculos.length,
      terraza: vehiculos.filter(v => v.ubicacion?.toUpperCase().includes('TERRAZA')).length,
      entreplanta: vehiculos.filter(v => v.ubicacion?.toUpperCase().includes('ENTREPLANTA')).length,
      lavadero: vehiculos.filter(v => v.ubicacion?.toUpperCase().includes('LAVADERO')).length,
      entrega: vehiculos.filter(v => v.ubicacion?.toUpperCase().includes('ENTREGA')).length,
      exposicion: vehiculos.filter(v => v.ubicacion?.startsWith('P')).length,
      aging: vehiculos.filter(v => v.fechaEntrada && differenceInDays(new Date(), parseISO(v.fechaEntrada)) > 60).length
    };
  }, [vehiculos]);

  const handleDelete = (vehicleId: string, info: string) => {
    if (confirm(`¿Eliminar vehículo ${info}?`)) {
      deleteDoc(doc(db, "vehiculos", vehicleId)).then(() => {
          toast({ title: "Vehículo eliminado" });
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
        
        for (const row of jsonData) {
          const vin = String(row.VIN || row.Bastidor || "").trim().toUpperCase();
          if (!vin) continue;
          await addDoc(collection(db, "vehiculos"), {
            vin, vin7: vin.slice(-7), modelo: String(row.Modelo || "BMW"), 
            colorExterior: String(row.Color || "Alpine White III (300)"), 
            colorCodigo: "300", ubicacion: String(row.Ubicacion || "Stock"), 
            estado: "Stock", bodyType: "SUV",
            createdAt: new Date().toISOString(), fechaEntrada: new Date().toISOString().split('T')[0],
            checklist: { lavado: false, combustible: false, documentacion: false, llaves: false, revision: false }
          });
        }
        toast({ title: "Importación finalizada" });
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
          "premium-card border-none shadow-sm cursor-pointer transition-all active:scale-95 bg-white h-24 flex items-center",
          isActive && "ring-2 ring-primary bg-primary/5"
        )}
      >
        <CardContent className="p-4 w-full">
          <p className={cn("text-[8px] font-black uppercase mb-1 tracking-widest", isActive ? "text-primary" : "text-slate-400")}>
            {label}
          </p>
          <div className="flex items-end justify-between">
            <p className={cn("text-xl font-black leading-none", color)}>{val}</p>
            <Icon className={cn("w-5 h-5 opacity-10", isActive && "opacity-40 text-primary")} />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto space-y-4 h-full flex flex-col overflow-hidden">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-black text-secondary uppercase italic leading-none tracking-tighter">
            CONTROL <span className="text-primary not-italic">VN</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-[9px] font-black uppercase tracking-widest">FILTROS OPERATIVOS</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 text-[10px] font-black uppercase tracking-widest" onClick={() => fileInputRef.current?.click()}>
            <FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> EXCEL
          </Button>
          <Button className="bg-primary text-white h-10 text-[10px] font-black uppercase tracking-widest" onClick={() => router.push('/showroom?add=true')}>
            <Plus className="w-4 h-4 mr-2" /> NUEVO
          </Button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 shrink-0">
        <QuickFilterCard type="exposicion" label="EXPOSICIÓN" val={stats.exposicion} color="text-primary" icon={Car} />
        <QuickFilterCard type="terraza" label="TERRAZA" val={stats.terraza} color="text-[#00AEEF]" icon={MapPin} />
        <QuickFilterCard type="entreplanta" label="ENTREPLANTA" val={stats.entreplanta} color="text-secondary" icon={MapPin} />
        <QuickFilterCard type="entrega" label="ZONA ENTREGA" val={stats.entrega} color="text-emerald-600" icon={ArrowRightCircle} />
        <QuickFilterCard type="lavadero" label="LAVADERO" val={stats.lavadero} color="text-blue-400" icon={Filter} />
        <QuickFilterCard type="aging" label="AGING > 60D" val={stats.aging} color="text-accent" icon={Clock} />
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
        <Input 
          className="pl-11 h-12 bg-white border-none shadow-sm rounded-xl text-xs font-black uppercase tracking-widest" 
          placeholder="BUSCAR VIN7, MODELO O UBICACIÓN..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="premium-card flex-1 overflow-hidden border-none shadow-sm rounded-xl bg-white">
        <div className="h-full overflow-y-auto">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10">
              <TableRow className="border-none">
                <TableHead className="font-black text-[9px] uppercase py-4">Modelo</TableHead>
                <TableHead className="font-black text-[9px] uppercase">Color</TableHead>
                <TableHead className="font-black text-[9px] uppercase">VIN7</TableHead>
                <TableHead className="font-black text-[9px] uppercase">Ubicación</TableHead>
                <TableHead className="font-black text-[9px] uppercase text-center">Aging</TableHead>
                <TableHead className="text-right pr-8">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></TableCell></TableRow>
              ) : filteredVehiculos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-20 text-center text-[10px] font-black uppercase text-slate-300">No se encontraron vehículos</TableCell></TableRow>
              ) : filteredVehiculos.map((car) => {
                const days = car.fechaEntrada ? differenceInDays(new Date(), parseISO(car.fechaEntrada)) : 0;
                const colorObj = BMW_COLORS.find(c => c.code === car.colorCodigo || car.colorExterior?.includes(c.code));
                return (
                  <TableRow key={car.id} className="hover:bg-slate-50 group border-slate-50 cursor-pointer">
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="font-black text-[10px] uppercase py-4">{car.modelo}</TableCell>
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7}`)}>
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-200" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                        <span className="text-[9px] font-bold text-slate-500 uppercase truncate max-w-[150px]">{car.colorExterior}</span>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="font-mono text-[10px] font-bold text-slate-400">{car.vin7}</TableCell>
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7}`)}>
                      <Badge className={cn("text-[8px] font-black uppercase px-2.5 py-0.5 rounded-lg border-none", car.ubicacion?.startsWith('P') ? "bg-primary text-white" : "bg-slate-100 text-secondary")}>
                        {car.ubicacion}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7}`)} className="text-center">
                      <span className={cn("text-[9px] font-black", days > 60 ? "text-accent" : "text-slate-400")}>{days}D</span>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(car.id, car.modelo); }}>
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
