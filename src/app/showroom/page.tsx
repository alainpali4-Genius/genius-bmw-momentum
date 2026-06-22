
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
const SHOWROOM_PLAZAS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12", "P13", "P14", "P15"];
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
  const pendingStock = useMemo(() => vehiculos.filter(v => !v.ubicacion?.startsWith('P')), [vehiculos]);

  useEffect(() => {
    if (searchParams.get('add') === 'true') setIsAddingNew(true);
  }, [searchParams]);

  const handleUpdateVehicle = (vehicleId: string, updates: any) => {
    const docRef = doc(db, "vehiculos", vehicleId);
    const vehicle = vehiculos.find(v => v.id === vehicleId);
    if (!vehicle) return;

    let finalUpdates = { ...updates, updatedAt: new Date().toISOString() };
    
    // Automatización: Si el estado no es Exposicion, sale del plano
    if (updates.estado && updates.estado !== 'Exposicion' && vehicle.ubicacion?.startsWith('P')) {
      finalUpdates.ubicacion = 'Stock';
      toast({ title: "Vehículo Movido a Stock", description: "Plaza liberada automáticamente." });
    }

    updateDoc(docRef, finalUpdates).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: finalUpdates }));
    });

    if (finalUpdates.ubicacion && vehicle.ubicacion !== finalUpdates.ubicacion) {
      addDoc(collection(db, "movimientos"), {
        vehiculoId: vehicleId, vehiculoInfo: `${vehicle.modelo} (${vehicle.vin7})`,
        tipoAccion: 'Movimiento', fecha: new Date().toISOString(),
        origen: vehicle.ubicacion || 'N/A', destino: finalUpdates.ubicacion,
        usuario: "GENIUS APP"
      });
    }
  };

  const handleSwapOrMove = (sourceId: string, targetPlaza: string) => {
    const sourceCar = vehiculos.find(v => v.id === sourceId);
    const targetCar = vehiculos.find(v => v.ubicacion === targetPlaza);

    if (targetCar) {
      const oldLocation = sourceCar?.ubicacion?.startsWith('P') ? sourceCar.ubicacion : 'Stock';
      handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      handleUpdateVehicle(targetCar.id, { ubicacion: oldLocation });
      toast({ title: "Intercambio Realizado" });
    } else {
      handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      toast({ title: "Vehículo Ubicado" });
    }
    setMovingVehicleId(null);
  };

  const renderPlaza = (id: string) => {
    const vehicle = vehiculos.find(v => v.ubicacion === id);
    const isMovingTarget = !!movingVehicleId && movingVehicleId !== vehicle?.id;
    const colorObj = BMW_COLORS.find(c => c.code === vehicle?.colorCodigo);

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
            <div className="w-[70%] h-[55%] mb-2"><CarSilhouette bodyType={vehicle.bodyType || 'SUV'} color={colorObj?.hex || '#CBD5E1'} /></div>
            <div className="text-center px-2">
              <p className="text-[10px] font-black uppercase text-secondary truncate">{vehicle.modelo}</p>
              <Badge variant="outline" className="text-[8px] font-mono mt-1 opacity-60">{vehicle.vin7}</Badge>
            </div>
          </div>
        ) : (
          <PlusCircle className="w-8 h-8 text-slate-200 opacity-20" />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f7fa] overflow-hidden">
      <div className="bg-white border-b px-8 py-5 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-secondary uppercase italic leading-none">PLANO <span className="text-primary not-italic">EXPOSICIÓN</span></h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">LOGÍSTICA VISUAL MOMENTUM NAVARRA</p>
        </div>
        <div className="flex gap-3">
          {movingVehicleId && <Button onClick={() => setMovingVehicleId(null)} className="h-10 bg-primary animate-pulse text-white rounded-xl font-black uppercase text-[10px]">SELECCIONA PLAZA DESTINO</Button>}
          <Button variant="outline" onClick={() => setIsStockSheetOpen(true)} className="h-10 rounded-xl font-black uppercase text-[10px] px-6"><Package className="w-4 h-4 mr-2" /> STOCK ({pendingStock.length})</Button>
          <Button onClick={() => setIsAddingNew(true)} className="h-10 bg-secondary text-white rounded-xl font-black uppercase text-[10px] px-6"><Plus className="w-4 h-4 mr-2" /> NUEVO VEHÍCULO</Button>
        </div>
      </div>

      <div className="flex-1 p-6 lg:p-10 overflow-hidden relative">
        <div className="h-full w-full max-w-[1400px] mx-auto flex gap-6 overflow-hidden">
          <div className="flex-[8] flex flex-col gap-6 h-full">
            <div className="flex-1 grid grid-cols-4 gap-6">{["P1", "P2", "P3", "P4"].map(id => renderPlaza(id))}</div>
            <div className="flex-1 grid grid-cols-4 gap-6">{["P5", "P6", "P7", "P8"].map(id => renderPlaza(id))}</div>
            
            <div className="h-16 shrink-0 grid grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(num => (
                <div key={num} className="bg-slate-100/40 border border-dashed rounded-2xl flex items-center justify-center opacity-40">
                  <Monitor className="w-4 h-4 text-slate-400 mr-2" /><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">PUESTO GENIUS {num}</span>
                </div>
              ))}
            </div>

            <div className="flex-1 grid grid-cols-4 gap-6">{["P9", "P10", "P11", "P12"].map(id => renderPlaza(id))}</div>
            <div className="flex-1 grid grid-cols-4 gap-6"><div/><div>{renderPlaza("P14")}</div><div>{renderPlaza("P15")}</div><div/></div>
          </div>
          <div className="w-48 lg:w-56 flex flex-col justify-center h-full py-[10%]">{renderPlaza("P13")}</div>
        </div>
      </div>

      {/* DETALLES VEHÍCULO */}
      <Sheet open={!!selectedVehicle} onOpenChange={o => !o && setSelectedVehicle(null)}>
        <SheetContent side="bottom" className="h-[75vh] p-0 rounded-t-[3rem] border-none shadow-2xl overflow-hidden">
          {selectedVehicle && (
            <div className="flex flex-col h-full bg-slate-50">
              <div className="bg-secondary p-10 text-white flex justify-between items-end shrink-0">
                <div className="space-y-4">
                  <Badge className="bg-primary text-white text-[12px] font-black uppercase">{selectedVehicle.estado}</Badge>
                  <h2 className="text-4xl font-black uppercase italic">{selectedVehicle.modelo}</h2>
                  <p className="text-white/40 font-mono text-sm">{selectedVehicle.vin}</p>
                </div>
                <div className="flex gap-2">
                   <Button variant="ghost" onClick={() => setMovingVehicleId(selectedVehicle.id)} className="h-14 w-14 rounded-2xl bg-white/10"><Move className="w-6 h-6" /></Button>
                   <Button variant="ghost" onClick={() => setSelectedVehicle(null)} className="h-14 w-14 rounded-2xl bg-white/10"><X className="w-6 h-6" /></Button>
                </div>
              </div>
              <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Estado del Vehículo</Label>
                  <Select value={selectedVehicle.estado} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { estado: v })}>
                    <SelectTrigger className="h-14 bg-white rounded-2xl font-black uppercase"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">{ESTADOS.map(e => <SelectItem key={e} value={e}>{e.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Ubicación Logística</Label>
                  <Select value={selectedVehicle.ubicacion} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { ubicacion: v })}>
                    <SelectTrigger className="h-14 bg-white rounded-2xl font-black uppercase"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl max-h-[300px]">
                      {SHOWROOM_PLAZAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      <Separator className="my-2" />
                      {OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* STOCK SHEET */}
      <Sheet open={isStockSheetOpen} onOpenChange={setIsStockSheetOpen}>
        <SheetContent side="right" className="w-[400px] p-0 border-none bg-white">
          <div className="p-8 bg-slate-50 border-b flex flex-col gap-2">
            <h3 className="text-2xl font-black uppercase italic text-secondary">STOCK VN</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase">PENDIENTES DE UBICAR</p>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto h-[calc(100vh-140px)]">
            {pendingStock.map(car => (
              <div key={car.id} onClick={() => { setMovingVehicleId(car.id); setIsStockSheetOpen(false); }} className="p-5 bg-white border border-slate-100 rounded-2xl hover:border-primary cursor-pointer transition-all shadow-sm">
                <p className="font-black text-secondary text-sm uppercase">{car.modelo}</p>
                <div className="flex justify-between items-center mt-2">
                   <Badge variant="outline" className="text-[8px] font-mono">{car.vin7}</Badge>
                   <span className="text-[9px] font-black text-slate-400 uppercase">{car.ubicacion}</span>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="p-0 border-none rounded-[2rem] overflow-hidden max-w-md">
          <div className="p-6 bg-secondary text-white font-black uppercase">ALTA DE VEHÍCULO</div>
          <div className="p-8 space-y-4">
            <Input placeholder="MODELO..." value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} />
            <Input placeholder="VIN COMPLETO..." value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} />
            <Select value={formData.colorBMW} onValueChange={v => setFormData({...formData, colorBMW: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent></Select>
            <Select value={formData.bodyType} onValueChange={v => setFormData({...formData, bodyType: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["SUV", "Berlina", "Coupe"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            <Button onClick={() => { handleQuickAdd(); setIsAddingNew(false); }} className="w-full h-12 bg-primary text-white font-black">GUARDAR</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ShowroomRetailFixed() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-primary w-14 h-14" /></div>}>
      <ShowroomContent />
    </Suspense>
  );
}
