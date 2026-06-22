
'use client';

import { useState, useMemo, useEffect, Suspense } from "react";
import { 
  Plus, Move, Car, ChevronRight, Loader2, X, Save, Trash2, Monitor, Footprints, PlusCircle, Zap, MapPin, Package, Search, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, updateDoc, deleteDoc, addDoc, query, orderBy } from "firebase/firestore";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  {"code":"C5A","name":"Frozen Pure Grey Metallic","hex":"#A3A5A6"},
  {"code":"C64","name":"Touring Grey Metallic","hex":"#6A6A68"},
  {"code":"C31","name":"Portimao Blue Metallic","hex":"#004D8D"},
  {"code":"C4R","name":"Arctic Race Blue Metallic","hex":"#2A5C9A"},
  {"code":"C6K","name":"San Remo Green Metallic","hex":"#2E4738"},
  {"code":"C6M","name":"Isle of Man Green Metallic","hex":"#006B43"},
  {"code":"C68","name":"Fire Red Metallic","hex":"#A5161A"},
  {"code":"C77","name":"Vegas Red Metallic","hex":"#B21A1A"},
  {"code":"C6A","name":"Aventurin Red Metallic","hex":"#5B1D1D"},
  {"code":"C6P","name":"Frozen Deep Grey Metallic","hex":"#666666"}
];

const ESTADOS = ["Exposicion", "Stock", "Demo", "Reservado", "Preparacion Entrega", "Entregado", "Cedido"];
const SHOWROOM_PLAZAS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12", "P13", "P14", "P15"];
const OTHER_LOCATIONS = ["Stock", "Terraza", "Entreplanta", "Lavadero", "Zona Entrega", "Taller", "Entregado", "Cedido"];

const FIXED_ORIENTATIONS: Record<string, number> = {
  P1: 90, P2: 90, P3: 90, P4: 90,
  P5: 90, P6: 90, P7: 90, P8: 90,
  P9: 90, P10: 90, P11: 90, P12: 90,
  P13: 0, 
  P14: 90, P15: 90
};

function BmwSilhouette({ type, colorHex, rotacion = 0, className }: { type: string, colorHex: string, rotacion?: number, className?: string }) {
  const paths: Record<string, string> = {
    SUV: "M20,15 C20,8 30,2 50,2 C70,2 80,8 80,15 L86,45 L86,135 L80,165 C80,172 70,178 50,178 C30,178 20,172 20,165 L14,135 L14,45 L20,15 Z",
    Berlina: "M25,12 C25,6 35,1 50,1 C65,1 75,6 75,12 L82,48 L82,132 L75,168 C75,174 65,179 50,179 C35,179 25,174 25,168 L18,132 L18,48 L25,12 Z",
    Coupe: "M28,18 C28,12 38,7 50,7 C62,7 72,12 72,18 L78,55 L78,125 L72,162 C72,168 62,173 50,173 C38,173 28,168 28,162 L22,125 L22,55 L28,18 Z",
    GranCoupe: "M25,14 C25,8 35,3 50,3 C65,3 75,8 75,14 L80,48 L80,132 L75,166 C75,172 65,177 50,177 C35,177 25,172 25,166 L20,132 L20,48 L25,14 Z",
    Roadster: "M30,22 C30,16 40,11 50,11 C60,11 70,16 70,22 L75,58 L75,122 L70,158 C70,164 60,169 50,169 C40,169 30,164 30,158 L25,122 L25,58 L30,22 Z"
  };

  return (
    <div className={cn("transition-all duration-500 flex items-center justify-center h-full w-full", className)} style={{ transform: `rotate(${rotacion}deg)` }}>
      <svg viewBox="0 0 100 180" className="w-full h-full filter drop-shadow-sm">
        <path d={paths[type] || paths.SUV} fill="rgba(0,0,0,0.15)" transform="translate(2,2)" />
        <path d={paths[type] || paths.SUV} fill={colorHex} stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
      </svg>
    </div>
  );
}

