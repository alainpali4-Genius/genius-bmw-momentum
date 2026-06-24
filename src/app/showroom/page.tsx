
'use client';

import { useState, useMemo, Suspense, useEffect } from "react";
import { 
  Plus, Move, Loader2, X, Trash2, Package, Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, updateDoc, deleteDoc, addDoc, query, orderBy } from "firebase/firestore";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useSearchParams, useRouter } from "next/navigation";

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

const GRID_POSITIONS: Record<string, string> = {
  P1: "col-start-1 row-start-1",
  P2: "col-start-2 row-start-1",
  P3: "col-start-3 row-start-1",
  P4: "col-start-4 row-start-1",
  P5: "col-start-1 row-start-2",
  P6: "col-start-2 row-start-2",
  P7: "col-start-3 row-start-2",
  P8: "col-start-4 row-start-2",
  P9: "col-start-1 row-start-4",
  P10: "col-start-2 row-start-4",
  P11: "col-start-3 row-start-4",
  P12: "col-start-4 row-start-4",
  P13: "col-start-6 row-start-4 row-span-2", 
  P15: "col-start-2 row-start-5", 
  P14: "col-start-4 row-start-5", 
};

function CarSilhouette({ bodyType, color, className, style }: { bodyType: string, color: string, className?: string, style?: React.CSSProperties }) {
  return (
    <svg 
      viewBox="0 0 100 200" 
      preserveAspectRatio="xMidYMid meet"
      className={cn("drop-shadow-lg", className)} 
      style={style} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="glassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1a1a1a" />
          <stop offset="50%" stopColor="#444" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="100" rx="45" ry="95" fill="black" opacity="0.2" />
      <path 
        d={bodyType === 'SUV' 
          ? "M12,18 Q12,5 30,5 L70,5 Q88,5 88,18 L93,60 Q93,85 90,182 Q88,195 75,195 L25,195 Q12,195 10,182 Q7,85 7,60 L12,18 Z"
          : "M15,12 Q15,2 32,2 L68,2 Q85,2 85,12 L92,65 Q92,90 88,190 Q85,200 68,200 L32,200 Q15,200 12,190 Q8,90 8,65 L15,12 Z"
        }
        fill={color} 
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="1"
      />
      <path d="M22,45 Q50,35 78,45 L75,80 Q50,70 25,80 Z" fill="url(#glassGrad)" />
      <path d="M28,150 Q50,160 72,150 L68,180 Q50,188 32,180 Z" fill="url(#glassGrad)" />
    </svg>
  );
}

