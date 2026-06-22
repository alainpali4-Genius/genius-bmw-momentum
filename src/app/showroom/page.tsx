
'use client';

import { useState, useMemo, useEffect, Suspense } from "react";
import { 
  Plus, Move, Car, ChevronRight, Loader2, X, Trash2, Monitor, PlusCircle, RefreshCw, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, updateDoc, deleteDoc, addDoc, query, orderBy } from "firebase/firestore";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "next/navigation";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export const BMW_COLORS = [
  {"code":"300","name":"Alpine White III","hex":"#F5F5F5"},
  {"code":"A96","name":"Mineral White Metallic","hex":"#F3F3F1"},
  {"code":"668","name":"Black Uni","hex":"#000000"},
  {"code":"475","name":"Black Sapphire Metallic","hex":"#1A1A1A"},
  {"code":"416","name":"Carbon Black Metallic","hex":"#111111"},
  {"code":"A90","name":"Sophisto Grey Metallic","hex":"#4A4A4A"},
  {"code":"C36","name":"Dravit Grey Metallic","hex":"#5D5A55"},
  {"code":"C4P","name":"Brooklyn Grey Metallic","hex":"#7B7D7E"},
  {"code":"C4W","name":"Skyscraper Grey Metallic","hex":"#8B8E91"},
  {"code":"C31","name":"Portimao Blue Metallic","hex":"#004D8D"},
  {"code":"C4R","name":"Arctic Race Blue Metallic","hex":"#2A5C9A"},
  {"code":"C6K","name":"San Remo Green Metallic","hex":"#2E4738"},
  {"code":"C6M","name":"Isle of Man Green Metallic","hex":"#006B43"},
  {"code":"C68","name":"Fire Red Metallic","hex":"#A5161A"},
  {"code":"C77","name":"Vegas Red Metallic","hex":"#B21A1A"}
];

const ESTADOS = ["Exposicion", "Stock", "Demo", "Reservado", "Preparacion Entrega", "Entregado", "Cedido"];
const PLAZAS_LIST = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12", "P13", "P14", "P15"];
const OTHER_LOCATIONS = ["Stock", "Terraza", "Entreplanta", "Lavadero", "Zona Entrega", "Taller", "Entregado"];

function CarSilhouette({ bodyType, color, className }: { bodyType: string, color: string, className?: string }) {
  const getPath = () => {
    switch (bodyType) {
      case 'SUV':
        return "M25,10 L75,10 Q85,10 85,20 L85,80 Q85,90 75,90 L25,90 Q15,90 15,80 L15,20 Q15,10 25,10 Z M30,25 L70,25 L70,45 L30,45 Z M30,55 L70,55 L70,80 L30,80 Z";
      case 'Coupe':
        return "M32,15 L68,15 Q82,15 82,30 L82,70 Q82,85 68,85 L32,85 Q18,85 18,70 L18,30 Q18,15 32,15 Z M35,32 L65,32 L65,68 L35,68 Z";
      case 'Berlina':
      default:
        return "M28,12 L72,12 Q82,12 82,25 L82,75 Q82,88 72,88 L28,88 Q18,88 18,75 L18,25 Q18,12 28,12 Z M32,28 L68,28 L68,48 L32,48 Z M32,55 L68,55 L68,78 L32,78 Z";
    }
  };

  return (
    <svg viewBox="0 0 100 100" className={cn("w-full h-full drop-shadow-lg", className)} fill={color}>
      <path d={getPath()} />
    </svg>
  );
}