function ShowroomContent() {
  const { toast } = useToast();
  const db = useFirestore();
  const searchParams = useSearchParams();
  
  const vehiculosQuery = useMemo(() => query(collection(db, "vehiculos"), orderBy("createdAt", "desc")), [db]);
  const { data: vehiculosRaw, loading: loadingVehiculos } = useCollection(vehiculosQuery);
  
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [movingVehicleId, setMovingVehicleId] = useState<string | null>(null);
  const [isStockSheetOpen, setIsStockSheetOpen] = useState(false);

  const [formData, setFormData] = useState({
    modelo: "",
    vin: "",
    colorBMW: "300",
    ubicacion: "Stock",
    motor: "sDrive20i",
    bodyType: "SUV",
    estado: "Stock"
  });

  const vehiculos = useMemo(() => (vehiculosRaw || []) as any[], [vehiculosRaw]);

  const pendingStock = useMemo(() => 
    vehiculos.filter(v => !v.ubicacion?.startsWith('P')), 
  [vehiculos]);

  useEffect(() => {
    if (searchParams.get('add') === 'true') setIsAddingNew(true);
    const s = searchParams.get('s');
    if (s && vehiculos.length > 0) {
      const found = vehiculos.find(v => 
        v.vin7?.toUpperCase() === s.toUpperCase() || 
        v.vin?.toUpperCase().includes(s.toUpperCase())
      );
      if (found) setSelectedVehicle(found);
    }
  }, [searchParams, vehiculos]);

  const handleUpdateVehicle = (vehicleId: string, updates: any) => {
    const docRef = doc(db, "vehiculos", vehicleId);
    const vehicle = vehiculos.find(v => v.id === vehicleId);
    if (!vehicle) return;

    let finalUpdates = { ...updates, updatedAt: new Date().toISOString() };
    
    // AUTOMATIZACIÓN: Si el estado cambia a algo que no sea "Exposicion", y estaba en un P#, mover a Stock
    if (updates.estado && updates.estado !== 'Exposicion') {
      if (vehicle.ubicacion?.startsWith('P')) {
        finalUpdates.ubicacion = 'Stock';
        toast({ title: "Vehículo Retirado", description: "El activo se ha movido automáticamente a Stock al cambiar su estado." });
      }
    }

    // AUTOMATIZACIÓN: Si el estado cambia a "Exposicion", asegurar que no se pierda la ubicación si ya está en una plaza
    if (updates.estado === 'Exposicion' && !updates.ubicacion && !vehicle.ubicacion?.startsWith('P')) {
       toast({ variant: "destructive", title: "Asignación Requerida", description: "Debes asignar una plaza (P#) para el estado de Exposición." });
    }

    updateDoc(docRef, finalUpdates).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path, operation: 'update', requestResourceData: finalUpdates,
      }));
    });

    // Registrar movimiento si cambia ubicación
    if (finalUpdates.ubicacion && vehicle.ubicacion !== finalUpdates.ubicacion) {
      addDoc(collection(db, "movimientos"), {
        vehiculoId: vehicleId,
        vehiculoInfo: `${vehicle.modelo} (${vehicle.vin7 || vehicle.vin?.slice(-7)})`,
        tipoAccion: 'Movimiento',
        fecha: new Date().toISOString(),
        origen: vehicle.ubicacion || 'N/A',
        destino: finalUpdates.ubicacion,
        usuario: "SISTEMA GENIUS",
        detalles: `Traslado a ${finalUpdates.ubicacion}`
      });
    }

    if (selectedVehicle?.id === vehicleId) {
      setSelectedVehicle((prev: any) => ({ ...prev, ...finalUpdates }));
    }
  };

  const handleSwapOrMove = (sourceId: string, targetPlaza: string) => {
    const sourceCar = vehiculos.find(v => v.id === sourceId);
    const targetCar = vehiculos.find(v => v.ubicacion === targetPlaza);

    if (!sourceCar) return;

    if (targetCar) {
      // INTERCAMBIO: Mover el coche de destino a la ubicación original del coche de origen
      const oldLocation = sourceCar.ubicacion;
      
      // Actualizar coche de origen a nueva plaza
      handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      
      // Actualizar coche de destino a la antigua plaza (o Stock si el origen venía de fuera del plano)
      const swapTo = oldLocation?.startsWith('P') ? oldLocation : 'Stock';
      handleUpdateVehicle(targetCar.id, { ubicacion: swapTo });
      
      toast({ title: "Intercambio Realizado", description: `${sourceCar.vin7} y ${targetCar.vin7} han cambiado de plaza.` });
    } else {
      // MOVIMIENTO NORMAL
      handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      toast({ title: "Vehículo Ubicado", description: `${sourceCar.modelo} movido a ${targetPlaza}.` });
    }
    setMovingVehicleId(null);
  };

  const handleDeleteVehicle = (vehicleId: string, info: string) => {
    if (confirm(`¿Estás seguro de eliminar permanentemente el vehículo ${info}?`)) {
      const docRef = doc(db, "vehiculos", vehicleId);
      deleteDoc(docRef).then(() => {
        toast({ title: "Vehículo Eliminado", description: "El activo ha sido retirado del sistema." });
        setSelectedVehicle(null);
        addDoc(collection(db, "movimientos"), {
          vehiculoId: vehicleId,
          vehiculoInfo: info,
          tipoAccion: 'Eliminacion',
          fecha: new Date().toISOString(),
          usuario: "SISTEMA GENIUS",
          detalles: "Baja definitiva desde el Plano VN."
        });
      });
    }
  };

  const handleQuickAdd = async () => {
    if (!formData.modelo || !formData.vin) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Modelo y VIN son obligatorios." });
      return;
    }

    const vinNorm = formData.vin.trim().toUpperCase();
    const isDuplicate = vehiculos.some(v => v.vin === vinNorm || v.vin7 === vinNorm.slice(-7));
    if (isDuplicate) {
      toast({ variant: "destructive", title: "Bastidor Duplicado", description: `El VIN ${vinNorm} ya existe.` });
      return;
    }

    const colorObj = BMW_COLORS.find(c => c.code === formData.colorBMW);
    const vehiclePayload = {
      modelo: formData.modelo,
      vin: vinNorm,
      vin7: vinNorm.slice(-7),
      colorExterior: colorObj ? `${colorObj.name} (${colorObj.code})` : "Alpine White III (300)",
      colorCodigo: formData.colorBMW,
      ubicacion: formData.ubicacion,
      estado: formData.estado,
      motor: formData.motor,
      bodyType: formData.bodyType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comercial: "SISTEMA",
      fechaEntrada: new Date().toISOString().split('T')[0],
      checklist: { lavado: false, combustible: false, documentacion: false, llaves: false, revision: false }
    };

    setIsAddingNew(false);
    setFormData({ modelo: "", vin: "", colorBMW: "300", ubicacion: "Stock", motor: "sDrive20i", bodyType: "SUV", estado: "Stock" });
    
    try {
      const docRef = await addDoc(collection(db, "vehiculos"), vehiclePayload);
      await addDoc(collection(db, "movimientos"), {
        vehiculoId: docRef.id,
        vehiculoInfo: `${vehiclePayload.modelo} (${vehiclePayload.vin7})`,
        tipoAccion: 'Alta',
        fecha: new Date().toISOString(),
        usuario: "SISTEMA GENIUS",
        detalles: "Alta manual desde el plano."
      });
      toast({ title: "Vehículo Guardado" });
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'vehiculos', operation: 'create', requestResourceData: vehiclePayload,
      }));
    }
  };

  const renderPlaza = (id: string) => {
    const vehicle = vehiculos.find(v => v.ubicacion === id);
    const isSelected = selectedVehicle && vehicle && selectedVehicle.id === vehicle.id;
    const isMovingTarget = !!movingVehicleId;
    const isMovingSelf = movingVehicleId === vehicle?.id;
    
    const colorObj = BMW_COLORS.find(c => 
      c.code === vehicle?.colorCodigo || 
      vehicle?.colorExterior?.toUpperCase().includes(c.code.toUpperCase())
    );
    const colorHex = colorObj?.hex || '#F5F5F5'; 
    const rotacion = FIXED_ORIENTATIONS[id] !== undefined ? FIXED_ORIENTATIONS[id] : 90;
    
    const isDarkColor = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness < 128;
    };

    const textColorClass = isDarkColor(colorHex) ? "text-white" : "text-[#14284B]";
    const labelBgClass = isDarkColor(colorHex) ? "bg-black/40" : "bg-white/50";

    return (
      <div 
        key={id}
        onClick={() => {
          if (movingVehicleId) {
            handleSwapOrMove(movingVehicleId, id);
          } else if (vehicle) {
            setSelectedVehicle(vehicle);
          }
        }}
        className={cn(
          "relative flex flex-col items-center justify-center transition-all h-full w-full rounded-2xl border group overflow-hidden",
          vehicle ? "border-transparent cursor-pointer" : "border-slate-100 bg-white/50",
          isMovingTarget && !isMovingSelf && "border-primary/50 bg-primary/5 cursor-pointer ring-2 ring-primary/20",
          (isSelected || isMovingSelf) && "z-20 ring-4 ring-primary/30 bg-white shadow-2xl",
          isMovingSelf && "animate-pulse"
        )}
      >
        <div className="absolute top-2 left-2.5 flex flex-col z-10 pointer-events-none">
          <span className={cn("text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-300")}>{id}</span>
        </div>
        
        {vehicle ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className={cn("absolute inset-0 flex items-center justify-center transition-transform duration-500", isSelected && "scale-105")}>
              <BmwSilhouette type={vehicle.bodyType || 'SUV'} colorHex={colorHex} rotacion={rotacion} className="scale-[0.85] md:scale-[1.5]" />
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className={cn("backdrop-blur-md rounded-xl p-2 space-y-0.5 shadow-sm text-center min-w-[70%] max-w-[90%] transition-all", labelBgClass)}>
                <p className={cn("text-[7px] md:text-[10px] font-black uppercase leading-tight truncate", textColorClass)}>{vehicle.modelo}</p>
                <div className="flex gap-1.5 items-center justify-center leading-none">
                  <span className={cn("text-[6px] md:text-[8px] font-mono font-bold opacity-80", textColorClass)}>{vehicle.vin7 || vehicle.vin?.slice(-7)}</span>
                  <span className={cn("text-[6px] md:text-[8px] font-black opacity-80", textColorClass)}>{vehicle.colorCodigo}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-10 group-hover:opacity-30 transition-opacity">
             {movingVehicleId ? <RefreshCw className="w-5 h-5 text-primary animate-spin" /> : <PlusCircle className="w-5 h-5 text-slate-400" />}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
      <div className="bg-white border-b px-6 py-4 shrink-0 z-50 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-secondary italic uppercase leading-none tracking-tighter">PLANO <span className="text-primary not-italic">VN</span></h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">MOMENTUM NAVARRA</p>
          </div>
          {movingVehicleId && (
            <Badge className="bg-primary text-white animate-pulse px-4 py-2 rounded-full font-black uppercase text-[10px] gap-2 border-none shadow-lg">
              <Move className="w-4 h-4" /> SELECCIONA PLAZA (VACÍA O PARA INTERCAMBIO)
              <button onClick={() => setMovingVehicleId(null)} className="ml-2 bg-white/20 hover:bg-white/30 rounded-full p-1"><X className="w-3.5 h-3.5" /></button>
            </Badge>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setIsStockSheetOpen(true)} className="h-11 rounded-xl font-black uppercase text-[11px] px-6">
            <Package className="w-4 h-4 mr-2 text-primary" /> STOCK ({pendingStock.length})
          </Button>
          <Button onClick={() => setIsAddingNew(true)} className="h-11 bg-secondary text-white hover:bg-secondary/90 rounded-xl font-black uppercase text-[11px] px-6">
            <Plus className="w-4 h-4 mr-2" /> NUEVO ACTIVO
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative p-4 md:p-8">
        {loadingVehiculos ? (
          <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>
        ) : (
          <div className="h-full w-full max-w-[1500px] mx-auto flex gap-4 lg:gap-12 overflow-hidden">
            <div className="flex-[8] flex flex-col gap-4 lg:gap-8 h-full">
              <div className="flex-1 grid grid-cols-4 gap-4 lg:gap-8">{["P1", "P2", "P3", "P4"].map(id => renderPlaza(id))}</div>
              <div className="flex-1 grid grid-cols-4 gap-4 lg:gap-8">{["P5", "P6", "P7", "P8"].map(id => renderPlaza(id))}</div>
              <div className="h-14 md:h-20 shrink-0 grid grid-cols-4 gap-4 lg:gap-8">
                {[1, 2, 3, 4].map(num => (
                  <div key={`m-${num}`} className="bg-slate-100/30 border-2 border-slate-200 border-dashed rounded-2xl flex items-center justify-center opacity-40">
                    <Monitor className="w-4 h-4 text-slate-400 mr-2" />
                    <span className="text-[7px] md:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">MESA {num}</span>
                  </div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-4 gap-4 lg:gap-8">{["P9", "P10", "P11", "P12"].map(id => renderPlaza(id))}</div>
              <div className="flex-1 grid grid-cols-4 gap-4 lg:gap-8">
                <div className="col-span-1" />
                <div className="col-span-1">{renderPlaza("P14")}</div>
                <div className="col-span-1">{renderPlaza("P15")}</div>
                <div className="col-span-1" />
              </div>
            </div>
            <div className="w-8 md:w-20 flex flex-col items-center py-10 opacity-10 shrink-0 select-none">
               {[1,2,3,4,5,6].map(i => <Footprints key={i} className="w-5 md:w-8 h-5 md:h-8 rotate-90 my-auto text-slate-400" />)}
            </div>
            <div className="w-24 md:w-48 flex flex-col justify-center h-full py-[15%] gap-6 lg:gap-12">
               <div className="h-[25%]">{renderPlaza("P13")}</div>
            </div>
          </div>
        )}
      </div>

      <Sheet open={!!selectedVehicle} onOpenChange={(open) => !open && setSelectedVehicle(null)}>
        <SheetContent side="bottom" className="p-0 rounded-t-[3.5rem] border-none h-[80vh] bg-white overflow-hidden shadow-2xl">
          {selectedVehicle && (
            <div className="flex flex-col h-full">
              <div className="p-10 bg-secondary text-white shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-32 -translate-y-32 blur-3xl" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-primary text-white text-[11px] font-black uppercase px-5 py-2 rounded-full border-none shadow-lg">{selectedVehicle.estado}</Badge>
                      <Badge variant="outline" className="border-white/20 text-white/80 text-[11px] font-mono px-4">{selectedVehicle.vin}</Badge>
                    </div>
                    <h2 className="text-5xl font-black uppercase italic leading-none tracking-tighter">{selectedVehicle.modelo}</h2>
                  </div>
                  <div className="flex gap-4">
                    <Button variant="ghost" onClick={() => handleDeleteVehicle(selectedVehicle.id, `${selectedVehicle.modelo} (${selectedVehicle.vin7})`)} className="text-white/40 hover:bg-red-600 hover:text-white rounded-2xl h-14 w-14 transition-all"><Trash2 className="w-7 h-7" /></Button>
                    <Button variant="ghost" onClick={() => setSelectedVehicle(null)} className="text-white/40 hover:bg-white/10 rounded-2xl h-14 w-14 transition-all"><X className="w-10 h-10" /></Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-10 space-y-12 overflow-y-auto bg-slate-50/30">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                  <div className="space-y-10">
                    <div className="space-y-4">
                      <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest px-1">Cambiar Estado Operativo</Label>
                      <Select value={selectedVehicle.estado} onValueChange={(val) => handleUpdateVehicle(selectedVehicle.id, { estado: val })}>
                        <SelectTrigger className="h-16 bg-white border-slate-100 font-black text-base uppercase rounded-2xl shadow-sm px-8"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">{ESTADOS.map(e => <SelectItem key={e} value={e}>{e.toUpperCase()}</SelectItem>)}</SelectContent>
                      </Select>
                      <p className="text-[9px] text-slate-400 font-bold uppercase italic px-1">* Al cambiar de 'Exposicion' a otro estado, el coche saldrá automáticamente del plano.</p>
                    </div>
                    <Button onClick={() => { setMovingVehicleId(selectedVehicle.id); setSelectedVehicle(null); }} className="w-full h-20 bg-primary text-white rounded-2xl font-black uppercase text-[12px] shadow-xl gap-4 transition-all active:scale-95">
                      <Move className="w-6 h-6" /> REUBICAR O INTERCAMBIAR PLAZA
                    </Button>
                  </div>
                  
                  <div className="space-y-8">
                     <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest px-1">Detalles de Inventario</Label>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                           <p className="text-[9px] font-black text-slate-400 uppercase mb-3 tracking-[0.2em]">Ubicación Actual</p>
                           <Select value={selectedVehicle.ubicacion} onValueChange={(val) => handleUpdateVehicle(selectedVehicle.id, { ubicacion: val })}>
                              <SelectTrigger className="bg-secondary text-white text-[12px] font-black uppercase rounded-xl px-5 py-2 border-none shadow-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {SHOWROOM_PLAZAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                <Separator className="my-2" />
                                {OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm col-span-2">
                           <p className="text-[9px] font-black text-slate-400 uppercase mb-3 tracking-[0.2em]">Número de Bastidor Completo</p>
                           <p className="text-xl font-mono font-bold text-secondary tracking-tight">{selectedVehicle.vin}</p>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={isStockSheetOpen} onOpenChange={setIsStockSheetOpen}>
        <SheetContent side="right" className="w-[400px] md:w-[500px] p-0 border-none bg-white shadow-2xl">
          <SheetHeader className="p-10 bg-slate-50 border-b">
            <SheetTitle className="text-3xl font-black uppercase italic tracking-tighter text-secondary">STOCK VN PENDIENTE</SheetTitle>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Activos fuera del plano de exposición</p>
          </SheetHeader>
          <div className="p-8 space-y-5 overflow-y-auto h-[calc(100vh-160px)]">
            {pendingStock.length === 0 ? (
              <div className="p-20 text-center space-y-6"><Package className="w-20 h-20 text-slate-100 mx-auto" /><p className="text-[12px] font-black text-slate-300 uppercase tracking-widest">Exposición al completo</p></div>
            ) : (
              pendingStock.map((car) => {
                const colorObj = BMW_COLORS.find(c => c.code === car.colorCodigo);
                return (
                  <div key={car.id} onClick={() => { setMovingVehicleId(car.id); setIsStockSheetOpen(false); toast({ title: "Modo Ubicación", description: `Selecciona una plaza para el ${car.modelo}` }); }} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:border-primary/50 cursor-pointer transition-all relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                    <div className="ml-4 space-y-2">
                      <h4 className="font-black text-secondary text-sm uppercase leading-none">{car.modelo}</h4>
                      <p className="text-[11px] font-mono font-bold text-slate-400 uppercase">{car.vin7 || car.vin?.slice(-7)} • {car.ubicacion}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[3rem] shadow-2xl">
          <div className="p-8 bg-secondary text-white"><h2 className="text-2xl font-black uppercase italic tracking-tighter">REGISTRO DE STOCK</h2></div>
          <div className="p-10 space-y-8 bg-white">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3"><Label className="text-[11px] font-black uppercase text-slate-400 px-2 tracking-widest">Modelo</Label><Input value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} className="h-14 bg-slate-50 border-none font-bold uppercase text-sm rounded-xl" placeholder="EJ: X3 XDRIVE20D" /></div>
              <div className="space-y-3"><Label className="text-[11px] font-black uppercase text-slate-400 px-2 tracking-widest">Bastidor</Label><Input value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} className="h-14 bg-slate-50 border-none font-mono text-sm uppercase rounded-xl" placeholder="VIN COMPLETO" /></div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3"><Label className="text-[11px] font-black uppercase text-slate-400 px-2 tracking-widest">Ubicación Inicial</Label>
                <Select value={formData.ubicacion} onValueChange={v => setFormData({...formData, ubicacion: v})}>
                  <SelectTrigger className="h-14 bg-slate-50 border-none text-sm uppercase font-black rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-2xl">
                    {SHOWROOM_PLAZAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    <Separator className="my-2" />
                    {OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3"><Label className="text-[11px] font-black uppercase text-slate-400 px-2 tracking-widest">Color BMW</Label>
                <Select value={formData.colorBMW} onValueChange={v => setFormData({...formData, colorBMW: v})}>
                  <SelectTrigger className="h-14 bg-slate-50 border-none text-sm uppercase font-black rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-2xl max-h-[350px]">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleQuickAdd} className="w-full h-16 bg-primary text-white rounded-2xl font-black uppercase text-[12px] shadow-xl mt-4 transition-all active:scale-95"><Save className="mr-3 w-6 h-6" /> GUARDAR EN INVENTARIO</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ShowroomRetailNext() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-primary w-14 h-14" /></div>}>
      <ShowroomContent />
    </Suspense>
  );
}
