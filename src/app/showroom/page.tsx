
'use client';

import { useState, useMemo, useEffect, Suspense } from "react";
import { 
  Plus, Move, Car, ChevronRight, Loader2, X, Save, Trash2, Monitor, PlusCircle, RefreshCw, Package, Search
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

// Paleta oficial de colores BMW
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
  {"code":"C31","name":"Portimao Blue Metallic","hex":"#004D8D"},
  {"code":"C4R","name":"Arctic Race Blue Metallic","hex":"#2A5C9A"},
  {"code":"C6K","name":"San Remo Green Metallic","hex":"#2E4738"},
  {"code":"C6M","name":"Isle of Man Green Metallic","hex":"#006B43"},
  {"code":"C68","name":"Fire Red Metallic","hex":"#A5161A"},
  {"code":"C77","name":"Vegas Red Metallic","hex":"#B21A1A"},
  {"code":"C6A","name":"Aventurin Red Metallic","hex":"#5B1D1D"}
];

const ESTADOS = ["Exposicion", "Stock", "Demo", "Reservado", "Preparacion Entrega", "Entregado", "Cedido"];
const SHOWROOM_PLAZAS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12", "P13", "P14", "P15"];
const OTHER_LOCATIONS = ["Stock", "Terraza", "Entreplanta", "Lavadero", "Zona Entrega", "Taller", "Entregado", "Cedido"];