function ShowroomContent() {
  const { toast } = useToast();
  const db = useFirestore();
  const searchParams = useSearchParams();
  const { data: vehiculosRaw, loading } = useCollection(query(collection(db, "vehiculos"), orderBy("createdAt", "desc")));
  
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [movingVehicleId, setMovingVehicleId] = useState<string | null>(null);
  const [isStockSheetOpen, setIsStockSheetOpen] = useState(false);

  const [formData, setFormData] = useState({
    modelo: "", vin: "", colorBMW: "300", ubicacion: "Stock", motor: "sDrive20i", bodyType: "SUV", estado: "Stock"
  });

  const vehiculos = useMemo(() => (vehiculosRaw || []) as any[], [vehiculosRaw]);
  const pendingStock = useMemo(() => vehiculos.filter(v => !PLAZAS_LIST.includes(v.ubicacion)), [vehiculos]);

  const handleUpdateVehicle = (vehicleId: string, updates: any) => {
    const docRef = doc(db, "vehiculos", vehicleId);
    const vehicle = vehiculos.find(v => v.id === vehicleId);
    if (!vehicle) return;

    let finalUpdates = { ...updates, updatedAt: new Date().toISOString() };
    
    // Regla de oro: si el estado cambia a algo que no sea Exposición, sale del plano
    if (updates.estado && updates.estado !== 'Exposicion' && PLAZAS_LIST.includes(vehicle.ubicacion)) {
      finalUpdates.ubicacion = 'Stock';
      toast({ title: "Vehículo Movido a Stock", description: "Plaza liberada automáticamente al cambiar estado." });
    }

    updateDoc(docRef, finalUpdates).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: finalUpdates }));
    });

    if (finalUpdates.ubicacion && vehicle.ubicacion !== finalUpdates.ubicacion) {
      addDoc(collection(db, "movimientos"), {
        vehiculoId: vehicleId, vehiculoInfo: `${vehicle.modelo} (${vehicle.vin7 || vehicle.vin?.slice(-7)})`,
        tipoAccion: 'Movimiento', fecha: new Date().toISOString(),
        origen: vehicle.ubicacion || 'N/A', destino: finalUpdates.ubicacion,
        usuario: "GENIUS APP"
      });
    }
  };

  const handleSwapOrMove = (sourceId: string, targetPlaza: string) => {
    const sourceCar = vehiculos.find(v => v.id === sourceId);
    const targetCar = vehiculos.find(v => v.ubicacion === targetPlaza);

    if (targetCar && targetCar.id !== sourceId) {
      const oldLocation = PLAZAS_LIST.includes(sourceCar?.ubicacion) ? sourceCar.ubicacion : 'Stock';
      handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      handleUpdateVehicle(targetCar.id, { ubicacion: oldLocation });
      toast({ title: "Intercambio Realizado", description: `Plazas ${oldLocation} y ${targetPlaza} permutadas.` });
    } else {
      handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      toast({ title: "Vehículo Ubicado", description: `Asignado a la plaza ${targetPlaza}.` });
    }
    setMovingVehicleId(null);
  };

  const renderPlaza = (id: string) => {
    const vehicle = vehiculos.find(v => v.ubicacion === id);
    const isMovingTarget = !!movingVehicleId && movingVehicleId !== vehicle?.id;
    const colorObj = BMW_COLORS.find(c => c.code === (vehicle?.colorCodigo || vehicle?.colorBMW));

    return (
      <div 
        key={id}
        onClick={() => movingVehicleId ? handleSwapOrMove(movingVehicleId, id) : vehicle && setSelectedVehicle(vehicle)}
        className={cn(
          "relative flex flex-col items-center justify-center transition-all h-full w-full rounded-2xl border-2 overflow-hidden",
          vehicle ? "bg-white border-transparent shadow-sm cursor-pointer hover:shadow-md" : "bg-white/40 border-slate-100 border-dashed",
          isMovingTarget && "border-primary bg-primary/5 ring-4 ring-primary/20 scale-[1.02] z-30"
        )}
      >
        <div className="absolute top-2 left-3 z-20"><span className="text-[10px] font-black uppercase text-slate-300">{id}</span></div>
        {vehicle ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-3">
            <div className="w-[70%] h-[60%] mb-1.5">
              <CarSilhouette bodyType={vehicle.bodyType || 'SUV'} color={colorObj?.hex || '#CBD5E1'} />
            </div>
            <div className="text-center px-1">
              <p className="text-[10px] font-black uppercase text-secondary truncate max-w-[140px] leading-tight">{vehicle.modelo}</p>
              <p className="text-[8px] font-mono font-bold text-slate-400 mt-0.5">{vehicle.vin7 || vehicle.vin?.slice(-7)}</p>
            </div>
          </div>
        ) : (
          <PlusCircle className="w-8 h-8 text-slate-200 opacity-20" />
        )}
      </div>
    );
  };

  const renderPasilloVertical = () => (
    <div className="h-full w-full bg-slate-50/50 border-x border-dashed border-slate-100 flex flex-col items-center justify-center">
      <div className="rotate-90 flex items-center gap-2">
        <span className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-200">PASILLO LOGÍSTICO</span>
      </div>
    </div>
  );

  const renderPuestoGenius = (num: number) => (
    <div className="h-full w-full bg-slate-100/40 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center group hover:bg-white transition-colors">
      <Monitor className="w-4 h-4 text-slate-300 mr-2 group-hover:text-primary" />
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 group-hover:text-primary">GENIUS {num}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#f4f7fa] overflow-hidden">
      {/* HEADER */}
      <div className="bg-white border-b px-8 py-5 flex items-center justify-between shrink-0 shadow-sm z-40">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-secondary uppercase italic leading-none tracking-tighter">PLANO <span className="text-primary not-italic">EXPOSICIÓN</span></h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">LOGÍSTICA MOMENTUM NAVARRA • VN PREMIUM</p>
        </div>
        <div className="flex gap-3">
          {movingVehicleId && (
            <Button onClick={() => setMovingVehicleId(null)} className="h-10 bg-primary animate-pulse text-white rounded-xl font-black uppercase text-[10px] px-6">
              SELECCIONA PLAZA DESTINO
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsStockSheetOpen(true)} className="h-10 rounded-xl font-black uppercase text-[10px] px-6 border-slate-200 hover:bg-slate-50">
            <Package className="w-4 h-4 mr-2" /> STOCK ({pendingStock.length})
          </Button>
          <Button onClick={() => setIsAddingNew(true)} className="h-10 bg-secondary hover:bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] px-6 shadow-lg transition-all">
            <Plus className="w-4 h-4 mr-2" /> NUEVO VEHÍCULO
          </Button>
        </div>
      </div>

      {/* PLANO GRID - ARQUITECTURA EXACTA SOLICITADA */}
      <div className="flex-1 p-6 lg:p-8 overflow-hidden">
        <div className="h-full w-full max-w-[1600px] mx-auto grid grid-rows-5 gap-4">
          
          {/* Fila 1: P1-P3 | Pasillo | P4 */}
          <div className="grid grid-cols-5 gap-4 min-h-0">
            {renderPlaza("P1")}
            {renderPlaza("P2")}
            {renderPlaza("P3")}
            {renderPasilloVertical()}
            {renderPlaza("P4")}
          </div>

          {/* Fila 2: P5-P7 | Pasillo | P8 */}
          <div className="grid grid-cols-5 gap-4 min-h-0">
            {renderPlaza("P5")}
            {renderPlaza("P6")}
            {renderPlaza("P7")}
            {renderPasilloVertical()}
            {renderPlaza("P8")}
          </div>

          {/* Fila 3: Genius 1-3 | Pasillo | Genius 4 */}
          <div className="grid grid-cols-5 gap-4 min-h-0">
            {renderPuestoGenius(1)}
            {renderPuestoGenius(2)}
            {renderPuestoGenius(3)}
            {renderPasilloVertical()}
            {renderPuestoGenius(4)}
          </div>

          {/* Fila 4: P9-P11 | Pasillo | P12 */}
          <div className="grid grid-cols-5 gap-4 min-h-0">
            {renderPlaza("P9")}
            {renderPlaza("P10")}
            {renderPlaza("P11")}
            {renderPasilloVertical()}
            {renderPlaza("P12")}
          </div>

          {/* Fila 5: P13-P15 | Pasillo | Stock Espacio */}
          <div className="grid grid-cols-5 gap-4 min-h-0">
            {renderPlaza("P13")}
            {renderPlaza("P14")}
            {renderPlaza("P15")}
            {renderPasilloVertical()}
            <div className="rounded-2xl border border-dashed border-slate-100 flex items-center justify-center bg-slate-50/20">
              <span className="text-[8px] font-black text-slate-200 uppercase tracking-widest">ZONA ESCAPARATE</span>
            </div>
          </div>

        </div>
      </div>

      {/* HOJA DE DETALLES */}
      <Sheet open={!!selectedVehicle} onOpenChange={o => !o && setSelectedVehicle(null)}>
        <SheetContent side="bottom" className="h-[60vh] p-0 rounded-t-[3rem] border-none shadow-2xl overflow-hidden bg-slate-50">
          {selectedVehicle && (
            <div className="flex flex-col h-full">
              <div className="bg-secondary p-8 text-white flex justify-between items-end shrink-0">
                <div className="space-y-3">
                  <Badge className="bg-primary text-white text-[11px] font-black uppercase px-4 py-1">{selectedVehicle.estado}</Badge>
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter">{selectedVehicle.modelo}</h2>
                  <div className="flex gap-4 items-center">
                    <p className="text-white/40 font-mono text-xs font-bold">VIN: {selectedVehicle.vin}</p>
                    <Badge variant="outline" className="text-white/20 border-white/10 text-[10px] uppercase">{selectedVehicle.ubicacion}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                   <Button variant="ghost" onClick={() => { setMovingVehicleId(selectedVehicle.id); setSelectedVehicle(null); }} className="h-14 w-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white">
                    <Move className="w-6 h-6" />
                   </Button>
                   <Button variant="ghost" onClick={() => setSelectedVehicle(null)} className="h-14 w-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white">
                    <X className="w-6 h-6" />
                   </Button>
                </div>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 overflow-y-auto">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-widest">Estado Comercial</Label>
                  <Select value={selectedVehicle.estado} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { estado: v })}>
                    <SelectTrigger className="h-14 bg-white border-none rounded-2xl font-black uppercase text-xs shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">{ESTADOS.map(e => <SelectItem key={e} value={e}>{e.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-widest">Mover Ubicación</Label>
                  <Select value={selectedVehicle.ubicacion} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { ubicacion: v })}>
                    <SelectTrigger className="h-14 bg-white border-none rounded-2xl font-black uppercase text-xs shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl max-h-[300px]">
                      {PLAZAS_LIST.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      <Separator className="my-2" />
                      {OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-widest">Acciones Críticas</Label>
                  <Button variant="destructive" className="h-14 w-full rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg" onClick={() => { if(confirm("¿Eliminar este vehículo de la base de datos?")) { deleteDoc(doc(db, "vehiculos", selectedVehicle.id)); setSelectedVehicle(null); } }}>
                    <Trash2 className="w-4 h-4 mr-2" /> Eliminar de Inventario
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* STOCK SIDEBAR */}
      <Sheet open={isStockSheetOpen} onOpenChange={setIsStockSheetOpen}>
        <SheetContent side="right" className="w-[400px] p-0 border-none bg-white shadow-2xl">
          <div className="p-8 bg-slate-50 border-b flex flex-col gap-2">
            <h3 className="text-2xl font-black uppercase italic text-secondary leading-none">STOCK <span className="text-primary not-italic">VN</span></h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">VEHÍCULOS PENDIENTES DE EXPOSICIÓN</p>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto h-[calc(100vh-140px)] scrollbar-none">
            {pendingStock.length === 0 ? (
              <div className="text-center py-20 opacity-20"><p className="text-xs font-black uppercase">Sin vehículos en stock</p></div>
            ) : pendingStock.map(car => (
              <div key={car.id} onClick={() => { setMovingVehicleId(car.id); setIsStockSheetOpen(false); }} className="p-5 bg-white border border-slate-100 rounded-2xl hover:border-primary cursor-pointer transition-all shadow-sm group">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-black text-secondary text-sm uppercase leading-tight group-hover:text-primary">{car.modelo}</p>
                  <Badge variant="outline" className="text-[9px] bg-slate-50 uppercase font-black">{car.estado}</Badge>
                </div>
                <div className="flex justify-between items-center mt-4">
                   <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW))?.hex }} />
                    <span className="text-[8px] font-mono font-bold text-slate-400">{car.vin7 || car.vin?.slice(-7)}</span>
                   </div>
                   <Badge className="bg-slate-100 text-slate-600 border-none text-[8px] font-black uppercase">{car.ubicacion}</Badge>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* MODAL ALTA RÁPIDA */}
      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="p-0 border-none rounded-[2rem] overflow-hidden max-w-md shadow-2xl">
          <div className="p-6 bg-secondary text-white font-black uppercase italic tracking-widest">NUEVA ALTA LOGÍSTICA</div>
          <div className="p-8 space-y-5 bg-white">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-slate-400 px-1 tracking-widest">Modelo de Vehículo</Label>
              <Input placeholder="EJ: BMW X5 xDrive30d..." value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-slate-400 px-1 tracking-widest">Número de Bastidor (VIN)</Label>
              <Input placeholder="17 CARACTERES..." value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-slate-400 px-1 tracking-widest">Color Oficial</Label>
                <Select value={formData.colorBMW} onValueChange={v => setFormData({...formData, colorBMW: v})}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold text-[10px]"><SelectValue/></SelectTrigger>
                  <SelectContent className="rounded-xl">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-slate-400 px-1 tracking-widest">Carrocería</Label>
                <Select value={formData.bodyType} onValueChange={v => setFormData({...formData, bodyType: v})}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold text-[10px]"><SelectValue/></SelectTrigger>
                  <SelectContent className="rounded-xl">{["SUV", "Berlina", "Coupe"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleQuickAdd} className="w-full h-14 bg-primary hover:bg-blue-800 text-white font-black uppercase text-[11px] rounded-xl shadow-xl mt-4 transition-all active:scale-95 border-none">
              CONFIRMAR ALTA EN STOCK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  async function handleQuickAdd() {
    if (!formData.modelo || !formData.vin) {
      toast({ variant: "destructive", title: "Faltan datos" });
      return;
    }
    const vin7 = formData.vin.slice(-7).toUpperCase();
    const payload = {
      ...formData,
      vin: formData.vin.toUpperCase(),
      vin7,
      colorCodigo: formData.colorBMW,
      colorExterior: BMW_COLORS.find(c => c.code === formData.colorBMW)?.name || "Alpine White",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checklist: { lavado: false, combustible: false, documentacion: false, llaves: false, revision: false }
    };

    try {
      await addDoc(collection(db, "vehiculos"), payload);
      toast({ title: "Vehículo Registrado" });
      setIsAddingNew(false);
      setFormData({ modelo: "", vin: "", colorBMW: "300", ubicacion: "Stock", motor: "sDrive20i", bodyType: "SUV", estado: "Stock" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    }
  }
}

export default function ShowroomRetailFinal() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-slate-50"><Loader2 className="animate-spin text-primary w-14 h-14" /></div>}>
      <ShowroomContent />
    </Suspense>
  );
}
