'use client';

import { useState, useMemo, Suspense, useEffect } from "react";
import { 
  Plus, Move, Loader2, X, Trash2, Package, Palette, Building2
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

export const TIPOS_LOGISTICOS = [
  "Stock Expo",
  "Entrega Renting",
  "Entrega Cliente",
  "Demo",
  "Devolucion Renting"
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
      className={cn("drop-shadow-xl", className)} 
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
      <ellipse cx="50" cy="100" rx="45" ry="95" fill="black" opacity="0.3" />
      <path 
        d={bodyType === 'SUV' 
          ? "M12,18 Q12,5 30,5 L70,5 Q88,5 88,18 L93,60 Q93,85 90,182 Q88,195 75,195 L25,195 Q12,195 10,182 Q7,85 7,60 L12,18 Z"
          : "M15,12 Q15,2 32,2 L68,2 Q85,2 85,12 L92,65 Q92,90 88,190 Q85,200 68,200 L32,200 Q15,200 12,190 Q8,90 8,65 L15,12 Z"
        }
        fill={color} 
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="1.5"
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
    modelo: "", vin: "", colorBMW: "300", ubicacion: "Stock", motor: "sDrive20i", bodyType: "SUV", estado: "Stock", tipoLogistico: "Stock Expo", entidadRenting: ""
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
    const params = new URLSearchParams(searchParams.toString());
    params.delete('s');
    params.delete('add');
    router.replace(`/showroom${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  };

  const handleUpdateVehicle = async (vehicleId: string, updates: any) => {
    const docRef = doc(db, "vehiculos", vehicleId);
    let finalUpdates = { ...updates, updatedAt: new Date().toISOString() };
    
    if (updates.colorCodigo) {
      const newColor = BMW_COLORS.find(c => c.code === updates.colorCodigo);
      if (newColor) {
        finalUpdates.colorExterior = newColor.name;
        finalUpdates.colorBMW = newColor.code;
      }
    }

    try {
      await updateDoc(docRef, finalUpdates);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    }
  };

  const handleSwapOrMove = async (sourceId: string, targetPlaza: string) => {
    const sourceCar = vehiculos.find(v => v.id === sourceId);
    const targetCar = vehiculos.find(v => v.ubicacion === targetPlaza);

    if (targetCar && targetCar.id !== sourceId) {
      const oldLocation = PLAZAS_LIST.includes(sourceCar?.ubicacion) ? sourceCar.ubicacion : 'Stock';
      await handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      await handleUpdateVehicle(targetCar.id, { ubicacion: oldLocation });
      toast({ title: "Intercambio Realizado" });
    } else {
      await handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
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
          "relative flex flex-col items-center justify-center transition-all h-full w-full",
          "rounded-md overflow-hidden",
          GRID_POSITIONS[id],
          vehicle ? "bg-white shadow-sm cursor-pointer hover:shadow-md" : "border-slate-100 border-dashed border-2 bg-white/20",
          isMovingTarget && "ring-2 ring-primary bg-primary/5 z-50",
          id === 'P13' ? "border-2 border-[#00AEEF]" : 
          id === 'P15' ? "border-2 border-[#ED1C24]" : ""
        )}
      >
        <div className="absolute top-0.5 left-0.5 z-30">
          <span className="text-[5px] md:text-[9px] font-black uppercase text-slate-300">{id}</span>
        </div>
        {vehicle && (
          <div className="w-full h-full flex items-center justify-center p-0.5 md:p-1 relative overflow-hidden">
            <div className={cn(
              "relative flex items-center justify-center transition-all duration-300 w-full h-full",
              !isVertical && "rotate-90"
            )}>
              <CarSilhouette 
                bodyType={vehicle.bodyType || 'SUV'} 
                color={colorObj?.hex || '#CBD5E1'} 
                className={cn("h-[95%] w-auto", !isVertical && "max-w-[120%]")}
              />
              <div className={cn(
                "absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-0.5",
                !isVertical && "-rotate-90" 
              )}>
                 <p className="text-[3px] md:text-[8px] font-black uppercase text-white drop-shadow-md truncate w-[85%]">
                   {vehicle.modelo}
                 </p>
                 <span className="text-[4px] md:text-[10px] font-mono font-black text-white drop-shadow-md">{vehicle.vin7}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#f4f7fa] overflow-hidden">
      <div className="bg-white border-b px-3 py-1.5 md:py-2 flex items-center justify-between shrink-0 shadow-sm z-40">
        <h1 className="text-[10px] md:text-xl font-black text-secondary uppercase italic leading-none tracking-tighter">PLANO <span className="text-primary not-italic">EXPO</span></h1>
        <div className="flex gap-1">
          {movingVehicleId && <Button onClick={() => setMovingVehicleId(null)} className="h-6 md:h-7 bg-red-600 text-white rounded-md font-black uppercase text-[6px] md:text-[7px] px-2">CANCELAR</Button>}
          <Button variant="outline" onClick={() => setIsStockSheetOpen(true)} className="h-6 md:h-7 rounded-md font-black uppercase text-[6px] md:text-[7px] px-2 border-slate-200">STOCK ({pendingStock.length})</Button>
          <Button onClick={() => setIsAddingNew(true)} className="h-6 md:h-7 bg-secondary text-white rounded-md font-black uppercase text-[6px] md:text-[7px] px-2">NUEVO</Button>
        </div>
      </div>

      <div className="flex-1 p-1 md:p-4 overflow-hidden flex items-center justify-center w-full h-full">
        <div className="w-full h-full max-w-[1600px] grid grid-cols-6 grid-rows-5 gap-0.5 md:gap-3">
          {PLAZAS_LIST.map(id => renderPlaza(id))}
        </div>
      </div>

      <Sheet open={!!selectedVehicleId} onOpenChange={o => !o && handleCloseDetail()}>
        <SheetContent side="bottom" className="h-auto p-0 rounded-t-3xl border-none shadow-2xl overflow-hidden bg-white max-h-[90vh] overflow-y-auto">
          {selectedVehicle && (
            <div className="flex flex-col">
              <div className="bg-secondary p-4 text-white flex justify-between items-center shrink-0">
                <div className="space-y-0.5">
                  <Badge className="bg-primary text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md">{selectedVehicle.estado}</Badge>
                  <h2 className="text-base font-black uppercase italic tracking-tighter mt-1">{selectedVehicle.modelo}</h2>
                  <p className="text-white/40 font-mono text-[9px] font-bold">VIN7: {selectedVehicle.vin7}</p>
                </div>
                <Button variant="ghost" onClick={() => { setMovingVehicleId(selectedVehicle.id); handleCloseDetail(); }} className="h-10 w-10 bg-white/5 text-white"><Move className="w-5 h-5" /></Button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 pb-24 md:pb-6">
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-slate-400 px-1">ESTADO</Label>
                  <Select value={selectedVehicle.estado} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { estado: v })}>
                    <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl text-[10px] font-black uppercase"><SelectValue/></SelectTrigger>
                    <SelectContent>{ESTADOS.map(e => <SelectItem key={e} value={e} className="text-[10px] uppercase font-bold">{e}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-slate-400 px-1">TIPO LOGÍSTICO</Label>
                  <Select value={selectedVehicle.tipoLogistico || "Stock Expo"} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { tipoLogistico: v })}>
                    <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl text-[10px] font-black uppercase"><SelectValue/></SelectTrigger>
                    <SelectContent>{TIPOS_LOGISTICOS.map(t => <SelectItem key={t} value={t} className="text-[10px] font-bold uppercase">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {(selectedVehicle.tipoLogistico?.includes('Renting') || selectedVehicle.tipoLogistico === 'Entrega Renting' || selectedVehicle.tipoLogistico === 'Devolucion Renting') && (
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[8px] font-black uppercase text-slate-400 px-1">EMPRESA RENTING</Label>
                    <Input 
                      placeholder="NOMBRE DE LA EMPRESA..." 
                      value={selectedVehicle.entidadRenting || ""} 
                      onChange={e => handleUpdateVehicle(selectedVehicle.id, { entidadRenting: e.target.value })} 
                      className="h-10 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-slate-400 px-1">UBICACIÓN</Label>
                  <Select value={selectedVehicle.ubicacion} onValueChange={v => handleUpdateVehicle(selectedVehicle.id, { ubicacion: v })}>
                    <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl text-[10px] font-black uppercase"><SelectValue/></SelectTrigger>
                    <SelectContent className="max-h-[250px]">{PLAZAS_LIST.map(p => <SelectItem key={p} value={p} className="text-[10px] font-bold">{p}</SelectItem>)}<Separator className="my-1"/>{OTHER_LOCATIONS.map(p => <SelectItem key={p} value={p} className="text-[10px] font-bold">{p.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button variant="destructive" className="col-span-2 h-10 font-black uppercase text-[10px] rounded-xl" onClick={() => { if(confirm("¿Eliminar?")) { deleteDoc(doc(db, "vehiculos", selectedVehicle.id)); handleCloseDetail(); } }}><Trash2 className="w-3.5 h-3.5 mr-2" /> ELIMINAR STOCK</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={isStockSheetOpen} onOpenChange={setIsStockSheetOpen}>
        <SheetContent side="right" className="w-full md:w-[400px] p-0 border-none bg-white shadow-2xl">
          <SheetHeader className="p-6 bg-slate-50 border-b"><SheetTitle className="text-lg font-black uppercase italic text-secondary">STOCK DISPONIBLE</SheetTitle></SheetHeader>
          <div className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-100px)] scrollbar-none pb-20">
            {pendingStock.map(car => (
              <div key={car.id} onClick={() => { setMovingVehicleId(car.id); setIsStockSheetOpen(false); }} className="p-4 bg-white border border-slate-100 rounded-xl hover:border-primary cursor-pointer active:scale-[0.98]">
                <p className="font-black text-secondary text-[11px] uppercase truncate leading-none mb-2">{car.modelo}</p>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center"><span className="text-[9px] font-mono font-bold text-slate-400">{car.vin7}</span><Badge variant="outline" className="text-[8px] uppercase font-black px-2 py-0.5 bg-slate-50 border-none">{car.ubicacion}</Badge></div>
                  {car.tipoLogistico && (
                    <Badge className="w-fit text-[7px] font-black uppercase bg-slate-100 text-slate-500 border-none mt-1">
                      {car.tipoLogistico} {car.entidadRenting ? `| ${car.entidadRenting}` : ''}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="p-0 border-none rounded-3xl overflow-hidden max-w-[90vw] md:max-w-md shadow-2xl">
          <div className="p-6 bg-secondary text-white font-black uppercase italic text-center text-sm">ALTA DE VEHÍCULO VN</div>
          <div className="p-6 space-y-4 bg-white max-h-[80vh] overflow-y-auto">
            <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400">Modelo</Label><Input placeholder="EJ: BMW X5..." value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} className="h-10 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]" /></div>
            <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400">Bastidor (VIN)</Label><Input placeholder="WBA..." value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} className="h-10 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400">Color</Label><Select value={formData.colorBMW} onValueChange={v => setFormData({...formData, colorBMW: v})}><SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-bold text-[9px] px-3"><SelectValue/></SelectTrigger><SelectContent className="max-h-[250px]">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code} className="text-[9px]">{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400">Carrocería</Label><Select value={formData.bodyType} onValueChange={v => setFormData({...formData, bodyType: v})}><SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-bold text-[9px] px-3"><SelectValue/></SelectTrigger><SelectContent>{["SUV", "Berlina", "Coupe", "Roadster"].map(t => <SelectItem key={t} value={t} className="text-[9px]">{t}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400">Tipo Logístico</Label><Select value={formData.tipoLogistico} onValueChange={v => setFormData({...formData, tipoLogistico: v})}><SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-bold text-[9px] px-3"><SelectValue/></SelectTrigger><SelectContent>{TIPOS_LOGISTICOS.map(t => <SelectItem key={t} value={t} className="text-[9px] uppercase font-bold">{t}</SelectItem>)}</SelectContent></Select></div>
            
            {(formData.tipoLogistico.includes('Renting')) && (
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400">Empresa Renting</Label><Input placeholder="NOMBRE DE LA EMPRESA..." value={formData.entidadRenting} onChange={e => setFormData({...formData, entidadRenting: e.target.value})} className="h-10 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]" /></div>
            )}

            <Button onClick={handleQuickAdd} className="w-full h-12 bg-primary text-white font-black uppercase text-[10px] rounded-xl mt-2">REGISTRAR EN INVENTARIO</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  async function handleQuickAdd() {
    if (!formData.modelo || !formData.vin) return toast({ variant: "destructive", title: "Faltan datos" });
    const vin7 = formData.vin.slice(-7).toUpperCase();
    const payload = { ...formData, vin: formData.vin.toUpperCase(), vin7, colorCodigo: formData.colorBMW, colorExterior: BMW_COLORS.find(c => c.code === formData.colorBMW)?.name || "Alpine White", fechaEntrada: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    try {
      await addDoc(collection(db, "vehiculos"), payload);
      toast({ title: "Vehículo Registrado" });
      setIsAddingNew(false);
      setFormData({ modelo: "", vin: "", colorBMW: "300", ubicacion: "Stock", motor: "sDrive20i", bodyType: "SUV", estado: "Stock", tipoLogistico: "Stock Expo", entidadRenting: "" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
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