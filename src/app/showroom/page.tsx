
'use client';

import { useState, useMemo, Suspense, useEffect } from "react";
import { 
  Plus, Move, Loader2, X, Trash2, Monitor, PlusCircle, Package
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useSearchParams } from "next/navigation";

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
        return "M30,10 L70,10 C80,10 85,15 85,25 L85,75 C85,85 80,90 70,90 L30,90 C20,90 15,85 15,75 L15,25 C15,15 20,10 30,10 Z M20,28 L80,28 L80,30 L20,30 Z M25,45 L75,45 L75,70 L25,70 Z M30,15 L70,15 L70,22 L30,22 Z";
      case 'Coupe':
        return "M35,12 L65,12 C75,12 82,18 82,28 L82,72 C82,82 75,88 65,88 L35,88 C25,88 18,82 18,72 L18,28 C18,18 25,12 35,12 Z M25,35 L75,35 L72,65 L28,65 Z M35,18 L65,18 L65,25 L35,25 Z";
      case 'Berlina':
      default:
        return "M32,10 L68,10 C78,10 82,15 82,25 L82,75 C82,85 78,90 68,90 L32,90 C22,90 18,85 18,75 L18,25 C18,15 22,10 32,10 Z M22,30 L78,30 L78,45 L22,45 Z M22,55 L78,55 L78,80 L22,80 Z";
    }
  };

  return (
    <svg viewBox="0 0 100 100" className={cn("w-full h-full drop-shadow-md", className)} fill={color}>
      <path d={getPath()} fillOpacity="0.9" />
      <rect x="20" y="20" width="60" height="5" fill="black" fillOpacity="0.1" />
      <rect x="20" y="75" width="60" height="5" fill="black" fillOpacity="0.1" />
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

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setIsAddingNew(true);
    }
    const searchStr = searchParams.get('s');
    if (searchStr && vehiculos.length > 0) {
      const found = vehiculos.find(v => v.vin7 === searchStr || v.vin === searchStr);
      if (found) setSelectedVehicle(found);
    }
  }, [searchParams, vehiculos]);

  const handleUpdateVehicle = (vehicleId: string, updates: any) => {
    const docRef = doc(db, "vehiculos", vehicleId);
    const vehicle = vehiculos.find(v => v.id === vehicleId);
    if (!vehicle) return;

    let finalUpdates = { ...updates, updatedAt: new Date().toISOString() };
    
    if (updates.estado && updates.estado !== 'Exposicion' && PLAZAS_LIST.includes(vehicle.ubicacion)) {
      finalUpdates.ubicacion = 'Stock';
      toast({ title: "Vehículo Movido a Stock", description: "Plaza liberada automáticamente por cambio de estado." });
    }

    updateDoc(docRef, finalUpdates).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: finalUpdates }));
    });

    if (finalUpdates.ubicacion && vehicle.ubicacion !== finalUpdates.ubicacion) {
      addDoc(collection(db, "movimientos"), {
        vehiculoId: vehicleId,
        vehiculoInfo: `${vehicle.modelo} (${vehicle.vin7 || vehicle.vin?.slice(-7)})`,
        tipoAccion: 'Movimiento',
        fecha: new Date().toISOString(),
        origen: vehicle.ubicacion || 'N/A',
        destino: finalUpdates.ubicacion,
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
      toast({ title: "Intercambio Realizado", description: `Vehículos permutados entre plazas.` });
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
          "relative flex flex-col items-center justify-center transition-all aspect-[4/3] w-full rounded-2xl border-2 overflow-hidden",
          vehicle ? "bg-white border-transparent shadow-sm cursor-pointer hover:shadow-md" : "bg-white/40 border-slate-100 border-dashed",
          isMovingTarget && "border-primary bg-primary/5 ring-4 ring-primary/20 scale-[1.02] z-30"
        )}
      >
        <div className="absolute top-2 left-3 z-20"><span className="text-[10px] font-black uppercase text-slate-300">{id}</span></div>
        {vehicle ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-3">
            <div className="w-[85%] h-[65%] mb-2 rotate-90">
              <CarSilhouette bodyType={vehicle.bodyType || 'SUV'} color={colorObj?.hex || '#CBD5E1'} />
            </div>
            <div className="text-center px-1">
              <p className="text-[9px] font-black uppercase text-secondary truncate max-w-full leading-tight">{vehicle.modelo}</p>
              <p className="text-[7px] font-mono font-bold text-slate-400 mt-1">{vehicle.vin7 || vehicle.vin?.slice(-7)}</p>
            </div>
          </div>
        ) : (
          <PlusCircle className="w-6 h-6 text-slate-200 opacity-20" />
        )}
      </div>
    );
  };

  const renderPasilloVertical = () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/50 border-x border-dashed border-slate-100">
      <div className="rotate-90 flex items-center gap-2">
        <span className="text-[8px] font-black uppercase tracking-[0.6em] text-slate-200">PASILLO</span>
      </div>
    </div>
  );

  const renderPuestoGenius = (num: number) => (
    <div className="aspect-[4/3] w-full bg-slate-100/40 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center group hover:bg-white transition-colors">
      <Monitor className="w-3.5 h-3.5 text-slate-300 mr-2 group-hover:text-primary" />
      <span className="text-[8px] font-black uppercase tracking-widest text-slate-300 group-hover:text-primary">MESA {num}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#f4f7fa] overflow-hidden">
      <div className="bg-white border-b px-8 py-5 flex items-center justify-between shrink-0 shadow-sm z-40">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-secondary uppercase italic leading-none tracking-tighter">PLANO <span className="text-primary not-italic">EXPOSICIÓN</span></h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">SISTEMA LOGÍSTICO MOMENTUM NAVARRA</p>
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

      <div className="flex-1 p-6 overflow-hidden flex items-center justify-center">
        <div className="w-full h-full max-w-[1400px] grid grid-rows-5 gap-3">
          
          <div className="grid grid-cols-6 gap-3">
            {renderPlaza("P1")}
            {renderPlaza("P2")}
            {renderPlaza("P3")}
            {renderPlaza("P4")}
            {renderPasilloVertical()}
            <div className="bg-transparent"></div>
          </div>

          <div className="grid grid-cols-6 gap-3">
            {renderPlaza("P5")}
            {renderPlaza("P6")}
            {renderPlaza("P7")}
            {renderPlaza("P8")}
            {renderPasilloVertical()}
            <div className="bg-transparent"></div>
          </div>

          <div className="grid grid-cols-6 gap-3">
            {renderPuestoGenius(1)}
            {renderPuestoGenius(2)}
            {renderPuestoGenius(3)}
            {renderPuestoGenius(4)}
            {renderPasilloVertical()}
            <div className="bg-transparent"></div>
          </div>

          <div className="grid grid-cols-6 gap-3">
            {renderPlaza("P9")}
            {renderPlaza("P10")}
            {renderPlaza("P11")}
            {renderPlaza("P12")}
            {renderPasilloVertical()}
            {renderPlaza("P13")}
          </div>

          <div className="grid grid-cols-6 gap-3">
            <div className="bg-transparent"></div>
            {renderPlaza("P15")}
            <div className="bg-transparent"></div>
            {renderPlaza("P14")}
            {renderPasilloVertical()}
            <div className="bg-transparent"></div>
          </div>

        </div>
      </div>

      <Sheet open={!!selectedVehicle} onOpenChange={o => !o && setSelectedVehicle(null)}>
        <SheetContent side="bottom" className="h-[55vh] p-0 rounded-t-[3rem] border-none shadow-2xl overflow-hidden bg-slate-50">
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
                  <Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-widest">Cambiar Ubicación</Label>
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
                  <Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-widest">Gestión de Registro</Label>
                  <Button variant="destructive" className="h-14 w-full rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg" onClick={() => { if(confirm("¿Eliminar este vehículo?")) { deleteDoc(doc(db, "vehiculos", selectedVehicle.id)); setSelectedVehicle(null); } }}>
                    <Trash2 className="w-4 h-4 mr-2" /> Eliminar Registro
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={isStockSheetOpen} onOpenChange={setIsStockSheetOpen}>
        <SheetContent side="right" className="w-[380px] p-0 border-none bg-white shadow-2xl">
          <div className="p-8 bg-slate-50 border-b flex flex-col gap-2">
            <h3 className="text-2xl font-black uppercase italic text-secondary leading-none">VEHÍCULOS <span className="text-primary not-italic">STOCK</span></h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DISPONIBLES PARA EXPOSICIÓN</p>
          </div>
          <div className="p-6 space-y-3 overflow-y-auto h-[calc(100vh-140px)] scrollbar-none">
            {pendingStock.length === 0 ? (
              <div className="text-center py-20 opacity-20"><p className="text-xs font-black uppercase">Todo el stock está ubicado</p></div>
            ) : pendingStock.map(car => (
              <div key={car.id} onClick={() => { setMovingVehicleId(car.id); setIsStockSheetOpen(false); }} className="p-4 bg-white border border-slate-100 rounded-2xl hover:border-primary cursor-pointer transition-all shadow-sm group">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-black text-secondary text-[13px] uppercase leading-tight group-hover:text-primary">{car.modelo}</p>
                  <Badge variant="outline" className="text-[8px] bg-slate-50 uppercase font-black">{car.estado}</Badge>
                </div>
                <div className="flex justify-between items-center mt-3">
                   <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW))?.hex }} />
                    <span className="text-[8px] font-mono font-bold text-slate-400">{car.vin7 || car.vin?.slice(-7)}</span>
                   </div>
                   <Badge className="bg-slate-100 text-slate-600 border-none text-[8px] font-black uppercase">{car.ubicacion}</Badge>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="p-0 border-none rounded-[2rem] overflow-hidden max-w-md shadow-2xl">
          <div className="p-6 bg-secondary text-white font-black uppercase italic tracking-widest">NUEVO VEHÍCULO VN</div>
          <div className="p-8 space-y-5 bg-white">
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase text-slate-400 px-1">Modelo</Label>
              <Input placeholder="BMW X1 sDrive20i..." value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase text-slate-400 px-1">Bastidor Completo</Label>
              <Input placeholder="WBA..." value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-slate-400 px-1">Color</Label>
                <Select value={formData.colorBMW} onValueChange={v => setFormData({...formData, colorBMW: v})}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold text-[10px]"><SelectValue/></SelectTrigger>
                  <SelectContent className="rounded-xl">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-slate-400 px-1">Cuerpo</Label>
                <Select value={formData.bodyType} onValueChange={v => setFormData({...formData, bodyType: v})}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold text-[10px]"><SelectValue/></SelectTrigger>
                  <SelectContent className="rounded-xl">{["SUV", "Berlina", "Coupe"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleQuickAdd} className="w-full h-14 bg-primary text-white font-black uppercase text-[11px] rounded-xl shadow-xl mt-4 border-none">
              CONFIRMAR REGISTRO
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  async function handleQuickAdd() {
    if (!formData.modelo || !formData.vin) return;
    const vin7 = formData.vin.slice(-7).toUpperCase();
    const payload = {
      ...formData,
      vin: formData.vin.toUpperCase(),
      vin7,
      colorCodigo: formData.colorBMW,
      colorExterior: BMW_COLORS.find(c => c.code === formData.colorBMW)?.name || "Alpine White",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      await addDoc(collection(db, "vehiculos"), payload);
      toast({ title: "Vehículo Registrado", description: `Bastidor: ${vin7}` });
      setIsAddingNew(false);
      setFormData({ modelo: "", vin: "", colorBMW: "300", ubicacion: "Stock", motor: "sDrive20i", bodyType: "SUV", estado: "Stock" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  }
}

export default function ShowroomFinal() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-slate-50"><Loader2 className="animate-spin text-primary w-14 h-14" /></div>}>
      <ShowroomContent />
    </Suspense>
  );
}
