
'use client';

import { useState, useMemo, useEffect, Suspense } from "react";
import { 
  Plus, Move, Car, ChevronRight, Loader2, X, Save, Trash2, Monitor, Footprints, PlusCircle, Zap, MapPin, Package, Search
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
import { Dialog, DialogContent } from "@/dialog";
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
const OTHER_LOCATIONS = ["Terraza", "Entreplanta", "Taller", "Stock", "Entregado", "Cedido"];

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
    <div className={cn("transition-all duration-500 flex items-center justify-center", className)} style={{ transform: `rotate(${rotacion}deg)` }}>
      <svg viewBox="0 0 100 180" className="w-14 h-24 md:w-24 md:h-40 filter drop-shadow-md">
        <path d={paths[type] || paths.SUV} fill="rgba(0,0,0,0.15)" transform="translate(2,2)" />
        <path d={paths[type] || paths.SUV} fill={colorHex} stroke="rgba(0,0,0,0.3)" strokeWidth="1.2" />
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
    
    const payload = { ...updates, updatedAt: new Date().toISOString() };
    
    updateDoc(docRef, payload).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path, operation: 'update', requestResourceData: payload,
      }));
    });

    if (updates.ubicacion && vehicle && vehicle.ubicacion !== updates.ubicacion) {
      addDoc(collection(db, "movimientos"), {
        vehiculoId: vehicleId,
        vehiculoInfo: `${vehicle.modelo} (${vehicle.vin7 || vehicle.vin?.slice(-7)})`,
        tipoAccion: 'Movimiento',
        fecha: new Date().toISOString(),
        origen: vehicle.ubicacion || 'N/A',
        destino: updates.ubicacion,
        usuario: "SISTEMA GENIUS",
        detalles: `Traslado a ${updates.ubicacion}`
      });
    }

    if (selectedVehicle?.id === vehicleId) {
      setSelectedVehicle((prev: any) => ({ ...prev, ...updates }));
    }
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

    const colorObj = BMW_COLORS.find(c => c.code === formData.colorBMW);
    const vinNorm = formData.vin.trim().toUpperCase();
    
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
      toast({ title: "Vehículo Guardado", description: "El activo se ha registrado correctamente." });
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'vehiculos', operation: 'create', requestResourceData: vehiclePayload,
      }));
    }
  };

  const renderPlaza = (id: string) => {
    const vehicle = vehiculos.find(v => v.ubicacion === id);
    const isSelected = selectedVehicle && vehicle && selectedVehicle.id === vehicle.id;
    const isMovingTarget = !!movingVehicleId && !vehicle;
    const isMovingSelf = movingVehicleId === vehicle?.id;
    
    const colorObj = BMW_COLORS.find(c => 
      c.code === vehicle?.colorCodigo || 
      vehicle?.colorExterior?.toUpperCase().includes(c.code.toUpperCase()) ||
      vehicle?.colorExterior?.toUpperCase().includes(c.name.toUpperCase())
    );
    const colorHex = colorObj?.hex || '#F5F5F5'; 
    const rotacion = FIXED_ORIENTATIONS[id] !== undefined ? FIXED_ORIENTATIONS[id] : 90;
    
    const isP13 = id === "P13";
    const isP14 = id === "P14";

    return (
      <div 
        key={id}
        onClick={() => {
          if (movingVehicleId) {
            if (!vehicle) {
              handleUpdateVehicle(movingVehicleId, { ubicacion: id, estado: 'Exposicion' });
              setMovingVehicleId(null);
              toast({ title: "Vehículo Ubicado", description: `Asignado a plaza ${id}` });
            } else if (isMovingSelf) {
              setMovingVehicleId(null);
            } else {
              toast({ variant: "destructive", title: "Plaza Ocupada", description: "Selecciona una plaza vacía." });
            }
          } else if (vehicle) {
            setSelectedVehicle(vehicle);
          }
        }}
        className={cn(
          "relative flex flex-col items-center justify-center transition-all h-full w-full rounded-xl border overflow-hidden",
          vehicle ? "border-transparent cursor-pointer" : "border-dashed border-slate-200 bg-slate-50/10",
          isMovingTarget && "border-primary/50 bg-primary/5 cursor-pointer hover:bg-primary/10",
          isP13 && !vehicle && "bg-blue-50/5 border-blue-100 border-solid",
          isP14 && "border-accent/40 bg-accent/5",
          (isSelected || isMovingSelf) && "z-20 ring-2 ring-primary/30 bg-white shadow-lg",
          isMovingSelf && "animate-pulse border-primary"
        )}
      >
        <div className="absolute top-1 left-1.5 flex flex-col z-10 pointer-events-none">
          <span className={cn("text-[8px] md:text-[9px] font-black uppercase tracking-widest", isP14 ? "text-accent" : "text-slate-400")}>{id}</span>
          {isP13 && <Zap className="w-2.5 h-2.5 text-blue-500 mt-0.5" />}
        </div>
        
        {isP14 && !vehicle && (
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            <span className="text-4xl font-black italic tracking-tighter text-accent">///M</span>
          </div>
        )}

        {vehicle ? (
          <div className="flex flex-col items-center justify-between animate-in fade-in duration-300 w-full h-full px-1 py-1 relative">
            <div className="flex-1 flex items-center justify-center w-full">
              <BmwSilhouette 
                type={vehicle.bodyType || 'SUV'} 
                colorHex={colorHex} 
                rotacion={rotacion} 
                className={cn("scale-[4.5] md:scale-[8.5] translate-y-[-5%] md:translate-y-0", (isSelected || isMovingSelf) && "filter drop-shadow-[0_0_15px_rgba(0,0,0,0.4)]")} 
              />
            </div>
            
            <div className="w-full bg-white/95 px-1 py-1 rounded-lg shadow-sm flex flex-col items-center z-10 border border-slate-100 mt-auto min-h-[32px] md:min-h-0 justify-center">
              <p className="text-[7.5px] md:text-[9.5px] font-black text-secondary uppercase whitespace-nowrap overflow-hidden text-center leading-tight tracking-tighter w-full px-1">
                {vehicle.modelo}
              </p>
              <div className="flex gap-1.5 items-center leading-none mt-0.5">
                <span className="text-[6.5px] md:text-[8.5px] font-mono font-bold text-slate-500">{vehicle.vin7 || vehicle.vin?.slice(-7)}</span>
                <span className="text-[6.5px] md:text-[8.5px] font-black text-primary">{vehicle.colorCodigo}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-10">
             {movingVehicleId ? <Move className="w-4 h-4 text-primary animate-bounce" /> : <PlusCircle className="w-4 h-4 text-slate-200" />}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f7fa] overflow-hidden">
      <div className="bg-white border-b px-4 py-2 shrink-0 z-50 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-base font-black text-secondary italic uppercase leading-none">PLANO <span className="text-primary not-italic">VN</span></h1>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">MOMENTUM NAVARRA</p>
          </div>
          {movingVehicleId && (
            <Badge className="bg-primary text-white animate-pulse px-3 py-1 rounded-full font-black uppercase text-[8px] gap-2 border-none">
              <Move className="w-3 h-3" /> UBICAR DESTINO
              <button onClick={() => setMovingVehicleId(null)} className="ml-1 bg-white/20 hover:bg-white/30 rounded-full p-0.5 transition-colors"><X className="w-2.5 h-2.5" /></button>
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsStockSheetOpen(true)} className="h-8 rounded-lg font-black uppercase text-[8px] px-3 border-slate-200 shadow-sm">
            <Package className="w-3.5 h-3.5 mr-1.5 text-primary" /> STOCK ({pendingStock.length})
          </Button>
          <Button onClick={() => setIsAddingNew(true)} className="h-8 bg-secondary hover:bg-secondary/90 rounded-lg font-black uppercase text-[8px] px-3 border-none text-white shadow-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> NUEVO
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative p-1 md:p-2">
        {loadingVehiculos ? (
          <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
        ) : (
          <div className="h-full w-full max-w-[1400px] mx-auto flex gap-1 md:gap-3">
            <div className="flex-[6] flex flex-col gap-1 md:gap-2 h-full">
              <div className="flex-1 grid grid-cols-4 gap-1 md:gap-2">{["P1", "P2", "P3", "P4"].map(id => renderPlaza(id))}</div>
              <div className="flex-1 grid grid-cols-4 gap-1 md:gap-2">{["P5", "P6", "P7", "P8"].map(id => renderPlaza(id))}</div>
              <div className="h-6 md:h-10 shrink-0 grid grid-cols-4 gap-1 md:gap-2">
                {[1, 2, 3, 4].map(num => (
                  <div key={`m-${num}`} className="bg-[#F5E9DA] border border-[#D2B48C] rounded-lg flex items-center justify-center shadow-sm">
                    <Monitor className="w-2.5 h-2.5 md:w-3 md:h-3 text-[#8B4513] mr-1" />
                    <span className="text-[6px] md:text-[7px] font-black uppercase tracking-widest text-[#8B4513]">M-{num}</span>
                  </div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-4 gap-1 md:gap-2">{["P9", "P10", "P11", "P12"].map(id => renderPlaza(id))}</div>
              <div className="flex-1 grid grid-cols-4 gap-1 md:gap-2">
                <div className="col-span-1" />
                <div className="col-span-1">{renderPlaza("P14")}</div>
                <div className="col-span-1">{renderPlaza("P15")}</div>
                <div className="col-span-1" />
              </div>
            </div>
            <div className="w-2 md:w-6 flex flex-col items-center py-4 opacity-10 shrink-0">
               {[1,2,3,4,5,6].map(i => <Footprints key={i} className="w-2 md:w-2.5 h-2 md:h-2.5 rotate-90 my-auto text-slate-600" />)}
            </div>
            <div className="w-12 md:w-24 flex flex-col justify-center h-full py-[15%]">
               <div className="h-[25%]">{renderPlaza("P13")}</div>
            </div>
          </div>
        )}
      </div>

      <Sheet open={!!selectedVehicle} onOpenChange={(open) => !open && setSelectedVehicle(null)}>
        <SheetContent side="bottom" className="p-0 rounded-t-[2.5rem] border-none h-[75vh] bg-white overflow-hidden shadow-2xl">
          {selectedVehicle && (
            <div className="flex flex-col h-full">
              <div className="p-6 bg-secondary text-white shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-32 -translate-y-32 blur-3xl" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-primary text-white text-[8px] font-black uppercase px-3 py-1 rounded-full border-none">
                        {selectedVehicle.estado}
                      </Badge>
                      <Badge variant="outline" className="border-white/20 text-white/60 text-[8px] font-mono">
                        {selectedVehicle.vin7 || selectedVehicle.vin?.slice(-7)}
                      </Badge>
                    </div>
                    <h2 className="text-2xl font-black uppercase italic leading-none tracking-tighter">{selectedVehicle.modelo}</h2>
                    <p className="text-white/40 text-[8px] font-bold uppercase tracking-widest">{selectedVehicle.colorExterior}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => handleDeleteVehicle(selectedVehicle.id, `${selectedVehicle.modelo} (${selectedVehicle.vin7})`)} className="text-white hover:bg-red-500 hover:text-white rounded-full h-10 w-10">
                      <Trash2 className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" onClick={() => setSelectedVehicle(null)} className="text-white hover:bg-white/10 rounded-full h-10 w-10"><X className="w-6 h-6" /></Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-6 space-y-8 overflow-y-auto bg-slate-50/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Cambiar Estado</Label>
                      <Select value={selectedVehicle.estado} onValueChange={(val) => handleUpdateVehicle(selectedVehicle.id, { estado: val })}>
                        <SelectTrigger className="h-12 bg-white border-slate-100 font-black text-xs uppercase rounded-xl shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">{ESTADOS.map(e => <SelectItem key={e} value={e}>{e.toUpperCase()}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-3">
                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Acciones Logísticas Rápidas</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button onClick={() => handleUpdateVehicle(selectedVehicle.id, { ubicacion: 'Terraza', estado: 'Stock' })} variant="outline" className="h-11 rounded-xl text-[9px] font-black uppercase border-slate-100 hover:bg-slate-50">TERRAZA</Button>
                        <Button onClick={() => handleUpdateVehicle(selectedVehicle.id, { ubicacion: 'Entreplanta', estado: 'Stock' })} variant="outline" className="h-11 rounded-xl text-[9px] font-black uppercase border-slate-100 hover:bg-slate-50">ENTREPLANTA</Button>
                        <Button onClick={() => handleUpdateVehicle(selectedVehicle.id, { ubicacion: 'Cedido', estado: 'Cedido' })} variant="outline" className="h-11 rounded-xl text-[9px] font-black uppercase border-slate-100 hover:bg-blue-50">CEDIDO</Button>
                        <Button onClick={() => handleUpdateVehicle(selectedVehicle.id, { ubicacion: 'Entregado', estado: 'Entregado' })} variant="outline" className="h-11 rounded-xl text-[9px] font-black uppercase border-slate-100 hover:bg-emerald-50">ENTREGADO</Button>
                      </div>
                    </div>

                    <Button 
                      onClick={() => { setMovingVehicleId(selectedVehicle.id); setSelectedVehicle(null); }} 
                      className="w-full h-14 bg-primary text-white rounded-xl font-black uppercase text-[10px] shadow-xl border-none gap-2 mt-4"
                    >
                      <Move className="w-4 h-4" /> REUBICAR EN PLANO
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                     <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Ficha Técnica Stock</Label>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                           <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Ubicación Actual</p>
                           <Badge className="bg-secondary text-white text-[9px] font-black uppercase rounded-lg px-3 py-1 border-none shadow-sm">{selectedVehicle.ubicacion}</Badge>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                           <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Motorización</p>
                           <p className="text-[10px] font-black text-secondary uppercase leading-none">{selectedVehicle.motor}</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm col-span-2">
                           <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Bastidor Completo</p>
                           <p className="text-[10px] font-mono font-bold text-secondary">{selectedVehicle.vin}</p>
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
        <SheetContent side="right" className="w-[300px] md:w-[400px] p-0 border-none bg-white shadow-2xl">
          <SheetHeader className="p-6 bg-slate-50 border-b">
            <SheetTitle className="text-lg font-black uppercase italic tracking-tighter text-secondary">STOCK VN</SheetTitle>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Activos sin plaza asignada</p>
          </SheetHeader>
          <div className="p-4 space-y-3 overflow-y-auto h-[calc(100vh-120px)]">
            {pendingStock.length === 0 ? (
              <div className="p-10 text-center space-y-4">
                <Package className="w-10 h-10 text-slate-200 mx-auto" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Exposición al completo</p>
              </div>
            ) : (
              pendingStock.map((car) => {
                const colorObj = BMW_COLORS.find(c => c.code === car.colorCodigo || car.colorExterior?.toUpperCase().includes(c.code.toUpperCase()));
                return (
                  <div 
                    key={car.id} 
                    onClick={() => {
                      setMovingVehicleId(car.id);
                      setIsStockSheetOpen(false);
                      toast({ title: "Modo Ubicación", description: `Selecciona una plaza para el ${car.modelo}` });
                    }}
                    className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:border-primary/30 cursor-pointer transition-all group relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: colorObj?.hex || '#F5F5F5' }} />
                    <div className="flex justify-between items-start ml-2">
                      <div className="space-y-1">
                        <h4 className="font-black text-secondary text-[10px] uppercase leading-none group-hover:text-primary">{car.modelo}</h4>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[8px] font-mono font-bold text-slate-400 uppercase">{car.vin7 || car.vin?.slice(-7)}</p>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-tight">{car.colorExterior}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[7px] font-black uppercase bg-slate-50">{car.ubicacion}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="p-5 bg-secondary text-white"><h2 className="text-base font-black uppercase italic tracking-tight">REGISTRO DE STOCK</h2></div>
          <div className="p-5 space-y-4 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Modelo</Label>
                <Input value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} className="h-9 bg-slate-50 border-none font-bold uppercase text-[10px] rounded-lg" />
              </div>
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Bastidor</Label>
                <Input value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} className="h-9 bg-slate-50 border-none font-mono text-[10px] uppercase rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Ubicación</Label>
                <Select value={formData.ubicacion} onValueChange={v => setFormData({...formData, ubicacion: v})}>
                  <SelectTrigger className="h-9 bg-slate-50 border-none text-[10px] uppercase font-black rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-xl">
                    {SHOWROOM_PLAZAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    <Separator className="my-2" />
                    {OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Color BMW</Label>
                <Select value={formData.colorBMW} onValueChange={v => setFormData({...formData, colorBMW: v})}>
                  <SelectTrigger className="h-9 bg-slate-50 border-none text-[10px] uppercase font-black rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-xl">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleQuickAdd} className="w-full h-11 bg-primary text-white rounded-xl font-black uppercase text-[9px] shadow-lg mt-1 transition-all active:scale-95">
              <Save className="mr-2 w-3.5 h-3.5" /> GUARDAR EN STOCK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ShowroomRetailNext() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>}>
      <ShowroomContent />
    </Suspense>
  );
}
