
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
    <svg viewBox="0 0 100 200" className={cn("w-full h-full drop-shadow-xl", className)} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="105" rx="35" ry="90" fill="black" opacity="0.1" />
      <path 
        d={bodyType === 'SUV' 
          ? "M20,15 Q20,5 30,5 L70,5 Q80,5 80,15 L86,50 Q86,60 84,180 Q82,195 70,200 L30,200 Q18,195 16,180 Q14,60 14,50 L20,15 Z"
          : bodyType === 'Coupe'
          ? "M25,10 Q25,0 35,0 L65,0 Q75,0 75,10 L82,60 Q82,75 78,175 Q75,195 65,200 L35,200 Q25,195 22,175 Q18,75 18,60 L25,10 Z"
          : "M22,10 Q22,0 32,0 L68,0 Q78,0 78,10 L84,55 Q84,70 80,178 Q78,195 68,200 L32,200 Q22,195 20,178 Q16,70 16,55 L22,10 Z"
        }
        fill={color} 
      />
      <path d="M26,55 Q50,48 74,55 L70,90 Q50,82 30,90 Z" fill="black" opacity="0.3" />
      <path d="M30,95 L70,95 Q70,120 66,150 L34,150 Q30,120 30,95 Z" fill="black" opacity="0.1" />
      <path d="M34,155 Q50,162 66,155 L63,180 Q50,188 37,180 Z" fill="black" opacity="0.3" />
      <path d="M16,65 L6,72 Q4,75 6,82 L16,78 Z" fill={color} filter="brightness(0.7)" />
      <path d="M84,65 L94,72 Q96,75 94,82 L84,78 Z" fill={color} filter="brightness(0.7)" />
      <path d="M40,15 L40,40 M60,15 L60,40" stroke="black" strokeWidth="0.5" opacity="0.1" fill="none" />
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
          "relative flex flex-col items-center justify-center transition-all h-full w-full rounded-xl border-2 overflow-hidden bg-white",
          vehicle ? "border-transparent shadow-sm cursor-pointer hover:shadow-md" : "border-slate-100 border-dashed bg-white/40",
          isMovingTarget && "border-primary bg-primary/5 ring-4 ring-primary/20 z-30"
        )}
      >
        <div className="absolute top-1 left-2 z-20">
          <span className="text-[9px] font-black uppercase text-slate-300 tracking-tighter">{id}</span>
        </div>
        {vehicle ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-2">
            <div className="w-[70%] h-[50%] mb-1 rotate-90 flex items-center justify-center">
              <CarSilhouette bodyType={vehicle.bodyType || 'SUV'} color={colorObj?.hex || '#CBD5E1'} />
            </div>
            <div className="text-center px-1">
              <p className="text-[9px] font-black uppercase text-secondary truncate max-w-[120px] leading-none mb-0.5">{vehicle.modelo}</p>
              <p className="text-[7px] font-mono font-bold text-slate-400">{vehicle.vin7 || vehicle.vin?.slice(-7)}</p>
            </div>
          </div>
        ) : (
          <PlusCircle className="w-5 h-5 text-slate-200 opacity-20" />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#f4f7fa] overflow-hidden">
      <div className="bg-white border-b px-8 py-4 flex items-center justify-between shrink-0 shadow-sm z-40">
        <div className="flex flex-col">
          <h1 className="text-xl font-black text-secondary uppercase italic leading-none tracking-tighter">PLANO <span className="text-primary not-italic">EXPOSICIÓN</span></h1>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">SISTEMA LOGÍSTICO MOMENTUM NAVARRA</p>
        </div>
        <div className="flex gap-2">
          {movingVehicleId && (
            <Button onClick={() => setMovingVehicleId(null)} className="h-9 bg-primary animate-pulse text-white rounded-lg font-black uppercase text-[9px] px-4">
              SELECCIONA PLAZA DESTINO
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsStockSheetOpen(true)} className="h-9 rounded-lg font-black uppercase text-[9px] px-4 border-slate-200">
            <Package className="w-3.5 h-3.5 mr-2" /> STOCK ({pendingStock.length})
          </Button>
          <Button onClick={() => setIsAddingNew(true)} className="h-9 bg-secondary hover:bg-slate-800 text-white rounded-lg font-black uppercase text-[9px] px-4 shadow-md">
            <Plus className="w-3.5 h-3.5 mr-2" /> NUEVO
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-hidden flex items-center justify-center">
        <div className="w-full h-full max-w-[1400px] grid grid-rows-5 gap-2">
          {/* Fila 1 */}
          <div className="grid grid-cols-6 gap-2">
            {renderPlaza("P1")} {renderPlaza("P2")} {renderPlaza("P3")} {renderPlaza("P4")}
            <div className="bg-transparent" /> <div className="bg-transparent" />
          </div>
          {/* Fila 2 */}
          <div className="grid grid-cols-6 gap-2">
            {renderPlaza("P5")} {renderPlaza("P6")} {renderPlaza("P7")} {renderPlaza("P8")}
            <div className="bg-transparent" /> <div className="bg-transparent" />
          </div>
          {/* Fila 3: Mesas Limpias */}
          <div className="grid grid-cols-6 gap-2">
            <div className="bg-transparent" /> <div className="bg-transparent" />
            <div className="bg-transparent" /> <div className="bg-transparent" />
            <div className="bg-transparent" /> <div className="bg-transparent" />
          </div>
          {/* Fila 4 */}
          <div className="grid grid-cols-6 gap-2">
            {renderPlaza("P9")} {renderPlaza("P10")} {renderPlaza("P11")} {renderPlaza("P12")}
            <div className="bg-transparent border-x border-dashed border-slate-100/20" />
            {renderPlaza("P13")}
          </div>
          {/* Fila 5: P15 bajo P10, P14 bajo P12 */}
          <div className="grid grid-cols-6 gap-2">
            <div className="bg-transparent" /> {renderPlaza("P15")}
            <div className="bg-transparent" /> {renderPlaza("P14")}
            <div className="bg-transparent" /> <div className="bg-transparent" />
          </div>
        </div>
      </div>

      <Sheet open={!!selectedVehicle} onOpenChange={o => !o && setSelectedVehicle(null)}>
        <SheetContent side="bottom" className="h-[50vh] p-0 rounded-t-3xl border-none shadow-2xl overflow-hidden bg-slate-50">
          <SheetHeader className="sr-only"><SheetTitle>Detalles</SheetTitle></SheetHeader>
          {selectedVehicle && (
            <div className="flex flex-col h-full">
              <div className="bg-secondary p-6 text-white flex justify-between items-end">
                <div className="space-y-2">
                  <Badge className="bg-primary text-white text-[10px] font-black uppercase px-3 py-0.5">{selectedVehicle.estado}</Badge>
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter">{selectedVehicle.modelo}</h2>
                  <p className="text-white/40 font-mono text-[10px] font-bold">VIN: {selectedVehicle.vin}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setMovingVehicleId(selectedVehicle.id); setSelectedVehicle(null); }} className="h-12 w-12 rounded-xl bg-white/5 text-white"><Move className="w-5 h-5" /></Button>
                  <Button variant="ghost" onClick={() => setSelectedVehicle(null)} className="h-12 w-12 rounded-xl bg-white/5 text-white"><X className="w-5 h-5" /></Button>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Estado</Label>
                  <Select value={selectedVehicle.estado} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { estado: v })}>
                    <SelectTrigger className="h-12 bg-white border-none rounded-xl font-black uppercase text-[10px] shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">{ESTADOS.map(e => <SelectItem key={e} value={e}>{e.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Ubicación</Label>
                  <Select value={selectedVehicle.ubicacion} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { ubicacion: v })}>
                    <SelectTrigger className="h-12 bg-white border-none rounded-xl font-black uppercase text-[10px] shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl max-h-[250px]">
                      {PLAZAS_LIST.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      <Separator className="my-1" />
                      {OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="destructive" className="h-12 w-full rounded-xl font-black uppercase text-[10px] shadow-md" onClick={() => { if(confirm("¿Eliminar?")) { deleteDoc(doc(db, "vehiculos", selectedVehicle.id)); setSelectedVehicle(null); } }}>
                    <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={isStockSheetOpen} onOpenChange={setIsStockSheetOpen}>
        <SheetContent side="right" className="w-[350px] p-0 border-none bg-white shadow-2xl">
          <SheetHeader className="sr-only"><SheetTitle>Stock</SheetTitle></SheetHeader>
          <div className="p-6 bg-slate-50 border-b"><h3 className="text-xl font-black uppercase italic text-secondary">STOCK VN</h3></div>
          <div className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-100px)]">
            {pendingStock.map(car => (
              <div key={car.id} onClick={() => { setMovingVehicleId(car.id); setIsStockSheetOpen(false); }} className="p-3 bg-white border border-slate-100 rounded-xl hover:border-primary cursor-pointer transition-all shadow-sm">
                <p className="font-black text-secondary text-[11px] uppercase truncate">{car.modelo}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[7px] font-mono font-bold text-slate-400">{car.vin7 || car.vin?.slice(-7)}</span>
                  <Badge variant="outline" className="text-[7px] uppercase font-black">{car.ubicacion}</Badge>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="p-0 border-none rounded-3xl overflow-hidden max-w-sm shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Nuevo Vehículo</DialogTitle></DialogHeader>
          <div className="p-5 bg-secondary text-white font-black uppercase italic text-center text-sm">NUEVO VEHÍCULO VN</div>
          <div className="p-6 space-y-4 bg-white">
            <Input placeholder="Modelo..." value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} className="h-10 bg-slate-50 border-none rounded-lg font-bold uppercase text-[10px]" />
            <Input placeholder="VIN..." value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} className="h-10 bg-slate-50 border-none rounded-lg font-bold uppercase text-[10px]" />
            <Select value={formData.colorBMW} onValueChange={v => setFormData({...formData, colorBMW: v})}>
              <SelectTrigger className="h-10 bg-slate-50 border-none rounded-lg font-bold text-[10px]"><SelectValue/></SelectTrigger>
              <SelectContent className="rounded-lg">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={formData.bodyType} onValueChange={v => setFormData({...formData, bodyType: v})}>
              <SelectTrigger className="h-10 bg-slate-50 border-none rounded-lg font-bold text-[10px]"><SelectValue/></SelectTrigger>
              <SelectContent className="rounded-lg">{["SUV", "Berlina", "Coupe"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={handleQuickAdd} className="w-full h-12 bg-primary text-white font-black uppercase text-[10px] rounded-xl shadow-lg mt-2">CONFIRMAR</Button>
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
      toast({ title: "Registrado" });
      setIsAddingNew(false);
      setFormData({ modelo: "", vin: "", colorBMW: "300", ubicacion: "Stock", motor: "sDrive20i", bodyType: "SUV", estado: "Stock" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  }
}

export default function ShowroomFinal() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-primary w-10 h-10" /></div>}>
      <ShowroomContent />
    </Suspense>
  );
}
