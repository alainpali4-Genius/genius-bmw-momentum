
'use client';

import { useState, useMemo, Suspense, useEffect } from "react";
import { 
  Plus, Move, Loader2, X, Trash2, Package
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
    <svg viewBox="0 0 100 220" className={cn("w-full h-full drop-shadow-2xl", className)} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="glassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1a1a1a" />
          <stop offset="50%" stopColor="#333" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
      </defs>
      {/* Sombra proyectada */}
      <ellipse cx="50" cy="110" rx="46" ry="105" fill="black" opacity="0.15" />
      
      {/* Cuerpo del vehículo con mayor detalle */}
      <path 
        d={bodyType === 'SUV' 
          ? "M15,12 Q15,2 30,2 L70,2 Q85,2 85,12 L92,55 Q92,75 88,195 Q85,218 70,218 L30,218 Q15,218 12,195 Q8,75 8,55 L15,12 Z"
          : bodyType === 'Coupe'
          ? "M22,8 Q22,0 35,0 L65,0 Q78,0 78,8 L88,65 Q88,85 82,195 Q78,218 65,218 L35,218 Q22,218 18,195 Q12,85 12,65 L22,8 Z"
          : "M18,10 Q18,2 32,2 L68,2 Q82,2 82,10 L88,60 Q88,80 84,200 Q80,218 68,218 L32,218 Q20,218 16,200 Q12,80 12,60 L18,10 Z"
        }
        fill={color} 
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="1.5"
      />
      
      {/* Lunas y Techo */}
      <path d="M24,55 Q50,45 76,55 L72,95 Q50,85 28,95 Z" fill="url(#glassGrad)" />
      <path d="M28,100 L72,100 Q72,130 68,170 L32,170 Q28,130 28,100 Z" fill="rgba(0,0,0,0.1)" />
      <path d="M32,175 Q50,185 68,175 L65,205 Q50,212 35,205 Z" fill="url(#glassGrad)" />
      
      {/* Retrovisores */}
      <path d="M12,70 L2,78 Q0,82 2,88 L12,84 Z" fill={color} filter="brightness(0.8)" />
      <path d="M88,70 L98,78 Q100,82 98,88 L88,84 Z" fill={color} filter="brightness(0.8)" />
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
          "relative flex flex-col items-center justify-center transition-all h-full w-full rounded-2xl border overflow-hidden",
          vehicle ? "border-transparent bg-white shadow-sm cursor-pointer hover:shadow-md" : "border-slate-100 border-dashed bg-white/30",
          isMovingTarget && "border-primary bg-primary/5 ring-4 ring-primary/20 z-50 scale-[1.02]"
        )}
      >
        <div className="absolute top-2 left-3 z-30">
          <span className="text-[10px] font-black uppercase text-slate-300 tracking-tighter">{id}</span>
        </div>
        {vehicle ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-1 relative overflow-visible">
            <div className="w-[110%] h-[110%] rotate-90 flex items-center justify-center relative">
              <CarSilhouette bodyType={vehicle.bodyType || 'SUV'} color={colorObj?.hex || '#CBD5E1'} />
              {/* Información dentro del coche con máxima legibilidad */}
              <div className="absolute inset-0 flex flex-col items-center justify-center -rotate-90 pointer-events-none px-4 text-center">
                 <p className="text-[10px] font-black uppercase text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] leading-none mb-1 line-clamp-2 max-w-[80px]">
                   {vehicle.modelo}
                 </p>
                 <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-mono font-bold text-white drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)]">{vehicle.vin7}</span>
                    <Badge className="bg-black/40 text-white text-[8px] font-black border-none px-2 h-4 backdrop-blur-sm">
                      {colorObj?.code || '---'}
                    </Badge>
                 </div>
              </div>
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
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">MOMENTUM NAVARRA</p>
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
        {/* Grid de 6 columnas y 5 filas para respetar pasillos y alineación P14/P15 */}
        <div className="w-full h-full max-[1600px] grid grid-cols-6 grid-rows-5 gap-3">
          {/* Fila 1 */}
          {renderPlaza("P1")} {renderPlaza("P2")} {renderPlaza("P3")} {renderPlaza("P4")}
          <div className="bg-transparent" /> <div className="bg-transparent" />

          {/* Fila 2 */}
          {renderPlaza("P5")} {renderPlaza("P6")} {renderPlaza("P7")} {renderPlaza("P8")}
          <div className="bg-transparent" /> <div className="bg-transparent" />

          {/* Fila 3: Pasillo / Genius */}
          <div className="bg-transparent" /> <div className="bg-transparent" />
          <div className="bg-transparent" /> <div className="bg-transparent" />
          <div className="bg-transparent" /> <div className="bg-transparent" />

          {/* Fila 4: Bloque P9-P12 + Pasillo + P13 */}
          {renderPlaza("P9")} {renderPlaza("P10")} {renderPlaza("P11")} {renderPlaza("P12")}
          <div className="bg-transparent" /> {renderPlaza("P13")}

          {/* Fila 5: P15 y P14 paralelos a P10 y P12 */}
          <div className="bg-transparent" /> {renderPlaza("P15")}
          <div className="bg-transparent" /> {renderPlaza("P14")}
          <div className="bg-transparent" /> <div className="bg-transparent" />
        </div>
      </div>

      <Sheet open={!!selectedVehicle} onOpenChange={o => !o && setSelectedVehicle(null)}>
        <SheetContent side="bottom" className="h-[45vh] p-0 rounded-t-[3rem] border-none shadow-2xl overflow-hidden bg-white">
          <SheetHeader className="px-8 pt-8">
            <SheetTitle className="text-xl font-black uppercase italic text-secondary">DETALLE VEHÍCULO</SheetTitle>
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
          <SheetHeader className="p-8 bg-slate-50 border-b">
            <SheetTitle className="text-2xl font-black uppercase italic text-secondary">STOCK PENDIENTE</SheetTitle>
          </SheetHeader>
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
          <DialogHeader className="p-6 bg-secondary text-white font-black uppercase italic text-center">
            <DialogTitle className="text-lg">ALTA DE VEHÍCULO VN</DialogTitle>
          </DialogHeader>
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
