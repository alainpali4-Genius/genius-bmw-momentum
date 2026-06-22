
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
    
    // AUTOMATIZACIÓN: Si el estado cambia a algo que no sea "Exposicion", y estaba en un P#, mover a Stock automáticamente
    if (updates.estado && updates.estado !== 'Exposicion') {
      if (vehicle.ubicacion?.startsWith('P')) {
        finalUpdates.ubicacion = 'Stock';
        toast({ title: "Vehículo Retirado", description: "Movido automáticamente a Stock por cambio de estado." });
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
      const oldLocation = sourceCar.ubicacion;
      const swapTo = oldLocation?.startsWith('P') ? oldLocation : 'Stock';
      
      handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      handleUpdateVehicle(targetCar.id, { ubicacion: swapTo });
      
      toast({ title: "Intercambio Realizado", description: `${sourceCar.vin7} y ${targetCar.vin7} intercambiados.` });
    } else {
      handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      toast({ title: "Vehículo Ubicado", description: `Movido a ${targetPlaza}.` });
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
      comercial: "SISTEMA",
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

  const isDarkColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  };

  const renderPlaza = (id: string) => {
    const vehicle = vehiculos.find(v => v.ubicacion === id);
    const isSelected = selectedVehicle && vehicle && selectedVehicle.id === vehicle.id;
    const isMovingTarget = !!movingVehicleId;
    const isMovingSelf = movingVehicleId === vehicle?.id;
    
    const colorObj = BMW_COLORS.find(c => c.code === vehicle?.colorCodigo || vehicle?.colorExterior?.includes(c.code));
    const colorHex = colorObj?.hex || '#F5F5F5'; 

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
          "relative flex flex-col items-center justify-center transition-all h-full w-full rounded-2xl border group overflow-hidden shadow-sm",
          vehicle ? "border-transparent cursor-pointer" : "border-slate-100 bg-white/50",
          isMovingTarget && !isMovingSelf && "border-primary bg-primary/5 cursor-pointer ring-2 ring-primary/20",
          (isSelected || isMovingSelf) && "z-20 ring-4 ring-primary/30 bg-white shadow-2xl scale-[1.02]",
          isMovingSelf && "animate-pulse"
        )}
      >
        <div className="absolute top-2 left-2.5 z-10 pointer-events-none">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{id}</span>
        </div>
        
        {vehicle ? (
          <div 
            className="w-full h-full flex flex-col items-center justify-center text-center p-3 transition-colors"
            style={{ backgroundColor: colorHex }}
          >
            <div className={cn(
              "flex flex-col items-center justify-center w-full",
              isDarkColor(colorHex) ? "text-white" : "text-secondary"
            )}>
              <p className="text-[10px] md:text-[12px] font-black uppercase leading-tight mb-2 tracking-tight">
                {vehicle.modelo}
              </p>
              <div className={cn(
                "px-3 py-1 rounded-lg text-[8px] md:text-[10px] font-mono font-bold shadow-inner",
                isDarkColor(colorHex) ? "bg-black/20" : "bg-white/40"
              )}>
                {vehicle.vin7 || vehicle.vin?.slice(-7)}
              </div>
            </div>
          </div>
        ) : (
          <div className="opacity-10 group-hover:opacity-30 transition-opacity">
             {movingVehicleId ? <RefreshCw className="w-5 h-5 text-primary animate-spin" /> : <PlusCircle className="w-6 h-6 text-slate-400" />}
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
            <Badge className="bg-primary text-white animate-pulse px-4 py-2 rounded-full font-black uppercase text-[10px] gap-2 border-none">
              <Move className="w-4 h-4" /> SELECCIONA PLAZA PARA MOVER O INTERCAMBIAR
              <button onClick={() => setMovingVehicleId(null)} className="ml-2 bg-white/20 rounded-full p-0.5"><X className="w-3 h-3" /></button>
            </Badge>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setIsStockSheetOpen(true)} className="h-11 rounded-xl font-black uppercase text-[11px] px-6">
            <Package className="w-4 h-4 mr-2 text-primary" /> STOCK ({pendingStock.length})
          </Button>
          <Button onClick={() => setIsAddingNew(true)} className="h-11 bg-secondary text-white rounded-xl font-black uppercase text-[11px] px-6">
            <Plus className="w-4 h-4 mr-2" /> NUEVO ACTIVO
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative p-4 md:p-8">
        {loadingVehiculos ? (
          <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>
        ) : (
          <div className="h-full w-full max-w-[1600px] mx-auto flex gap-4 lg:gap-12 overflow-hidden">
            <div className="flex-[8] flex flex-col gap-4 lg:gap-8 h-full">
              <div className="flex-1 grid grid-cols-4 gap-4 lg:gap-8">{["P1", "P2", "P3", "P4"].map(id => renderPlaza(id))}</div>
              <div className="flex-1 grid grid-cols-4 gap-4 lg:gap-8">{["P5", "P6", "P7", "P8"].map(id => renderPlaza(id))}</div>
              <div className="h-14 md:h-20 shrink-0 grid grid-cols-4 gap-4 lg:gap-8">
                {[1, 2, 3, 4].map(num => (
                  <div key={`m-${num}`} className="bg-slate-100/30 border-2 border-slate-200 border-dashed rounded-2xl flex items-center justify-center opacity-40">
                    <Monitor className="w-4 h-4 text-slate-400 mr-2" />
                    <span className="text-[7px] md:text-[9px] font-black uppercase tracking-widest text-slate-400">MESA {num}</span>
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
            <div className="w-24 md:w-48 flex flex-col justify-center h-full py-[15%] gap-6 lg:gap-12">
               <div className="h-[25%]">{renderPlaza("P13")}</div>
            </div>
          </div>
        )}
      </div>

      <Sheet open={!!selectedVehicle} onOpenChange={(open) => !open && setSelectedVehicle(null)}>
        <SheetContent side="bottom" className="p-0 rounded-t-[3rem] border-none h-[80vh] bg-white overflow-hidden shadow-2xl">
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
                    <Button variant="ghost" onClick={() => handleDeleteVehicle(selectedVehicle.id, `${selectedVehicle.modelo} (${selectedVehicle.vin7})`)} className="text-white/40 hover:bg-red-600 hover:text-white rounded-2xl h-14 w-14"><Trash2 className="w-7 h-7" /></Button>
                    <Button variant="ghost" onClick={() => setSelectedVehicle(null)} className="text-white/40 hover:bg-white/10 rounded-2xl h-14 w-14"><X className="w-10 h-10" /></Button>
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
                    </div>
                    <Button onClick={() => { setMovingVehicleId(selectedVehicle.id); setSelectedVehicle(null); }} className="w-full h-20 bg-primary text-white rounded-2xl font-black uppercase text-[12px] shadow-xl gap-4">
                      <Move className="w-6 h-6" /> REUBICAR O INTERCAMBIAR PLAZA
                    </Button>
                  </div>
                  
                  <div className="space-y-8">
                     <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest px-1">Ubicación de Inventario</Label>
                     <div className="grid grid-cols-1 gap-6">
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                           <p className="text-[9px] font-black text-slate-400 uppercase mb-3 tracking-widest">Zona Actual</p>
                           <Select value={selectedVehicle.ubicacion} onValueChange={(val) => handleUpdateVehicle(selectedVehicle.id, { ubicacion: val })}>
                              <SelectTrigger className="bg-secondary text-white text-[12px] font-black uppercase rounded-xl border-none shadow-sm h-14"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {SHOWROOM_PLAZAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                <Separator className="my-2" />
                                {OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                              </SelectContent>
                           </Select>
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
          </SheetHeader>
          <div className="p-8 space-y-5 overflow-y-auto h-[calc(100vh-160px)]">
            {pendingStock.map((car) => {
              const colorObj = BMW_COLORS.find(c => c.code === car.colorCodigo);
              return (
                <div key={car.id} onClick={() => { setMovingVehicleId(car.id); setIsStockSheetOpen(false); }} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:border-primary cursor-pointer transition-all relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                  <div className="ml-4 space-y-2">
                    <h4 className="font-black text-secondary text-sm uppercase leading-none">{car.modelo}</h4>
                    <p className="text-[11px] font-mono font-bold text-slate-400 uppercase">{car.vin7 || car.vin?.slice(-7)} • {car.ubicacion}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="p-8 bg-secondary text-white"><h2 className="text-2xl font-black uppercase italic tracking-tighter">REGISTRO DE STOCK</h2></div>
          <div className="p-10 space-y-8 bg-white">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3"><Label className="text-[11px] font-black uppercase text-slate-400 px-2 tracking-widest">Modelo</Label><Input value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} className="h-14 bg-slate-50 border-none font-bold uppercase text-sm rounded-xl" placeholder="EJ: X3" /></div>
              <div className="space-y-3"><Label className="text-[11px] font-black uppercase text-slate-400 px-2 tracking-widest">Bastidor</Label><Input value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} className="h-14 bg-slate-50 border-none font-mono text-sm uppercase rounded-xl" placeholder="VIN" /></div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3"><Label className="text-[11px] font-black uppercase text-slate-400 px-2 tracking-widest">Ubicación</Label>
                <Select value={formData.ubicacion} onValueChange={v => setFormData({...formData, ubicacion: v})}>
                  <SelectTrigger className="h-14 bg-slate-50 border-none text-sm uppercase font-black rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHOWROOM_PLAZAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    <Separator className="my-2" />
                    {OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3"><Label className="text-[11px] font-black uppercase text-slate-400 px-2 tracking-widest">Color</Label>
                <Select value={formData.colorBMW} onValueChange={v => setFormData({...formData, colorBMW: v})}>
                  <SelectTrigger className="h-14 bg-slate-50 border-none text-sm uppercase font-black rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-2xl max-h-[350px]">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleQuickAdd} className="w-full h-16 bg-primary text-white rounded-2xl font-black uppercase text-[12px] shadow-xl"><Save className="mr-3 w-6 h-6" /> GUARDAR</Button>
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
