'use client';

import { useState, useMemo, Suspense, useEffect } from "react";
import { 
  Plus, Move, Loader2, X, Trash2, Package, Palette, Building2, User
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
  P13: "col-start-6 row-start-4", 
  P14: "col-start-4 row-start-5", 
  P15: "col-start-2 row-start-5", 
};

function CarSilhouette({ bodyType, color, className, style }: { bodyType: string, color: string, className?: string, style?: React.CSSProperties }) {
  return (
    <svg 
      viewBox="0 0 100 200" 
      preserveAspectRatio="xMidYMid meet"
      className={cn("drop-shadow-xl transition-all duration-300", className)} 
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
      <ellipse cx="50" cy="100" rx="48" ry="98" fill="black" opacity="0.25" />
      <path 
        d={bodyType === 'SUV' 
          ? "M8,12 Q8,2 25,2 L75,2 Q92,2 92,12 L96,60 Q96,85 94,185 Q92,198 75,198 L25,198 Q8,198 6,185 Q4,85 4,60 L8,12 Z"
          : "M10,8 Q10,2 28,2 L72,2 Q90,2 90,8 L95,65 Q95,90 92,192 Q90,200 70,200 L30,200 Q10,200 8,192 Q5,90 5,65 L10,8 Z"
        }
        fill={color} 
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="1"
      />
      <path d="M18,40 Q50,30 82,40 L78,75 Q50,65 22,75 Z" fill="url(#glassGrad)" />
      <path d="M25,145 Q50,155 75,145 L72,175 Q50,183 28,175 Z" fill="url(#glassGrad)" />
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
  const [draggedPlaza, setDraggedPlaza] = useState<string | null>(null);
  const [isStockSheetOpen, setIsStockSheetOpen] = useState(false);

  const [formData, setFormData] = useState({
    marca: "BMW", modelo: "", vin: "", matricula: "", kilometraje: "", motor: "sDrive20i",
    colorBMW: "300", tapiceria: "", llantas: "", equipamiento: "", bodyType: "SUV",
    ubicacion: "Stock", estado: "Stock", tipoLogistico: "Stock Expo", entidadRenting: "",
    precio: "", responsable: "", observaciones: ""
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
    const current = vehiculos.find(v => v.id === vehicleId);
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
      // Registrar en movimientos los cambios logísticos relevantes, sin generar
      // entradas por cada letra escrita en los campos de texto.
      const changedLocation = Object.prototype.hasOwnProperty.call(updates, "ubicacion") && updates.ubicacion !== current?.ubicacion;
      const changedStatus = Object.prototype.hasOwnProperty.call(updates, "estado") && updates.estado !== current?.estado;
      const changedType = Object.prototype.hasOwnProperty.call(updates, "tipoLogistico") && updates.tipoLogistico !== current?.tipoLogistico;
      if (current && (changedLocation || changedStatus || changedType)) {
        const details = [
          changedLocation ? `Ubicación: ${current.ubicacion || "Sin ubicación"} → ${updates.ubicacion}` : "",
          changedStatus ? `Estado: ${current.estado || "Sin estado"} → ${updates.estado}` : "",
          changedType ? `Tipo: ${current.tipoLogistico || "Sin tipo"} → ${updates.tipoLogistico}` : ""
        ].filter(Boolean).join(" · ");
        try {
          await addDoc(collection(db, "movimientos"), {
            vehiculoId: vehicleId,
            vehiculoInfo: `${current.modelo || "Vehículo"} (${current.vin7 || "Sin VIN7"})`,
            tipoAccion: "Actualización logística",
            fecha: new Date().toISOString(),
            origen: current.ubicacion || "N/A",
            destino: updates.ubicacion || current.ubicacion || "N/A",
            usuario: "GENIUS",
            detalles: details
          });
        } catch (historyError) {
          console.error("No se pudo registrar el historial logístico", historyError);
          toast({ variant: "destructive", title: "Datos guardados; historial pendiente", description: "El cambio se ha guardado, pero no se pudo registrar en movimientos." });
        }
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar", description: "No se han podido guardar los cambios." });
    }
  };

  const handleSwapOrMove = async (sourceId: string, targetPlaza: string) => {
    const sourceCar = vehiculos.find(v => v.id === sourceId);
    if (!sourceCar) return;
    
    const targetCar = vehiculos.find(v => v.ubicacion === targetPlaza);
    
    if (targetCar && targetCar.id !== sourceId) {
      const oldLocation = PLAZAS_LIST.includes(sourceCar.ubicacion) ? sourceCar.ubicacion : 'Stock';
      await handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      await handleUpdateVehicle(targetCar.id, { ubicacion: oldLocation });
      toast({ title: "Intercambio Realizado", description: `${sourceCar.modelo} ↔ ${targetCar.modelo}` });
    } else {
      await handleUpdateVehicle(sourceId, { ubicacion: targetPlaza, estado: 'Exposicion' });
      toast({ title: "Vehículo Ubicado", description: `${sourceCar.modelo} en ${targetPlaza}` });
    }
    setMovingVehicleId(null);
  };

  const handleDragStart = (e: React.DragEvent, vehicleId: string) => {
    setMovingVehicleId(vehicleId);
    e.dataTransfer.setData("vehicleId", vehicleId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, plazaId: string) => {
    e.preventDefault();
    setDraggedPlaza(plazaId);
  };

  const handleDrop = (e: React.DragEvent, plazaId: string) => {
    e.preventDefault();
    setDraggedPlaza(null);
    const vehicleId = e.dataTransfer.getData("vehicleId") || movingVehicleId;
    if (vehicleId) {
      handleSwapOrMove(vehicleId, plazaId);
    }
  };

  const renderPlaza = (id: string) => {
    const vehicle = vehiculos.find(v => v.ubicacion === id);
    const isMovingTarget = (!!movingVehicleId && movingVehicleId !== vehicle?.id) || (draggedPlaza === id);
    const colorObj = BMW_COLORS.find(c => c.code === (vehicle?.colorCodigo || vehicle?.colorBMW));
    
    // Lógica de color de texto: negro en blanco, blanco en el resto
    const isWhiteCar = colorObj?.code === '300' || colorObj?.code === 'A96';
    const textColor = isWhiteCar ? "text-black" : "text-white";
    const textShadow = isWhiteCar ? "drop-shadow-none" : "drop-shadow-md";

    const carRotation = id === 'P13' ? "rotate-0" : "rotate-90";
    const textRotation = id === 'P13' ? "rotate-0" : "-rotate-90";

    return (
      <div 
        key={id}
        onDragOver={(e) => handleDragOver(e, id)}
        onDragLeave={() => setDraggedPlaza(null)}
        onDrop={(e) => handleDrop(e, id)}
        onClick={() => movingVehicleId ? handleSwapOrMove(movingVehicleId, id) : vehicle && setSelectedVehicleId(vehicle.id)}
        className={cn(
          "relative flex flex-col items-center justify-center transition-all h-full w-full",
          "rounded-sm overflow-hidden",
          GRID_POSITIONS[id],
          vehicle ? "bg-white shadow-sm cursor-pointer hover:shadow-md" : "border-slate-100 border-dashed border-2 bg-white/20",
          isMovingTarget && "ring-4 ring-primary bg-primary/10 z-50 scale-[1.02]"
        )}
      >
        <div className="absolute top-0 left-0 z-30 p-0.5">
          <span className="text-[7px] md:text-[9px] font-black uppercase text-slate-300 leading-none">{id}</span>
        </div>
        {vehicle && (
          <div 
            draggable="true"
            onDragStart={(e) => handleDragStart(e, vehicle.id)}
            className="w-full h-full flex items-center justify-center p-0.5 relative overflow-hidden"
          >
            <div className={cn(
              "relative flex items-center justify-center transition-all duration-300 w-full h-full",
              carRotation
            )}>
              <CarSilhouette 
                bodyType={vehicle.bodyType || 'SUV'} 
                color={colorObj?.hex || '#CBD5E1'} 
                className="h-[98%] w-auto max-w-[125%]"
              />
              <div className={cn(
                "absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-1",
                textRotation
              )}>
                 <p className={cn("text-[6px] md:text-[11px] font-black uppercase truncate w-[95%] tracking-tighter leading-none mb-0.5", textColor, textShadow)}>
                   {vehicle.modelo}
                 </p>
                 <span className={cn("text-[7px] md:text-[14px] font-mono font-black tracking-tight", textColor, textShadow)}>{vehicle.vin7}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#f4f7fa] overflow-hidden">
      {/* Cabecera optimizada */}
      <div className="bg-white border-b px-3 py-1.5 md:py-2 flex items-center justify-between shrink-0 shadow-sm z-40">
        <h1 className="text-[11px] md:text-xl font-black text-secondary uppercase italic leading-none tracking-tighter">PLANO <span className="text-primary not-italic">EXPO</span></h1>
        <div className="flex gap-1">
          {movingVehicleId && <Button onClick={() => setMovingVehicleId(null)} className="h-6 md:h-7 bg-red-600 text-white rounded-md font-black uppercase text-[7px] md:text-[8px] px-2">CANCELAR</Button>}
          <Button variant="outline" onClick={() => setIsStockSheetOpen(true)} className="h-6 md:h-7 rounded-md font-black uppercase text-[7px] md:text-[8px] px-2 border-slate-200">STOCK ({pendingStock.length})</Button>
          <Button onClick={() => setIsAddingNew(true)} className="h-6 md:h-7 bg-secondary text-white rounded-md font-black uppercase text-[7px] md:text-[8px] px-2">NUEVO</Button>
        </div>
      </div>

      {/* Grid de exposición: Vista de pájaro real optimizada para móvil vertical */}
      <div className="flex-1 relative overflow-hidden bg-slate-50/30">
        <div className="absolute inset-0 p-1 md:p-4">
          <div className="w-full h-full grid grid-cols-6 grid-rows-5 gap-1">
            {PLAZAS_LIST.map(id => renderPlaza(id))}
          </div>
        </div>
      </div>

      {/* Diálogos y Sheets */}
      <Sheet open={!!selectedVehicleId} onOpenChange={o => !o && handleCloseDetail()}>
        <SheetContent side="bottom" className="h-[94vh] p-0 rounded-t-3xl border-none shadow-2xl overflow-hidden bg-slate-50">
          {selectedVehicle && (
            <div className="flex flex-col h-full">
              <div className="bg-secondary px-5 py-4 text-white flex justify-between items-center shrink-0">
                <div className="min-w-0">
                  <Badge className="bg-primary text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md">{selectedVehicle.estado || "Stock"}</Badge>
                  <h2 className="text-lg md:text-xl font-black uppercase italic tracking-tight mt-1 truncate">{selectedVehicle.modelo}</h2>
                  <p className="text-white/60 font-mono text-[10px] font-bold">VIN: {selectedVehicle.vin || "No indicado"} · VIN7: {selectedVehicle.vin7 || "—"}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" onClick={() => { setMovingVehicleId(selectedVehicle.id); handleCloseDetail(); }} className="h-10 w-10 bg-white/10 text-white"><Move className="w-5 h-5" /></Button>
                  <Button variant="ghost" onClick={handleCloseDetail} className="h-10 w-10 bg-white/10 text-white"><X className="w-5 h-5" /></Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                <section className="bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-3">
                  <div><h3 className="text-sm font-black uppercase text-secondary">Identificación del vehículo</h3><p className="text-[10px] text-slate-400">Edita los datos principales. Los cambios se guardan automáticamente.</p></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Modelo / versión</Label><Input value={selectedVehicle.modelo || ""} onChange={e => handleUpdateVehicle(selectedVehicle.id,{modelo:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Marca</Label><Input value={selectedVehicle.marca || "BMW"} onChange={e => handleUpdateVehicle(selectedVehicle.id,{marca:e.target.value})}/></div>
                    <div className="space-y-1 md:col-span-2"><Label>Bastidor completo (VIN)</Label><Input value={selectedVehicle.vin || ""} onChange={e => handleUpdateVehicle(selectedVehicle.id,{vin:e.target.value.toUpperCase(),vin7:e.target.value.slice(-7).toUpperCase()})}/></div>
                    <div className="space-y-1"><Label>Matrícula</Label><Input value={selectedVehicle.matricula || ""} onChange={e => handleUpdateVehicle(selectedVehicle.id,{matricula:e.target.value.toUpperCase()})}/></div>
                    <div className="space-y-1"><Label>Kilometraje</Label><Input type="number" value={selectedVehicle.kilometraje ?? ""} onChange={e => handleUpdateVehicle(selectedVehicle.id,{kilometraje:e.target.value === "" ? null : Number(e.target.value)})}/></div>
                    <div className="space-y-1"><Label>Motorización</Label><Input value={selectedVehicle.motor || ""} onChange={e => handleUpdateVehicle(selectedVehicle.id,{motor:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Carrocería</Label><Select value={selectedVehicle.bodyType || "SUV"} onValueChange={v => handleUpdateVehicle(selectedVehicle.id,{bodyType:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["SUV","Berlina","Coupe","Roadster","Touring","Compacto","Cabrio"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </section>
                <section className="bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-black uppercase text-secondary">Configuración y acabado</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Color exterior</Label><Select value={selectedVehicle.colorCodigo || selectedVehicle.colorBMW || "300"} onValueChange={v => handleUpdateVehicle(selectedVehicle.id,{colorCodigo:v,colorBMW:v,colorExterior:BMW_COLORS.find(c=>c.code===v)?.name || ""})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent className="max-h-64">{BMW_COLORS.map(c=><SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Tapicería / interior</Label><Input value={selectedVehicle.tapiceria || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{tapiceria:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Llantas</Label><Input value={selectedVehicle.llantas || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{llantas:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Equipamiento / paquetes</Label><Input value={selectedVehicle.equipamiento || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{equipamiento:e.target.value})}/></div>
                  </div>
                </section>
                <section className="bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-black uppercase text-secondary">Gestión comercial y logística</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Tipo logístico</Label><Select value={selectedVehicle.tipoLogistico || "Stock Expo"} onValueChange={v=>handleUpdateVehicle(selectedVehicle.id,{tipoLogistico:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TIPOS_LOGISTICOS.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Estado</Label><Select value={selectedVehicle.estado || "Stock"} onValueChange={v=>handleUpdateVehicle(selectedVehicle.id,{estado:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{ESTADOS.map(e=><SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Ubicación</Label><Select value={selectedVehicle.ubicacion || "Stock"} onValueChange={v=>handleUpdateVehicle(selectedVehicle.id,{ubicacion:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{PLAZAS_LIST.map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}<Separator className="my-1"/>{OTHER_LOCATIONS.map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Precio (€)</Label><Input type="number" value={selectedVehicle.precio ?? ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{precio:e.target.value===""?null:Number(e.target.value)})}/></div>
                    <div className="space-y-1"><Label>Fecha de entrada</Label><Input type="date" value={selectedVehicle.fechaEntrada || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{fechaEntrada:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Responsable</Label><Input value={selectedVehicle.responsable || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{responsable:e.target.value})}/></div>
                    {(selectedVehicle.tipoLogistico?.includes('Renting') || selectedVehicle.tipoLogistico === 'Entrega Cliente') && <div className="space-y-1 md:col-span-2"><Label>{selectedVehicle.tipoLogistico === 'Entrega Cliente' ? 'Nombre del cliente' : 'Empresa renting'}</Label><Input value={selectedVehicle.entidadRenting || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{entidadRenting:e.target.value})}/></div>}
                  </div>
                </section>
                <section className="bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-2">
                  <h3 className="text-sm font-black uppercase text-secondary">Observaciones</h3>
                  <Input value={selectedVehicle.observaciones || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{observaciones:e.target.value})} placeholder="Añadir notas internas del vehículo..."/>
                  <p className="text-[10px] text-slate-400">Alta: {selectedVehicle.createdAt || "Sin fecha"} · Última modificación: {selectedVehicle.updatedAt || "Sin registro"}</p>
                </section>
                <div className="flex justify-end pb-4"><Button variant="destructive" className="font-black uppercase text-xs" onClick={() => { if(confirm("¿Eliminar este vehículo del inventario?")) { deleteDoc(doc(db, "vehiculos", selectedVehicle.id)); handleCloseDetail(); } }}><Trash2 className="w-4 h-4 mr-2"/> Eliminar vehículo</Button></div>
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
              <div 
                key={car.id} 
                draggable="true"
                onDragStart={(e) => handleDragStart(e, car.id)}
                onClick={() => { setMovingVehicleId(car.id); setIsStockSheetOpen(false); }} 
                className="p-4 bg-white border border-slate-100 rounded-xl hover:border-primary cursor-pointer active:scale-[0.98]"
              >
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
        <DialogContent className="p-0 border-none rounded-3xl overflow-hidden max-w-[95vw] md:max-w-3xl shadow-2xl">
          <div className="p-5 bg-secondary text-white font-black uppercase italic text-center text-base">Alta completa de vehículo</div>
          <div className="p-5 md:p-6 space-y-5 bg-white max-h-[78vh] overflow-y-auto">
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase text-secondary border-b pb-2">1. Identificación</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Marca</Label><Select value={formData.marca} onValueChange={v=>setFormData({...formData,marca:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["BMW","MINI"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Modelo / versión *</Label><Input placeholder="Ej. X2 sDrive18d" value={formData.modelo} onChange={e=>setFormData({...formData,modelo:e.target.value})}/></div>
                <div className="space-y-1"><Label>Bastidor completo (VIN) *</Label><Input placeholder="17 caracteres" maxLength={17} value={formData.vin} onChange={e=>setFormData({...formData,vin:e.target.value.toUpperCase()})}/></div>
                <div className="space-y-1"><Label>Matrícula</Label><Input value={formData.matricula} onChange={e=>setFormData({...formData,matricula:e.target.value.toUpperCase()})}/></div>
                <div className="space-y-1"><Label>Motorización</Label><Input placeholder="Ej. xDrive20d" value={formData.motor} onChange={e=>setFormData({...formData,motor:e.target.value})}/></div>
                <div className="space-y-1"><Label>Kilometraje</Label><Input type="number" min="0" value={formData.kilometraje} onChange={e=>setFormData({...formData,kilometraje:e.target.value})}/></div>
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase text-secondary border-b pb-2">2. Configuración y acabado</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Color exterior</Label><Select value={formData.colorBMW} onValueChange={v=>setFormData({...formData,colorBMW:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent className="max-h-64">{BMW_COLORS.map(c=><SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Carrocería</Label><Select value={formData.bodyType} onValueChange={v=>setFormData({...formData,bodyType:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["SUV","Berlina","Coupe","Roadster","Touring","Compacto","Cabrio"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Tapicería / interior</Label><Input value={formData.tapiceria} onChange={e=>setFormData({...formData,tapiceria:e.target.value})}/></div>
                <div className="space-y-1"><Label>Llantas</Label><Input value={formData.llantas} onChange={e=>setFormData({...formData,llantas:e.target.value})}/></div>
                <div className="space-y-1 md:col-span-2"><Label>Equipamiento y paquetes</Label><Input value={formData.equipamiento} onChange={e=>setFormData({...formData,equipamiento:e.target.value})}/></div>
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase text-secondary border-b pb-2">3. Gestión comercial y logística</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Tipo logístico</Label><Select value={formData.tipoLogistico} onValueChange={v=>setFormData({...formData,tipoLogistico:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TIPOS_LOGISTICOS.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Estado</Label><Select value={formData.estado} onValueChange={v=>setFormData({...formData,estado:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{ESTADOS.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Ubicación inicial</Label><Select value={formData.ubicacion} onValueChange={v=>setFormData({...formData,ubicacion:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Stock",...PLAZAS_LIST,...OTHER_LOCATIONS.filter(v=>v!=="Stock")].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Precio (€)</Label><Input type="number" min="0" value={formData.precio} onChange={e=>setFormData({...formData,precio:e.target.value})}/></div>
                <div className="space-y-1"><Label>Responsable</Label><Input value={formData.responsable} onChange={e=>setFormData({...formData,responsable:e.target.value})}/></div>
                {(formData.tipoLogistico.includes("Renting") || formData.tipoLogistico==="Entrega Cliente") && <div className="space-y-1"><Label>{formData.tipoLogistico==="Entrega Cliente"?"Nombre del cliente":"Empresa renting"}</Label><Input value={formData.entidadRenting} onChange={e=>setFormData({...formData,entidadRenting:e.target.value})}/></div>}
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-black uppercase text-secondary border-b pb-2">4. Observaciones</h3>
              <Input placeholder="Notas internas del vehículo..." value={formData.observaciones} onChange={e=>setFormData({...formData,observaciones:e.target.value})}/>
            </section>
            <p className="text-[10px] text-slate-400">* Campos obligatorios. El VIN7 se obtiene automáticamente de los últimos siete caracteres del bastidor.</p>
            <Button onClick={handleQuickAdd} className="w-full h-12 bg-primary text-white font-black uppercase text-xs rounded-xl">Registrar vehículo en inventario</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  async function handleQuickAdd() {
    const vin = formData.vin.trim().toUpperCase();
    if (!formData.modelo.trim() || !vin) return toast({ variant: "destructive", title: "Faltan datos", description: "Modelo y bastidor son obligatorios." });
    if (vin.length !== 17) return toast({ variant: "destructive", title: "Bastidor no válido", description: "El VIN debe tener 17 caracteres." });
    if (/[IOQ]/.test(vin)) return toast({ variant: "destructive", title: "Bastidor no válido", description: "El VIN no puede contener I, O ni Q." });
    if (vehiculos.some(v => (v.vin || "").toUpperCase() === vin)) return toast({ variant: "destructive", title: "Vehículo duplicado", description: "Ya existe un vehículo con ese bastidor." });
    const now = new Date().toISOString();
    const vin7 = vin.slice(-7);
    const payload = { ...formData, modelo: formData.modelo.trim(), vin, vin7, kilometraje: formData.kilometraje === "" ? null : Number(formData.kilometraje), precio: formData.precio === "" ? null : Number(formData.precio), colorCodigo: formData.colorBMW, colorExterior: BMW_COLORS.find(c => c.code === formData.colorBMW)?.name || "Alpine White", fechaEntrada: now.split('T')[0], createdAt: now, updatedAt: now };
    try {
      await addDoc(collection(db, "vehiculos"), payload);
      toast({ title: "Vehículo Registrado" });
      setIsAddingNew(false);
      setFormData({ marca: "BMW", modelo: "", vin: "", matricula: "", kilometraje: "", motor: "sDrive20i", colorBMW: "300", tapiceria: "", llantas: "", equipamiento: "", bodyType: "SUV", ubicacion: "Stock", estado: "Stock", tipoLogistico: "Stock Expo", entidadRenting: "", precio: "", responsable: "", observaciones: "" });
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