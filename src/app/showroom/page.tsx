
'use client';

import { useState, useMemo, Suspense, useEffect } from "react";
import { 
  Plus, Move, Loader2, X, Trash2, PlusCircle, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, updateDoc, deleteDoc, addDoc, query, orderBy } from "firebase/firestore";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  return (
    <svg viewBox="0 0 100 200" className={cn("w-full h-full drop-shadow-2xl", className)} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="glassGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#333" />
          <stop offset="50%" stopColor="#555" />
          <stop offset="100%" stopColor="#333" />
        </linearGradient>
      </defs>
      {/* Sombra proyectada */}
      <ellipse cx="50" cy="110" rx="45" ry="95" fill="black" opacity="0.15" />
      
      {/* Cuerpo principal */}
      <path 
        d={bodyType === 'SUV' 
          ? "M18,15 Q18,5 30,5 L70,5 Q82,5 82,15 L88,50 Q88,65 86,180 Q84,198 70,202 L30,202 Q16,198 14,180 Q12,65 12,50 L18,15 Z"
          : bodyType === 'Coupe'
          ? "M25,10 Q25,0 35,0 L65,0 Q75,0 75,10 L84,60 Q84,80 80,180 Q76,200 65,202 L35,202 Q24,200 20,180 Q16,80 16,60 L25,10 Z"
          : "M20,12 Q20,2 32,2 L68,2 Q80,2 80,12 L86,55 Q86,75 82,185 Q78,202 68,204 L32,204 Q22,202 18,185 Q14,75 14,55 L20,12 Z"
        }
        fill={color} 
        stroke="rgba(0,0,0,0.1)"
        strokeWidth="1"
      />

      {/* Parabrisas delantero */}
      <path d="M26,52 Q50,44 74,52 L70,85 Q50,78 30,85 Z" fill="url(#glassGradient)" opacity="0.8" />
      
      {/* Techo / Líneas de estructura */}
      <path d="M30,88 L70,88 Q70,125 66,155 L34,155 Q30,125 30,88 Z" fill="rgba(0,0,0,0.05)" />
      
      {/* Luna trasera */}
      <path d="M34,160 Q50,168 66,160 L63,185 Q50,192 37,185 Z" fill="url(#glassGradient)" opacity="0.8" />
      
      {/* Retrovisores */}
      <path d="M14,68 L4,76 Q2,80 4,86 L14,82 Z" fill={color} filter="brightness(0.8)" />
      <path d="M86,68 L96,76 Q98,80 96,86 L86,82 Z" fill={color} filter="brightness(0.8)" />
      
      {/* Detalles capó */}
      <path d="M42,10 L42,35 M58,10 L58,35" stroke="rgba(0,0,0,0.1)" strokeWidth="0.8" fill="none" />
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
    if (searchParams.get('add') === 'true') setIsAddingNew(true);
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
      toast({ title: "Vehículo Movido a Stock", description: "Plaza liberada automáticamente." });
    }

    updateDoc(docRef, finalUpdates).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: finalUpdates }));
    });
  };

  const handleSwapOrMove = (sourceId: string, targetPlaza: string) => {
    const sourceCar = vehiculos.find(v => v.id === sourceId);
    const targetCar = vehiculos.find(v => v.ubicacion === targetPlaza);

    if (targetCar && targetCar.id !== sourceId) {
      const oldLocation = PLAZAS_LIST.includes(sourceCar?.ubicacion) ? sourceCar.ubicacion : 'Stock';
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
    const colorObj = BMW_COLORS.find(c => c.code === (vehicle?.colorCodigo || vehicle?.colorBMW));

    return (
      <div 
        key={id}
        onClick={() => movingVehicleId ? handleSwapOrMove(movingVehicleId, id) : vehicle && setSelectedVehicle(vehicle)}
        className={cn(
          "relative flex flex-col items-center justify-center transition-all h-full w-full rounded-2xl border-2 overflow-hidden bg-white",
          vehicle ? "border-transparent shadow-sm cursor-pointer hover:shadow-md" : "border-slate-50 border-dashed bg-white/40",
          isMovingTarget && "border-primary bg-primary/5 ring-4 ring-primary/20 z-50 scale-[1.02]"
        )}
      >
        <div className="absolute top-2 left-3 z-20">
          <span className="text-[10px] font-black uppercase text-slate-300 tracking-tighter">{id}</span>
        </div>
        {vehicle ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <div className="w-[60%] h-[45%] mb-3 rotate-90 flex items-center justify-center">
              <CarSilhouette bodyType={vehicle.bodyType || 'SUV'} color={colorObj?.hex || '#CBD5E1'} />
            </div>
            <div className="text-center px-1 space-y-0.5">
              <p className="text-[10px] font-black uppercase text-secondary truncate max-w-[140px] leading-tight">{vehicle.modelo}</p>
              <p className="text-[8px] font-black uppercase text-primary leading-tight">{colorObj?.name || 'COLOR DESCONOCIDO'}</p>
              <p className="text-[7.5px] font-mono font-bold text-slate-400">{vehicle.vin7 || vehicle.vin?.slice(-7)}</p>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#f4f7fa] overflow-hidden">
      <div className="bg-white border-b px-8 py-4 flex items-center justify-between shrink-0 shadow-sm z-40">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-secondary uppercase italic leading-none tracking-tighter">PLANO <span className="text-primary not-italic">EXPOSICIÓN</span></h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">SISTEMA LOGÍSTICO MOMENTUM NAVARRA</p>
        </div>
        <div className="flex gap-2">
          {movingVehicleId && (
            <Button onClick={() => setMovingVehicleId(null)} className="h-10 bg-primary animate-pulse text-white rounded-xl font-black uppercase text-[10px] px-6">
              SELECCIONA PLAZA DESTINO
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsStockSheetOpen(true)} className="h-10 rounded-xl font-black uppercase text-[10px] px-6 border-slate-200">
            <Package className="w-4 h-4 mr-2" /> STOCK ({pendingStock.length})
          </Button>
          <Button onClick={() => setIsAddingNew(true)} className="h-10 bg-secondary hover:bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] px-6 shadow-lg">
            <Plus className="w-4 h-4 mr-2" /> NUEVO VEHÍCULO
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden flex items-center justify-center">
        <div className="w-full h-full max-w-[1600px] grid grid-rows-5 gap-3">
          {/* Fila 1 */}
          <div className="grid grid-cols-6 gap-3">
            {renderPlaza("P1")} {renderPlaza("P2")} {renderPlaza("P3")} {renderPlaza("P4")}
            <div className="bg-transparent" /> <div className="bg-transparent" />
          </div>
          {/* Fila 2 */}
          <div className="grid grid-cols-6 gap-3">
            {renderPlaza("P5")} {renderPlaza("P6")} {renderPlaza("P7")} {renderPlaza("P8")}
            <div className="bg-transparent" /> <div className="bg-transparent" />
          </div>
          {/* Fila 3: Espacio Mesas Limpio */}
          <div className="grid grid-cols-6 gap-3">
            <div className="bg-transparent" /> <div className="bg-transparent" />
            <div className="bg-transparent" /> <div className="bg-transparent" />
            <div className="bg-transparent" /> <div className="bg-transparent" />
          </div>
          {/* Fila 4 */}
          <div className="grid grid-cols-6 gap-3">
            {renderPlaza("P9")} {renderPlaza("P10")} {renderPlaza("P11")} {renderPlaza("P12")}
            <div className="bg-transparent" /> {renderPlaza("P13")}
          </div>
          {/* Fila 5: P15 bajo P10, P14 bajo P12 (Izquierda del pasillo) */}
          <div className="grid grid-cols-6 gap-3">
            <div className="bg-transparent" /> {renderPlaza("P15")}
            <div className="bg-transparent" /> {renderPlaza("P14")}
            <div className="bg-transparent" /> <div className="bg-transparent" />
          </div>
        </div>
      </div>

      <Sheet open={!!selectedVehicle} onOpenChange={o => !o && setSelectedVehicle(null)}>
        <SheetContent side="bottom" className="h-[45vh] p-0 rounded-t-[3rem] border-none shadow-2xl overflow-hidden bg-white">
          <SheetHeader className="sr-only">
            <SheetTitle>Detalles del Vehículo</SheetTitle>
          </SheetHeader>
          {selectedVehicle && (
            <div className="flex flex-col h-full">
              <div className="bg-secondary p-8 text-white flex justify-between items-end">
                <div className="space-y-2">
                  <Badge className="bg-primary text-white text-[11px] font-black uppercase px-4 py-1">{selectedVehicle.estado}</Badge>
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">{selectedVehicle.modelo}</h2>
                  <p className="text-white/40 font-mono text-xs font-bold tracking-widest">VIN: {selectedVehicle.vin}</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => { setMovingVehicleId(selectedVehicle.id); setSelectedVehicle(null); }} className="h-14 w-14 rounded-2xl bg-white/5 text-white hover:bg-white/10">
                    <Move className="w-6 h-6" />
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedVehicle(null)} className="h-14 w-14 rounded-2xl bg-white/5 text-white hover:bg-white/10">
                    <X className="w-6 h-6" />
                  </Button>
                </div>
              </div>
              <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Actualizar Estado</Label>
                  <Select value={selectedVehicle.estado} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { estado: v })}>
                    <SelectTrigger className="h-14 bg-slate-50 border-none rounded-2xl font-black uppercase text-xs shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">{ESTADOS.map(e => <SelectItem key={e} value={e}>{e.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Cambiar Ubicación</Label>
                  <Select value={selectedVehicle.ubicacion} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { ubicacion: v })}>
                    <SelectTrigger className="h-14 bg-slate-50 border-none rounded-2xl font-black uppercase text-xs shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl max-h-[300px]">
                      {PLAZAS_LIST.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      <Separator className="my-2" />
                      {OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="destructive" className="h-14 w-full rounded-2xl font-black uppercase text-xs shadow-xl border-none" onClick={() => { if(confirm("¿Eliminar este registro permanentemente?")) { deleteDoc(doc(db, "vehiculos", selectedVehicle.id)); setSelectedVehicle(null); } }}>
                    <Trash2 className="w-5 h-5 mr-3" /> ELIMINAR REGISTRO
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={isStockSheetOpen} onOpenChange={setIsStockSheetOpen}>
        <SheetContent side="right" className="w-[400px] p-0 border-none bg-white shadow-2xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Inventario de Stock Pendiente</SheetTitle>
          </SheetHeader>
          <div className="p-8 bg-slate-50 border-b flex flex-col gap-1">
            <h3 className="text-2xl font-black uppercase italic text-secondary">STOCK PENDIENTE</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">VEHÍCULOS SIN PLAZA ASIGNADA</p>
          </div>
          <div className="p-6 space-y-3 overflow-y-auto h-[calc(100vh-120px)] scrollbar-none">
            {pendingStock.length === 0 ? (
              <div className="text-center py-20 text-slate-300 font-black uppercase text-xs">Todo el stock ubicado</div>
            ) : pendingStock.map(car => (
              <div key={car.id} onClick={() => { setMovingVehicleId(car.id); setIsStockSheetOpen(false); }} className="p-5 bg-white border border-slate-100 rounded-2xl hover:border-primary hover:shadow-md cursor-pointer transition-all">
                <p className="font-black text-secondary text-sm uppercase truncate leading-none mb-2">{car.modelo}</p>
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-primary mb-0.5">{BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW))?.name}</span>
                    <span className="text-[9px] font-mono font-bold text-slate-400">{car.vin7 || car.vin?.slice(-7)}</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] uppercase font-black px-3 py-1 bg-slate-50">{car.ubicacion}</Badge>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="p-0 border-none rounded-[2.5rem] overflow-hidden max-w-md shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Nueva Alta de Vehículo</DialogTitle>
          </DialogHeader>
          <div className="p-6 bg-secondary text-white font-black uppercase italic text-center text-lg">ALTA DE VEHÍCULO VN</div>
          <div className="p-8 space-y-5 bg-white">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Modelo</Label>
              <Input placeholder="EJ: BMW X5 XDRIVE30D..." value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">VIN (Bastidor Completo)</Label>
              <Input placeholder="WBA..." value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Color Oficial</Label>
                <Select value={formData.colorBMW} onValueChange={v => setFormData({...formData, colorBMW: v})}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold text-[10px] uppercase shadow-sm"><SelectValue/></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Carrocería</Label>
                <Select value={formData.bodyType} onValueChange={v => setFormData({...formData, bodyType: v})}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold text-[10px] uppercase shadow-sm"><SelectValue/></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">{["SUV", "Berlina", "Coupe"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleQuickAdd} className="w-full h-14 bg-primary text-white font-black uppercase text-xs rounded-2xl shadow-xl mt-4 border-none hover:scale-[1.02] transition-transform">REGISTRAR EN STOCK</Button>
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
      toast({ title: "Vehículo Registrado", description: "El coche ha sido añadido al stock correctamente." });
      setIsAddingNew(false);
      setFormData({ modelo: "", vin: "", colorBMW: "300", ubicacion: "Stock", motor: "sDrive20i", bodyType: "SUV", estado: "Stock" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al Registrar" });
    }
  }
}

export default function ShowroomFinal() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-[#f4f7fa]"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>}>
      <ShowroomContent />
    </Suspense>
  );
}
