
'use client';

import { useState, useMemo, useRef } from "react";
import { 
  Search, 
  Plus, 
  Loader2, 
  FileSpreadsheet,
  Trash2,
  Car
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

export default function StockManagement() {
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const vehiculosQuery = useMemo(() => query(collection(db, "vehiculos"), orderBy("createdAt", "desc")), [db]);
  const { data: vehiculosRaw, loading } = useCollection(vehiculosQuery);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const vehiculos = useMemo(() => (vehiculosRaw || []) as any[], [vehiculosRaw]);

  const filteredVehiculos = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return vehiculos.filter(v => 
      v.modelo?.toLowerCase().includes(s) ||
      v.vin?.toLowerCase().includes(s) ||
      v.vin7?.toLowerCase().includes(s) ||
      v.ubicacion?.toLowerCase().includes(s) ||
      v.colorExterior?.toLowerCase().includes(s)
    );
  }, [vehiculos, searchTerm]);

  const handleDelete = (vehicleId: string, info: string) => {
    if (confirm(`¿Estás seguro de eliminar el vehículo ${info}?`)) {
      const docRef = doc(db, "vehiculos", vehicleId);
      deleteDoc(docRef)
        .then(() => {
          toast({ title: "Vehículo eliminado", description: "Se ha retirado del stock correctamente." });
          addDoc(collection(db, "movimientos"), {
            vehiculoId: vehicleId,
            vehiculoInfo: info,
            tipoAccion: 'Eliminacion',
            fecha: new Date().toISOString(),
            usuario: "OPERADOR STOCK",
            detalles: "Baja manual de inventario."
          });
        })
        .catch((err) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path, operation: 'delete'
          }));
        });
    }
  };

  const getValueByTags = (row: any, tags: string[]) => {
    const keys = Object.keys(row);
    const foundKey = keys.find(k => {
      const normalizedK = k.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9/]/g, "");
      return tags.some(tag => normalizedK.includes(tag.toLowerCase().replace(/[^a-z0-9]/g, "")));
    });
    return foundKey ? row[foundKey] : null;
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
          const vin = String(getValueByTags(row, ['vin', 'bastidor']) || "").trim().toUpperCase();
          if (!vin || vin.length < 5) return;

          const colorInfo = String(getValueByTags(row, ['color', 'exterior', 'codigo color']) || "").trim().toUpperCase();
          const matchedColor = BMW_COLORS.find(c => colorInfo.includes(c.code) || colorInfo.includes(c.name.toUpperCase()));

          const payload = {
            vin, 
            vin7: vin.slice(-7), 
            modelo: String(getValueByTags(row, ['modelo', 'descripcion']) || "BMW"), 
            colorExterior: matchedColor ? `${matchedColor.name} (${matchedColor.code})` : colorInfo || "Alpine White III (300)", 
            colorCodigo: matchedColor ? matchedColor.code : "300",
            ubicacion: String(getValueByTags(row, ['ubicacion', 'plaza', 'terraza', 'entreplanta']) || "Stock"), 
            estado: "Stock",
            bodyType: String(getValueByTags(row, ['body', 'tipo', 'carroceria']) || "SUV"),
            createdAt: new Date().toISOString(),
            fechaEntrada: new Date().toISOString().split('T')[0],
            checklist: { lavado: false, combustible: false, documentacion: false, llaves: false, revision: false }
          };

          const docRef = await addDoc(collection(db, "vehiculos"), payload);
          await addDoc(collection(db, "movimientos"), {
            vehiculoId: docRef.id,
            vehiculoInfo: `${payload.modelo} (${payload.vin7})`,
            tipoAccion: 'Alta',
            fecha: new Date().toISOString(),
            usuario: "IMPORTADOR EXCEL",
            detalles: "Alta masiva vía archivo Excel."
          });
          successCount++;
        });

        await Promise.allSettled(creationPromises);
        toast({ title: "Importación finalizada", description: `Se han añadido ${successCount} vehículos al stock VN.` });
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Fallo al procesar el Excel." });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const stats = useMemo(() => {
    const total = vehiculos.length;
    const terraza = vehiculos.filter(v => v.ubicacion?.toUpperCase().includes('TERRAZA')).length;
    const entreplanta = vehiculos.filter(v => v.ubicacion?.toUpperCase().includes('ENTREPLANTA')).length;
    const aging = vehiculos.filter(v => v.fechaEntrada && differenceInDays(new Date(), parseISO(v.fechaEntrada)) > 60).length;
    return { total, terraza, entreplanta, aging };
  }, [vehiculos]);

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto space-y-4 h-full flex flex-col overflow-hidden animate-in fade-in duration-500">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-[#14284B] uppercase italic leading-none">
            CONTROL <span className="text-[#00AEEF] not-italic">VN</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-[9px] font-black uppercase tracking-widest">MOMENTUM NAVARRA • OPERATIVA PREMIUM</p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={isImporting} variant="outline" className="h-10 rounded-xl bg-white text-[10px] font-black uppercase tracking-widest px-4 shadow-sm border-slate-200" onClick={() => fileInputRef.current?.click()}>
            {isImporting ? <Loader2 className="animate-spin w-3.5 h-3.5 mr-2" /> : <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-slate-400" />} 
            EXCEL
          </Button>
          <Button className="bg-[#003399] hover:bg-[#ED1C24] h-10 rounded-xl text-[10px] font-black uppercase tracking-widest px-6 shadow-lg transition-all" onClick={() => router.push('/showroom?add=true')}>
            <Plus className="w-4 h-4 mr-2" /> NUEVO
          </Button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        {[
          { label: "STOCK TOTAL", val: stats.total, color: "text-slate-800", icon: Car },
          { label: "TERRAZA", val: stats.terraza, color: "text-[#00AEEF]", icon: Car },
          { label: "ENTREPLANTA", val: stats.entreplanta, color: "text-[#14284B]", icon: Car },
          { label: "AGING > 60D", val: stats.aging, color: "text-[#ED1C24]", icon: Car },
        ].map((stat) => (
          <Card key={stat.label} className="premium-card border-none shadow-sm bg-white rounded-xl overflow-hidden relative">
             <div className="absolute top-0 right-0 p-2 opacity-5"><stat.icon className="w-12 h-12" /></div>
            <CardContent className="p-4 relative z-10">
              <p className="text-[8px] font-black uppercase mb-1 tracking-widest text-slate-400">{stat.label}</p>
              <p className={cn("text-xl font-black leading-none", stat.color)}>{stat.val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative group shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#00AEEF] transition-colors" />
        <Input 
          className="pl-11 h-12 bg-white border-none shadow-sm rounded-xl text-xs font-black uppercase tracking-widest placeholder:text-slate-200" 
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
                <TableRow><TableCell colSpan={6} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-[#00AEEF] mx-auto" /></TableCell></TableRow>
              ) : filteredVehiculos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No hay vehículos en stock</TableCell></TableRow>
              ) : filteredVehiculos.map((car) => {
                const days = car.fechaEntrada ? differenceInDays(new Date(), parseISO(car.fechaEntrada)) : 0;
                const colorObj = BMW_COLORS.find(c => c.code === car.colorCodigo || car.colorExterior?.toUpperCase().includes(c.code.toUpperCase()));
                return (
                  <TableRow 
                    key={car.id} 
                    className="hover:bg-slate-50 border-slate-50 group cursor-pointer transition-colors" 
                  >
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7 || car.vin?.slice(-7)}`)} className="font-black text-[10px] text-slate-800 uppercase py-4">{car.modelo}</TableCell>
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7 || car.vin?.slice(-7)}`)}>
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-200 shadow-sm shrink-0" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                        <span className="text-[9px] font-bold text-slate-500 uppercase truncate max-w-[150px]">{car.colorExterior}</span>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7 || car.vin?.slice(-7)}`)} className="font-mono text-[10px] font-bold text-slate-400">{car.vin7 || car.vin?.slice(-7)}</TableCell>
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7 || car.vin?.slice(-7)}`)}>
                      <Badge className="bg-slate-100 text-[#003399] border-none text-[8px] font-black uppercase px-2.5 py-0.5 rounded-lg">
                        {car.ubicacion}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => router.push(`/showroom?s=${car.vin7 || car.vin?.slice(-7)}`)} className="text-center">
                      <div className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-full border text-[8px] font-black",
                        days > 60 ? "border-[#ED1C24] text-[#ED1C24] bg-[#ED1C24]/5" : "border-slate-100 text-slate-400"
                      )}>
                        {days}D
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(car.id, `${car.modelo} (${car.vin7})`);
                        }}
                      >
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