function ShowroomContent() {
  const { toast } = useToast();
  const db = useFirestore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: vehiculosRaw, loading } = useCollection(query(collection(db, "vehiculos"), orderBy("createdAt", "desc")));
  
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [movingVehicleId, setMovingVehicleId] = useState<string | null>(null);
  const [isStockSheetOpen, setIsStockSheetOpen] = useState(false);

  const [formData, setFormData] = useState({
    modelo: "", vin: "", colorBMW: "300", ubicacion: "Stock", motor: "sDrive20i", bodyType: "SUV", estado: "Stock"
  });

  const vehiculos = useMemo(() => (vehiculosRaw || []) as any[], [vehiculosRaw]);
  const pendingStock = useMemo(() => vehiculos.filter(v => !PLAZAS_LIST.includes(v.ubicacion)), [vehiculos]);
  const selectedVehicle = useMemo(() => vehiculos.find(v => v.id === selectedVehicleId), [vehiculos, selectedVehicleId]);

  useEffect(() => {
    if (searchParams.get('add') === 'true') setIsAddingNew(true);
    const searchStr = searchParams.get('s');
    if (searchStr && vehiculos.length > 0) {
      const found = vehiculos.find(v => v.vin7 === searchStr || v.vin === searchStr);
      if (found) setSelectedVehicleId(found.id);
    }
  }, [searchParams, vehiculos.length]);

  const handleCloseDetail = () => {
    setSelectedVehicleId(null);
    router.replace('/showroom', { scroll: false });
  };

  const handleUpdateVehicle = (vehicleId: string, updates: any) => {
    const docRef = doc(db, "vehiculos", vehicleId);
    const vehicle = vehiculos.find(v => v.id === vehicleId);
    if (!vehicle) return;

    let finalUpdates = { ...updates, updatedAt: new Date().toISOString() };
    
    if (updates.colorCodigo) {
      const newColor = BMW_COLORS.find(c => c.code === updates.colorCodigo);
      if (newColor) {
        finalUpdates.colorExterior = newColor.name;
        finalUpdates.colorBMW = newColor.code;
      }
    }

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
    const isVertical = id === 'P13';
    
    return (
      <div 
        key={id}
        onClick={() => movingVehicleId ? handleSwapOrMove(movingVehicleId, id) : vehicle && setSelectedVehicleId(vehicle.id)}
        className={cn(
          "relative flex flex-col items-center justify-center transition-all h-full w-full overflow-hidden",
          "rounded-sm md:rounded-2xl",
          GRID_POSITIONS[id],
          vehicle ? "bg-white shadow-sm cursor-pointer hover:shadow-md" : "border-slate-100 border-dashed border bg-white/20",
          isMovingTarget && "ring-2 ring-primary bg-primary/5 z-50",
          id === 'P13' && "border-2 md:border-4 border-[#00AEEF]",
          id === 'P15' && "border-2 md:border-4 border-[#ED1C24]"
        )}
      >
        <div className="absolute top-0.5 left-0.5 md:top-1.5 md:left-1.5 z-30">
          <span className="text-[4px] md:text-[9px] font-black uppercase text-slate-300 tracking-tighter">{id}</span>
        </div>
        {vehicle ? (
          <div className="w-full h-full flex items-center justify-center p-0.5 md:p-1 relative overflow-hidden">
            <div className={cn(
              "relative flex items-center justify-center w-[90%] h-[90%] transition-transform duration-300",
              !isVertical && "rotate-90"
            )}>
              <CarSilhouette 
                bodyType={vehicle.bodyType || 'SUV'} 
                color={colorObj?.hex || '#CBD5E1'} 
                className="w-full h-full"
              />
              <div className={cn(
                "absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center",
                !isVertical && "-rotate-90" 
              )}>
                 <p className="text-[2.5px] md:text-[10px] font-black uppercase text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] leading-tight mb-0.5 line-clamp-1 max-w-[85%]">
                   {vehicle.modelo}
                 </p>
                 <span className="text-[3px] md:text-[12px] font-mono font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{vehicle.vin7}</span>
                 <Badge className="bg-black/50 text-white text-[2px] md:text-[8px] font-black border-none px-0.5 md:px-1.5 h-auto mt-0.5 md:mt-1">
                   {colorObj?.code || '---'}
                 </Badge>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f4f7fa] overflow-hidden">
      {/* Header Compacto */}
      <div className="bg-white border-b px-3 md:px-8 py-2 md:py-4 flex items-center justify-between shrink-0 shadow-sm z-40">
        <div className="flex flex-col">
          <h1 className="text-xs md:text-2xl font-black text-secondary uppercase italic leading-none tracking-tighter">PLANO <span className="text-primary not-italic">EXPOSICIÓN</span></h1>
          <p className="text-[6px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">MOMENTUM NAVARRA</p>
        </div>
        <div className="flex gap-1">
          {movingVehicleId && (
            <Button onClick={() => setMovingVehicleId(null)} className="h-7 md:h-10 bg-primary animate-pulse text-white rounded-lg md:rounded-xl font-black uppercase text-[6px] md:text-[10px] px-2 md:px-6">
              MOVER
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsStockSheetOpen(true)} className="h-7 md:h-10 rounded-lg md:rounded-xl font-black uppercase text-[6px] md:text-[10px] px-2 md:px-6 border-slate-200">
            STOCK ({pendingStock.length})
          </Button>
          <Button onClick={() => setIsAddingNew(true)} className="h-7 md:h-10 bg-secondary hover:bg-slate-800 text-white rounded-lg md:rounded-xl font-black uppercase text-[6px] md:text-[10px] px-2 md:px-6 shadow-sm">
            NUEVO
          </Button>
        </div>
      </div>

      {/* Grid Líquido: Vista de Pájaro en una sola pantalla */}
      <div className="flex-1 p-2 md:p-6 overflow-hidden flex items-center justify-center h-full w-full">
        <div className="w-full h-full max-w-[1400px] grid grid-cols-6 grid-rows-5 gap-1 md:gap-4 overflow-hidden">
          {PLAZAS_LIST.map(id => renderPlaza(id))}
        </div>
      </div>

      <Sheet open={!!selectedVehicleId} onOpenChange={o => !o && handleCloseDetail()}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh] p-0 rounded-t-[2rem] border-none shadow-2xl overflow-hidden bg-white">
          <SheetHeader className="px-6 md:px-8 pt-4 md:pt-6 pb-2 flex flex-row justify-between items-center">
            <SheetTitle className="text-[8px] md:text-xs font-black uppercase tracking-widest text-slate-400">DETALLE DEL VEHÍCULO</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-slate-100" onClick={handleCloseDetail}>
                <X className="w-4 h-4 text-slate-400" />
              </Button>
            </SheetClose>
          </SheetHeader>
          {selectedVehicle && (
            <div className="flex flex-col">
              <div className="bg-secondary p-5 text-white flex justify-between items-center shrink-0">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary text-white text-[10px] font-black uppercase px-3 py-0.5 border-none">{selectedVehicle.estado}</Badge>
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">VN • MOMENTUM</span>
                  </div>
                  <h2 className="text-base md:text-xl font-black uppercase italic tracking-tighter leading-none">{selectedVehicle.modelo}</h2>
                  <p className="text-white/40 font-mono text-[8px] md:text-[9px] font-bold tracking-widest">VIN: {selectedVehicle.vin}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setMovingVehicleId(selectedVehicle.id); handleCloseDetail(); }} className="h-10 w-10 rounded-xl bg-white/5 text-white hover:bg-white/10">
                    <Move className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] px-1">ESTADO</Label>
                  <Select value={selectedVehicle.estado} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { estado: v })}>
                    <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-black uppercase text-[10px] shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">{ESTADOS.map(e => <SelectItem key={e} value={e} className="text-[10px] font-bold">{e.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] px-1">UBICACIÓN</Label>
                  <Select value={selectedVehicle.ubicacion} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { ubicacion: v })}>
                    <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-black uppercase text-[10px] shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl max-h-[300px]">
                      {PLAZAS_LIST.map(p => <SelectItem key={p} value={p} className="text-[10px] font-bold">{p}</SelectItem>)}
                      <Separator className="my-2" />
                      {OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p} className="text-[10px] font-bold">{p.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] px-1">COLOR BMW</Label>
                  <Select value={selectedVehicle.colorCodigo || selectedVehicle.colorBMW} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { colorCodigo: v })}>
                    <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-black uppercase text-[10px] shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl max-h-[300px]">
                      {BMW_COLORS.map(c => (
                        <SelectItem key={c.code} value={c.code} className="text-[10px] font-bold">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: c.hex }} />
                            {c.name.toUpperCase()}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="destructive" className="h-10 w-full rounded-xl font-black uppercase text-[10px] shadow-lg border-none hover:bg-red-700 transition-all active:scale-95" onClick={() => { if(confirm("¿Eliminar?")) { deleteDoc(doc(db, "vehiculos", selectedVehicle.id)); handleCloseDetail(); } }}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> ELIMINAR
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={isStockSheetOpen} onOpenChange={setIsStockSheetOpen}>
        <SheetContent side="right" className="w-full md:w-[400px] p-0 border-none bg-white shadow-2xl">
          <SheetHeader className="p-8 bg-slate-50 border-b">
            <SheetTitle className="text-2xl font-black uppercase italic text-secondary">STOCK PENDIENTE</SheetTitle>
          </SheetHeader>
          <div className="p-6 space-y-3 overflow-y-auto h-[calc(100vh-120px)] scrollbar-none">
            {pendingStock.length === 0 ? (
              <div className="text-center py-20 text-slate-300 font-black uppercase text-xs">Sin stock</div>
            ) : pendingStock.map(car => (
              <div key={car.id} onClick={() => { setMovingVehicleId(car.id); setIsStockSheetOpen(false); }} className="p-5 bg-white border border-slate-100 rounded-2xl hover:border-primary hover:shadow-md cursor-pointer transition-all">
                <p className="font-black text-secondary text-sm uppercase truncate leading-none mb-2">{car.modelo}</p>
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-primary">{BMW_COLORS.find(c => c.code === (car.colorCodigo || car.colorBMW))?.name}</span>
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
        <DialogContent className="p-0 border-none rounded-[2.5rem] overflow-hidden max-w-[90vw] md:max-w-md shadow-2xl">
          <DialogHeader className="p-6 bg-secondary text-white font-black uppercase italic text-center">
            <DialogTitle>ALTA DE VEHÍCULO VN</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-5 bg-white">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Modelo</Label>
              <Input placeholder="EJ: BMW X5..." value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">VIN</Label>
              <Input placeholder="WBA..." value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Color</Label>
                <Select value={formData.colorBMW} onValueChange={v => setFormData({...formData, colorBMW: v})}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold text-[10px] uppercase shadow-sm"><SelectValue/></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code} className="text-[10px]">{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Body</Label>
                <Select value={formData.bodyType} onValueChange={v => setFormData({...formData, bodyType: v})}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold text-[10px] uppercase shadow-sm"><SelectValue/></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">{["SUV", "Berlina", "Coupe"].map(t => <SelectItem key={t} value={t} className="text-[10px]">{t}</SelectItem>)}</SelectContent>
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
      toast({ title: "Vehículo Registrado" });
      setIsAddingNew(false);
      setFormData({ modelo: "", vin: "", colorBMW: "300", ubicacion: "Stock", motor: "sDrive20i", bodyType: "SUV", estado: "Stock" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
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