// Componente para renderizar la silueta del coche vista desde arriba
function CarSilhouette({ bodyType, color, className }: { bodyType: string, color: string, className?: string }) {
  const getPath = () => {
    switch (bodyType) {
      case 'SUV':
        // Silueta más ancha y robusta
        return "M20,10 L80,10 Q90,10 90,20 L90,80 Q90,90 80,90 L20,90 Q10,90 10,80 L10,20 Q10,10 20,10 Z M25,25 L75,25 L75,45 L25,45 Z M25,55 L75,55 L75,80 L25,80 Z";
      case 'Coupe':
        // Silueta más afilada y aerodinámica
        return "M30,15 L70,15 Q85,15 85,30 L85,70 Q85,85 70,85 L30,85 Q15,85 15,70 L15,30 Q15,15 30,15 Z M35,30 L65,30 Q70,30 70,35 L70,65 Q70,70 65,70 L35,70 Q30,70 30,65 L30,35 Q30,30 35,30 Z";
      case 'Berlina':
      default:
        // Silueta estándar compensada
        return "M25,12 L75,12 Q85,12 85,25 L85,75 Q85,88 75,88 L25,88 Q15,88 15,75 L15,25 Q15,12 25,12 Z M30,28 L70,28 L70,48 L30,48 Z M30,55 L70,55 L70,78 L30,78 Z";
    }
  };

  return (
    <svg viewBox="0 0 100 100" className={cn("w-full h-full drop-shadow-xl", className)} fill={color}>
      <path d={getPath()} />
    </svg>
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
    
    // Automatización de salida del plano si cambia el estado y no es Exposicion
    if (updates.estado && updates.estado !== 'Exposicion') {
      if (vehicle.ubicacion?.startsWith('P')) {
        finalUpdates.ubicacion = 'Stock';
        toast({ title: "Vehículo Liberado", description: "Movido a Stock automáticamente por cambio de estado." });
      }
    }

    updateDoc(docRef, finalUpdates).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path, operation: 'update', requestResourceData: finalUpdates,
      }));
    });

    if (finalUpdates.ubicacion && vehicle.ubicacion !== finalUpdates.ubicacion) {
      addDoc(collection(db, "movimientos"), {
        vehiculoId: vehicleId,
        vehiculoInfo: `${vehicle.modelo} (${vehicle.vin7 || vehicle.vin?.slice(-7)})`,
        tipoAccion: 'Movimiento',
        fecha: new Date().toISOString(),
        origen: vehicle.ubicacion || 'N/A',
        destino: finalUpdates.ubicacion,
        usuario: "GENIUS APP",
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
      // Intercambio
      const oldLocation = sourceCar.ubicacion;
      const swapTo = oldLocation?.startsWith('P') ? oldLocation : 'Stock';
      
      handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      handleUpdateVehicle(targetCar.id, { ubicacion: swapTo });
      
      toast({ title: "Intercambio Realizado", description: `${sourceCar.vin7} y ${targetCar.vin7} han intercambiado plazas.` });
    } else {
      // Movimiento simple
      handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      toast({ title: "Vehículo Ubicado", description: `Trasladado a la plaza ${targetPlaza}.` });
    }
    setMovingVehicleId(null);
  };

  const handleDeleteVehicle = (vehicleId: string, info: string) => {
    if (confirm(`¿Eliminar permanentemente el vehículo ${info}?`)) {
      const docRef = doc(db, "vehiculos", vehicleId);
      deleteDoc(docRef).then(() => {
        toast({ title: "Vehículo Eliminado" });
        setSelectedVehicle(null);
      });
    }
  };

  const handleQuickAdd = async () => {
    if (!formData.modelo || !formData.vin) {
      toast({ variant: "destructive", title: "Faltan datos" });
      return;
    }

    const vinNorm = formData.vin.trim().toUpperCase();
    const colorObj = BMW_COLORS.find(c => c.code === formData.colorBMW);
    const vehiclePayload = {
      ...formData,
      vin: vinNorm,
      vin7: vinNorm.slice(-7),
      colorExterior: colorObj ? `${colorObj.name} (${colorObj.code})` : "Alpine White III (300)",
      colorCodigo: formData.colorBMW,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comercial: "GENIUS",
      fechaEntrada: new Date().toISOString().split('T')[0],
      checklist: { lavado: false, combustible: false, documentacion: false, llaves: false, revision: false }
    };

    setIsAddingNew(false);
    try {
      await addDoc(collection(db, "vehiculos"), vehiclePayload);
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
    
    const colorObj = BMW_COLORS.find(c => c.code === vehicle?.colorCodigo);
    const colorHex = colorObj?.hex || '#CBD5E1'; 

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
          "relative flex flex-col items-center justify-center transition-all h-full w-full rounded-2xl border-2 overflow-hidden",
          vehicle ? "border-transparent cursor-pointer bg-slate-50/50" : "border-slate-100 border-dashed bg-white/30",
          isMovingTarget && !isMovingSelf && "border-primary bg-primary/5 ring-4 ring-primary/20 scale-[1.05] z-30",
          (isSelected || isMovingSelf) && "z-20 border-primary ring-4 ring-primary/10 bg-white shadow-xl scale-[1.02]",
          isMovingSelf && "animate-pulse opacity-50"
        )}
      >
        <div className="absolute top-2 left-3 z-20 pointer-events-none">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{id}</span>
        </div>
        
        {vehicle ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-3">
            <div className="w-[85%] h-[65%] flex items-center justify-center">
              <CarSilhouette bodyType={vehicle.bodyType || 'SUV'} color={colorHex} className="drop-shadow-2xl" />
            </div>
            <div className="mt-3 text-center z-10 w-full px-2">
              <p className="text-[10px] font-black uppercase text-secondary leading-tight tracking-tighter truncate">
                {vehicle.modelo}
              </p>
              <div className="mt-1 px-2 py-0.5 bg-secondary/5 rounded-md inline-block">
                <p className="text-[9px] font-mono font-bold text-slate-400">
                  {vehicle.vin7 || vehicle.vin?.slice(-7)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="opacity-10 group-hover:opacity-40 transition-opacity">
             {movingVehicleId ? <RefreshCw className="w-8 h-8 text-primary animate-spin" /> : <PlusCircle className="w-10 h-10 text-slate-300" />}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f7fa] overflow-hidden">
      {/* Header Premium */}
      <div className="bg-white border-b px-8 py-5 shrink-0 z-50 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-secondary italic uppercase leading-none tracking-tighter">PLANO <span className="text-primary not-italic">EXPO</span></h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">LOGÍSTICA VISUAL MOMENTUM NAVARRA</p>
          </div>
          {movingVehicleId && (
            <Badge className="bg-primary text-white animate-pulse px-6 py-3 rounded-2xl font-black uppercase text-[11px] gap-3 border-none shadow-xl">
              <Move className="w-5 h-5" /> SELECCIONA PLAZA DE DESTINO
              <button onClick={() => setMovingVehicleId(null)} className="ml-2 bg-white/20 hover:bg-white/40 rounded-full p-1"><X className="w-4 h-4" /></button>
            </Badge>
          )}
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setIsStockSheetOpen(true)} className="h-12 rounded-2xl font-black uppercase text-[11px] px-8 border-slate-200 hover:bg-slate-50 shadow-sm">
            <Package className="w-5 h-5 mr-3 text-primary" /> LISTA DE STOCK ({pendingStock.length})
          </Button>
          <Button onClick={() => setIsAddingNew(true)} className="h-12 bg-secondary text-white rounded-2xl font-black uppercase text-[11px] px-8 shadow-2xl hover:bg-slate-800">
            <Plus className="w-5 h-5 mr-3 text-white" /> NUEVO ACTIVO
          </Button>
        </div>
      </div>

      {/* Grid del Plano con Siluetas */}
      <div className="flex-1 overflow-hidden relative p-8 lg:p-14">
        {loadingVehiculos ? (
          <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-primary w-14 h-14" /></div>
        ) : (
          <div className="h-full w-full max-w-[1800px] mx-auto flex gap-10 lg:gap-20 overflow-hidden">
            <div className="flex-[9] flex flex-col gap-8 lg:gap-12 h-full">
              {/* Filas Superiores */}
              <div className="flex-1 grid grid-cols-4 gap-8 lg:gap-12">{["P1", "P2", "P3", "P4"].map(id => renderPlaza(id))}</div>
              <div className="flex-1 grid grid-cols-4 gap-8 lg:gap-12">{["P5", "P6", "P7", "P8"].map(id => renderPlaza(id))}</div>
              
              {/* Pasillo de Mesas */}
              <div className="h-24 shrink-0 grid grid-cols-4 gap-8 lg:gap-12">
                {[1, 2, 3, 4].map(num => (
                  <div key={`m-${num}`} className="bg-slate-100/50 border-2 border-slate-200/30 border-dashed rounded-[2.5rem] flex items-center justify-center opacity-60">
                    <Monitor className="w-5 h-5 text-slate-400 mr-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">PUESTO GENIUS {num}</span>
                  </div>
                ))}
              </div>

              {/* Filas Inferiores */}
              <div className="flex-1 grid grid-cols-4 gap-8 lg:gap-12">{["P9", "P10", "P11", "P12"].map(id => renderPlaza(id))}</div>
              <div className="flex-1 grid grid-cols-4 gap-8 lg:gap-12">
                <div className="col-span-1" />
                <div className="col-span-1">{renderPlaza("P14")}</div>
                <div className="col-span-1">{renderPlaza("P15")}</div>
                <div className="col-span-1" />
              </div>
            </div>

            {/* Columna Lateral (Escaparate) */}
            <div className="w-40 md:w-64 flex flex-col justify-center h-full py-[12%] gap-12">
               <div className="h-[35%]">{renderPlaza("P13")}</div>
            </div>
          </div>
        )}
      </div>

      {/* Detalles del Vehículo - Sheet Inferior */}
      <Sheet open={!!selectedVehicle} onOpenChange={(open) => !open && setSelectedVehicle(null)}>
        <SheetContent side="bottom" className="p-0 rounded-t-[5rem] border-none h-[88vh] bg-white overflow-hidden shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.15)]">
          {selectedVehicle && (
            <div className="flex flex-col h-full">
              <div className="p-14 bg-secondary text-white shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/5 rounded-full translate-x-32 -translate-y-32 blur-3xl" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-8">
                    <div className="flex items-center gap-6">
                      <Badge className="bg-primary text-white text-[14px] font-black uppercase px-8 py-3 rounded-2xl border-none shadow-2xl">{selectedVehicle.estado}</Badge>
                      <Badge variant="outline" className="border-white/20 text-white/50 text-[14px] font-mono px-6 py-2 rounded-xl">{selectedVehicle.vin}</Badge>
                    </div>
                    <h2 className="text-7xl font-black uppercase italic leading-none tracking-tighter">{selectedVehicle.modelo}</h2>
                  </div>
                  <div className="flex gap-5">
                    <Button variant="ghost" onClick={() => handleDeleteVehicle(selectedVehicle.id, `${selectedVehicle.modelo} (${selectedVehicle.vin7})`)} className="text-white/20 hover:bg-red-600 hover:text-white rounded-[2rem] h-20 w-20 transition-all"><Trash2 className="w-10 h-10" /></Button>
                    <Button variant="ghost" onClick={() => setSelectedVehicle(null)} className="text-white/20 hover:bg-white/10 rounded-[2rem] h-20 w-20 transition-all"><X className="w-14 h-14" /></Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-14 space-y-20 overflow-y-auto bg-slate-50/30">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 max-w-[1500px] mx-auto">
                  <div className="space-y-14">
                    <div className="space-y-6">
                      <Label className="text-[13px] font-black uppercase text-slate-400 tracking-widest px-3">Estado Logístico</Label>
                      <Select value={selectedVehicle.estado} onValueChange={(val) => handleUpdateVehicle(selectedVehicle.id, { estado: val })}>
                        <SelectTrigger className="h-20 bg-white border-slate-200 font-black text-xl uppercase rounded-3xl shadow-sm px-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-3xl border-none shadow-3xl p-3">{ESTADOS.map(e => <SelectItem key={e} value={e} className="rounded-2xl font-bold py-4 text-base">{e.toUpperCase()}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => { setMovingVehicleId(selectedVehicle.id); setSelectedVehicle(null); }} className="w-full h-28 bg-primary text-white rounded-[3rem] font-black uppercase text-[16px] shadow-3xl gap-6 hover:bg-blue-800 transition-all active:scale-[0.98]">
                      <Move className="w-10 h-10" /> REUBICAR / INTERCAMBIAR PLAZA
                    </Button>
                  </div>
                  
                  <div className="space-y-14">
                     <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-xl space-y-8">
                        <Label className="text-[13px] font-black uppercase text-slate-400 tracking-widest px-3">Ubicación Logística</Label>
                        <Select value={selectedVehicle.ubicacion} onValueChange={(val) => handleUpdateVehicle(selectedVehicle.id, { ubicacion: val })}>
                          <SelectTrigger className="bg-secondary text-white text-[16px] font-black uppercase rounded-[2rem] border-none shadow-2xl h-20 px-10"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-3xl border-none shadow-3xl max-h-[450px]">
                            <p className="text-[11px] font-black uppercase text-slate-400 p-4 tracking-widest bg-slate-50">PLAZAS EXPOSICIÓN</p>
                            {SHOWROOM_PLAZAS.map(p => <SelectItem key={p} value={p} className="rounded-xl">{p}</SelectItem>)}
                            <Separator className="my-4" />
                            <p className="text-[11px] font-black uppercase text-slate-400 p-4 tracking-widest bg-slate-50">ZONAS LOGÍSTICAS</p>
                            {OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p} className="rounded-xl">{p.toUpperCase()}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <div className="pt-6 grid grid-cols-2 gap-6">
                           <div className="bg-slate-50 p-6 rounded-3xl">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bastidor</p>
                              <p className="text-xl font-mono font-bold text-secondary">{selectedVehicle.vin7}</p>
                           </div>
                           <div className="bg-slate-50 p-6 rounded-3xl">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Carrocería</p>
                              <p className="text-xl font-black text-secondary uppercase italic">{selectedVehicle.bodyType}</p>
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Lista de Stock Lateral - Sheet Derecha */}
      <Sheet open={isStockSheetOpen} onOpenChange={setIsStockSheetOpen}>
        <SheetContent side="right" className="w-[500px] md:w-[700px] p-0 border-none bg-white shadow-3xl">
          <SheetHeader className="p-14 bg-slate-50 border-b">
            <SheetTitle className="text-5xl font-black uppercase italic tracking-tighter text-secondary leading-none">STOCK <span className="text-primary not-italic">VN</span></SheetTitle>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2">VEHÍCULOS PENDIENTES DE UBICAR</p>
          </SheetHeader>
          <div className="p-12 space-y-8 overflow-y-auto h-[calc(100vh-220px)]">
            {pendingStock.length === 0 ? (
              <div className="text-center py-28 space-y-4 opacity-30">
                <Package className="w-16 h-16 mx-auto" />
                <p className="text-[14px] font-black uppercase tracking-widest">Almacén vacío</p>
              </div>
            ) : pendingStock.map((car) => {
              const colorObj = BMW_COLORS.find(c => c.code === car.colorCodigo);
              return (
                <div key={car.id} onClick={() => { setMovingVehicleId(car.id); setIsStockSheetOpen(false); }} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:border-primary hover:shadow-xl cursor-pointer transition-all relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-4 group-hover:w-6 transition-all" style={{ backgroundColor: colorObj?.hex || '#CBD5E1' }} />
                  <div className="ml-8 space-y-5">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black text-secondary text-2xl uppercase leading-none tracking-tight">{car.modelo}</h4>
                      <Badge variant="outline" className="text-[11px] font-black uppercase px-4 py-1.5 rounded-xl text-primary border-primary/20">{car.estado}</Badge>
                    </div>
                    <div className="flex items-center gap-5">
                      <Badge variant="outline" className="text-[12px] font-mono font-bold text-slate-400 px-5 py-1.5 rounded-xl border-slate-100">{car.vin7 || car.vin?.slice(-7)}</Badge>
                      <div className="flex items-center gap-2 text-slate-400">
                        <ChevronRight className="w-4 h-4" />
                        <span className="text-[11px] font-black uppercase tracking-widest">{car.ubicacion}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Diálogo Nuevo Activo - Estética Premium */}
      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-[4rem] shadow-4xl">
          <div className="p-12 bg-secondary text-white"><h2 className="text-4xl font-black uppercase italic tracking-tighter">ALTA DE VEHÍCULO</h2></div>
          <div className="p-14 space-y-12 bg-white">
            <div className="grid grid-cols-2 gap-10">
              <div className="space-y-5">
                <Label className="text-[13px] font-black uppercase text-slate-400 px-3 tracking-widest">Modelo BMW</Label>
                <Input value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} className="h-20 bg-slate-50 border-none font-black uppercase text-lg rounded-3xl px-8 shadow-inner" placeholder="EJ: X5 xDRIVE45e" />
              </div>
              <div className="space-y-5">
                <Label className="text-[13px] font-black uppercase text-slate-400 px-3 tracking-widest">Bastidor (VIN)</Label>
                <Input value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} className="h-20 bg-slate-50 border-none font-mono text-lg uppercase rounded-3xl px-8 shadow-inner" placeholder="VIN COMPLETO" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-10">
              <div className="space-y-5">
                <Label className="text-[13px] font-black uppercase text-slate-400 px-3 tracking-widest">Ubicación de Entrada</Label>
                <Select value={formData.ubicacion} onValueChange={v => setFormData({...formData, ubicacion: v})}>
                  <SelectTrigger className="h-20 bg-slate-50 border-none text-lg uppercase font-black rounded-3xl px-8"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-3xl border-none shadow-3xl">
                    {SHOWROOM_PLAZAS.map(p => <SelectItem key={p} value={p} className="rounded-xl">{p}</SelectItem>)}
                    <Separator className="my-3" />
                    {OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p} className="rounded-xl">{p.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-5">
                <Label className="text-[13px] font-black uppercase text-slate-400 px-3 tracking-widest">Color Oficial</Label>
                <Select value={formData.colorBMW} onValueChange={v => setFormData({...formData, colorBMW: v})}>
                  <SelectTrigger className="h-20 bg-slate-50 border-none text-lg uppercase font-black rounded-3xl px-8"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-3xl shadow-4xl max-h-[450px] p-3">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code} className="rounded-2xl font-bold py-4">{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-5">
              <Label className="text-[13px] font-black uppercase text-slate-400 px-3 tracking-widest">Carrocería (Silueta)</Label>
              <Select value={formData.bodyType} onValueChange={v => setFormData({...formData, bodyType: v})}>
                <SelectTrigger className="h-20 bg-slate-50 border-none text-lg uppercase font-black rounded-3xl px-8"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-3xl border-none shadow-3xl p-3">
                  {["SUV", "Berlina", "Coupe", "GranCoupe", "Roadster"].map(t => <SelectItem key={t} value={t} className="rounded-2xl font-bold py-4">{t.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleQuickAdd} className="w-full h-24 bg-primary text-white rounded-[3rem] font-black uppercase text-[16px] shadow-3xl hover:bg-blue-800 transition-all active:scale-[0.98] mt-6"><Save className="mr-5 w-8 h-8" /> GUARDAR EN EL SISTEMA</Button>
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
