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
import { collection, doc, updateDoc, deleteDoc, addDoc, query, orderBy, getDocs } from "firebase/firestore";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams, useRouter } from "next/navigation";
import ShowroomEditor from "@/components/showroom/showroom-editor";
import { BMW_COLORS, suggestedMotor, findBmwColorByName } from "@/lib/vehicle-constants";

export { BMW_COLORS } from "@/lib/vehicle-constants";
export function suggestedColor(model: string) {
  const value = model.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return BMW_COLORS.find(color => value.includes(color.name.toLowerCase().replace(" metallic", ""))) || null;
}

export function getVehicleColor(vehicle: any) {
  const raw = String(vehicle?.colorExterior || vehicle?.colorCorreo || "");
  const code = String(vehicle?.colorCodigo || vehicle?.colorBMW || "").trim().toUpperCase();
  const byCode = BMW_COLORS.find(c => c.code === code);
  if (byCode) return byCode;
  // Si existe un código antiguo/no válido, no bloquear la resolución por nombre.
  return findBmwColorByName(raw) || null;
}

export const TIPOS_LOGISTICOS = [
  "Stock exposición",
  "Cliente",
  "Cliente renting",
  "Entrega Renting",
  "Entrega Cliente",
  "Demo",
  "Devolucion Renting"
];

const ESTADOS = ["Exposicion", "Stock", "Demo", "Cliente", "Reservado", "Preparacion Entrega", "Entregado", "Cedido"];
const normalizeVehicleCategory = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const isCededVehicle = (vehicle: any) => [vehicle?.estado, vehicle?.ubicacion, vehicle?.categoria, vehicle?.categoriaStock, vehicle?.categoriaComercial, vehicle?.cedidoTipo, vehicle?.tipoLogistico, vehicle?.destinoLogistico].some(value => normalizeVehicleCategory(value).includes("cedido"));
const isCustomerVehicle = (vehicle: any) => {
  const normalize = (value: any) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\\s+/g, " ");
  const legacyStockLabel = [vehicle?.clienteLogistica, vehicle?.destinoLogistico, vehicle?.entidadRenting, vehicle?.propietario].some(value => ["stock expo","stock exposicion"].includes(normalize(value)));
 if (legacyStockLabel) return false;
 const categoryFields = [vehicle?.tipoLogistico, vehicle?.categoriaComercial, vehicle?.categoria, vehicle?.categoriaStock].map(normalize);
  const explicitNonCustomer = categoryFields.some(value => /^(stock expo|stock exposicion|demo|demo en uso|sin clasificar|cedido|cedido stock locator|stock locator|devolucion renting)$/.test(value));
  // La clasificación explícita de stock propio/demo prevalece sobre campos antiguos
  // de cliente que puedan haber quedado guardados por importaciones anteriores.
  if (explicitNonCustomer) return false;
  const identityFields = [vehicle?.clienteLogistica, vehicle?.destinoLogistico, vehicle?.entidadRenting, vehicle?.propietario];
  const identities = identityFields.map(normalize).filter(Boolean);
  const knownGeneric = /^(asignacion cliente\/?renting|entrega cliente|cliente|renting|sin clasificar|stock expo|stock exposicion|demo|demo en uso|devolucion renting)$/;
  if (identities.some(value => !knownGeneric.test(value))) return true;
  // En registros antiguos el nombre del cliente quedó guardado en tipoLogistico.
  const legacyType = normalize(vehicle?.tipoLogistico);
  if (legacyType && !knownGeneric.test(legacyType) && !/^(stock locator|cedido)$/.test(legacyType)) return true;
  return normalize(vehicle?.estado) === "cliente";
};
const getVehicleLogisticType = (vehicle: any) => {
  const normalize = (value: any) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  const stockExpoValues = [vehicle?.clienteLogistica, vehicle?.destinoLogistico, vehicle?.entidadRenting, vehicle?.propietario, vehicle?.tipoLogistico, vehicle?.categoriaComercial, vehicle?.categoria, vehicle?.categoriaStock];
  const legacyStock = stockExpoValues.some(value => /^(stock expo|stock exposicion)$/.test(normalize(value)));
  if (legacyStock) return "Stock exposición";
  const currentType = String(vehicle?.tipoLogistico || "").trim();
  if (normalize(currentType) === "devolucion renting") return "Devolucion Renting";
  if (String(vehicle?.tipoLogistico || "").toLowerCase().includes("demo") || String(vehicle?.estado || "").toLowerCase().includes("demo")) return "Demo";
  if (isCustomerVehicle(vehicle)) return normalize(currentType) === "cliente renting" ? "Cliente renting" : "Cliente";
  return currentType || "Stock exposición";
};
const PLAZAS_LIST = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12", "P13", "P14", "P15"];
const OTHER_LOCATIONS = ["Entreplanta", "Terraza", "Zona de entrega", "Demo en uso"];

const GRID_POSITIONS: Record<string, string> = {
  // Ocho vehículos del primer bloque: dos filas de cuatro.
  P1: "col-start-1 col-span-3 row-start-1",
  P2: "col-start-4 col-span-3 row-start-1",
  P3: "col-start-7 col-span-3 row-start-1",
  P4: "col-start-10 col-span-3 row-start-1",
  P5: "col-start-1 col-span-3 row-start-2",
  P6: "col-start-4 col-span-3 row-start-2",
  P7: "col-start-7 col-span-3 row-start-2",
  P8: "col-start-10 col-span-3 row-start-2",
  // Cuatro vehículos del segundo bloque, tras el pasillo de clientes.
  P9: "col-start-1 col-span-3 row-start-4",
  P10: "col-start-4 col-span-3 row-start-4",
  P11: "col-start-7 col-span-3 row-start-4",
  P12: "col-start-10 col-span-3 row-start-4",
  // Tres plataformas del fondo; la eléctrica conserva orientación transversal.
  P15: "col-start-1 col-span-3 row-start-5",
  P14: "col-start-4 col-span-3 row-start-5",
  P13: "col-start-10 col-span-3 row-start-5",
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
  const isStockOrigin = searchParams.get('returnTo') === '/stock';
  const { data: vehiculosRaw, loading } = useCollection(query(collection(db, "vehiculos"), orderBy("createdAt", "desc")));
  
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehicleDraft, setVehicleDraft] = useState<any | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [movingVehicleId, setMovingVehicleId] = useState<string | null>(null);
  const [draggedPlaza, setDraggedPlaza] = useState<string | null>(null);
  const [isStockSheetOpen, setIsStockSheetOpen] = useState(false);

  const [formData, setFormData] = useState({
    marca: "BMW", modelo: "", vin: "", vin7: "", matricula: "", kilometraje: "", motor: "",
    colorBMW: "300", tapiceria: "", llantas: "", equipamiento: "", bodyType: "SUV",
    ubicacion: "Stock", estado: "Stock", tipoLogistico: "Stock exposición", entidadRenting: "",
    precio: "", responsable: "", observaciones: ""
  });

  const vehiculos = useMemo(() => (vehiculosRaw || []) as any[], [vehiculosRaw]);
  const pendingStock = useMemo(() => vehiculos.filter(v => !/^P\d+$/i.test(String(v.ubicacion || "")) && v.estado !== "Entregado"), [vehiculos]);
  const selectedVehicleRecord = useMemo(() => vehiculos.find(v => v.id === selectedVehicleId), [vehiculos, selectedVehicleId]);
  const selectedVehicle = vehicleDraft?.id === selectedVehicleId ? vehicleDraft : selectedVehicleRecord;
  useEffect(() => { if (selectedVehicleRecord) setVehicleDraft({ ...selectedVehicleRecord }); else setVehicleDraft(null); }, [selectedVehicleId]);
  const handleDraftUpdate = (vehicleId: string, updates: any) => setVehicleDraft((current: any) => current?.id === vehicleId ? { ...current, ...updates } : current);
  const vehicleColorOptions = BMW_COLORS;
  const newVehicleColorOptions = BMW_COLORS;

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
    setVehicleDraft(null);
    const returnTo = searchParams.get('returnTo');
    // Volver al listado que abrió la ficha, manteniendo el contexto de navegación.
    if (returnTo === '/stock') {
      router.replace('/stock', { scroll: false });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete('s');
    params.delete('add');
    params.delete('returnTo');
    router.replace(`/showroom${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  };

  const [pendingStockVehicleId, setPendingStockVehicleId] = useState<string | null>(null);
  const [stockDestination, setStockDestination] = useState("Entreplanta");

  // Los cambios del formulario se mantienen en borrador hasta pulsar Guardar cambios.
  // Así evitamos que una actualización inmediata del estado se sobrescriba después
  // con el borrador antiguo del vehículo.
  const handleVehicleStatusChange = async (vehicleId: string, status: string) => {
    const vehicle = vehicleDraft?.id === vehicleId ? vehicleDraft : vehiculos.find(v => v.id === vehicleId);
    if (!vehicle) return;
    if (status === "Stock") {
      setStockDestination("Entreplanta");
      setPendingStockVehicleId(vehicleId);
      return;
    }
    if (status === "Exposicion") {
      const currentPlace = /^P(?:[1-9]|1[0-5])$/i.test(String(vehicle.ubicacion || "")) ? vehicle.ubicacion : null;
      const freePlace = PLAZAS_LIST.find(p => !vehiculos.some(v => v.id !== vehicleId && v.ubicacion === p && !["Entregado","Cedido"].includes(String(v.estado || ""))));
      const targetPlace = currentPlace || freePlace;
      if (!targetPlace) {
        toast({ variant: "destructive", title: "No hay plazas libres", description: "Libera una plaza del plano antes de pasar este vehículo a exposición." });
        return;
      }
      handleDraftUpdate(vehicleId, { estado: "Exposicion", ubicacion: targetPlace });
      return;
    }
    const statusUpdates = status === "Cedido"
      ? { estado: "Cedido", ubicacion: "No disponible", cedidoTipo: vehicle.cedidoTipo || (vehicle.stockLocator ? "Stock Locator" : "Cedido"), stockLocator: vehicle.stockLocator === true }
      : status === "Demo"
        ? { estado: "Demo", tipoLogistico: "Demo", ubicacion: "No disponible", cedidoTipo: "", stockLocator: false }
        : status === "Cliente"
          ? { estado: "Cliente", tipoLogistico: "Cliente", ubicacion: "No disponible", cedidoTipo: "", stockLocator: false }
          : { estado: status, ubicacion: "No disponible", cedidoTipo: "", stockLocator: false, ...(normalizeVehicleCategory(vehicle.categoriaComercial).includes("cedido") ? { categoriaComercial: "" } : {}) };
    handleDraftUpdate(vehicleId, statusUpdates);
  };

  const confirmStockDestination = async () => {
    if (!pendingStockVehicleId) return;
    handleDraftUpdate(pendingStockVehicleId, { estado: "Stock", ubicacion: stockDestination });
    setPendingStockVehicleId(null);
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
      return true;
    } catch (e) {
      console.error("Error al actualizar vehículo", e);
      toast({ variant: "destructive", title: "Error al actualizar", description: "No se han podido guardar los cambios. Mantengo el formulario abierto para que no pierdas lo editado." });
      return false;
    }
  };

  const handleSaveVehicleDraft = async () => {
    if (!selectedVehicle?.id || !vehicleDraft) return;
    const updates = { ...vehicleDraft };
    delete updates.id;
    const saved = await handleUpdateVehicle(selectedVehicle.id, updates);
    if (saved) {
      toast({ title: "Cambios guardados", description: "El vehículo se ha actualizado correctamente." });
      handleCloseDetail();
    }
  };
  const handleSwapOrMove = async (sourceId: string, targetPlaza: string) => {
    const sourceCar = vehiculos.find(v => v.id === sourceId);
    if (!sourceCar) return;
    
    const targetCar = vehiculos.find(v => v.ubicacion === targetPlaza);
    
    if (targetCar && targetCar.id !== sourceId) {
      const oldLocation = /^P\d+$/i.test(String(sourceCar.ubicacion || "")) ? sourceCar.ubicacion : 'Stock';
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
    // Identidad visual de las tres plataformas del fondo:
    // P13 eléctrica (azul), P14 estándar (neutro), P15 M (rojo).
    const platformStyle = id === "P13"
      ? "bg-blue-50 border border-blue-200"
      : id === "P14"
        ? "bg-slate-100 border border-slate-300"
        : id === "P15"
          ? "bg-red-50 border border-red-200"
          : "";

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
          vehicle ? "shadow-sm cursor-pointer hover:shadow-md" : "border-dashed border-2",
          platformStyle,
          isMovingTarget && "ring-4 ring-primary bg-primary/10 z-50 scale-[1.02]"
        )}
      >
        <div className="absolute top-0 left-0 z-30 p-0.5">
          <span className={cn("text-[7px] md:text-[9px] font-black uppercase leading-none", id === "P13" ? "text-blue-700" : id === "P15" ? "text-red-700" : id === "P14" ? "text-slate-600" : "text-slate-300")}>{id}{id === "P13" ? " · i" : id === "P15" ? " · M" : ""}</span>
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
      {!isStockOrigin && <ShowroomEditor
        vehicles={vehiculos}
        movingVehicleId={movingVehicleId}
        onPlaceVehicle={(vehicleId, plazaId) => handleSwapOrMove(vehicleId, plazaId)}
        onSelectVehicle={setSelectedVehicleId}
        onCancelMove={() => setMovingVehicleId(null)}
      />}

      <Dialog open={!!pendingStockVehicleId} onOpenChange={open=>{if(!open)setPendingStockVehicleId(null);}}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ubicación del vehículo en stock</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">El vehículo saldrá del plano de exposición. Selecciona dónde quedará guardado.</p>
          <div className="space-y-2"><Label>Destino</Label><Select value={stockDestination} onValueChange={setStockDestination}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Entreplanta">Entreplanta</SelectItem><SelectItem value="Terraza">Terraza</SelectItem></SelectContent></Select></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setPendingStockVehicleId(null)}>Cancelar</Button><Button onClick={confirmStockDestination}>Confirmar ubicación</Button></div>
        </DialogContent>
      </Dialog>

      {/* Diálogos y Sheets */}
      <Sheet open={!!selectedVehicleId} onOpenChange={o => !o && handleCloseDetail()}>
        <SheetContent side="bottom" className="h-[94vh] p-0 rounded-t-3xl border-none shadow-2xl overflow-hidden bg-slate-50">
          {selectedVehicle && (
            <div className="flex flex-col h-full">
              <div className="bg-secondary px-5 py-4 text-white flex justify-between items-center shrink-0">
                <div className="min-w-0">
                  <Badge className="bg-primary text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md">{isCustomerVehicle(selectedVehicle) ? "Cliente" : (selectedVehicle.estado || "Stock")}</Badge>
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
                    <div className="space-y-1"><Label>Modelo / versión</Label><Input value={selectedVehicle.modelo || ""} onChange={e => { const model=e.target.value; const motor=suggestedMotor(model); const color=suggestedColor(model); handleDraftUpdate(selectedVehicle.id,{modelo:model,...(motor?{motor}:{}),...(color?{colorCodigo:color.code,colorBMW:color.code,colorExterior:color.name}:{})}); }}/></div>
                    <div className="space-y-1"><Label>Marca</Label><Input value={/^MINI\b/i.test(selectedVehicle.modelo || "") ? "MINI" : (selectedVehicle.marca || "BMW")} readOnly className="bg-slate-50"/></div>
                    <div className="space-y-1 md:col-span-2"><Label>Bastidor completo (VIN)</Label><Input value={selectedVehicle.vin || ""} onChange={e => handleDraftUpdate(selectedVehicle.id,{vin:e.target.value.toUpperCase(),vin7:e.target.value.slice(-7).toUpperCase()})}/></div>
                    <div className="space-y-1"><Label>Matrícula</Label><Input value={selectedVehicle.matricula || ""} onChange={e => handleDraftUpdate(selectedVehicle.id,{matricula:e.target.value.toUpperCase()})}/></div>
                    <div className="space-y-1"><Label>Motorización</Label><Input value={selectedVehicle.motor || suggestedMotor(selectedVehicle.modelo || "")} onChange={e => handleDraftUpdate(selectedVehicle.id,{motor:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Carrocería</Label><Select value={selectedVehicle.bodyType || "SUV"} onValueChange={v => handleDraftUpdate(selectedVehicle.id,{bodyType:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["SUV","Berlina","Coupe","Roadster","Touring","Compacto","Cabrio"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </section>
                <section className="bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-black uppercase text-secondary">Configuración y acabado</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Color exterior</Label><div className="flex items-center gap-2"><span className="h-9 w-9 shrink-0 rounded-md border border-slate-300 shadow-inner" style={{backgroundColor:getVehicleColor(selectedVehicle)?.hex||"#e5e7eb"}}/><Select value={selectedVehicle.colorCodigo || selectedVehicle.colorBMW || (getVehicleColor(selectedVehicle) && BMW_COLORS.some(c=>c.code===getVehicleColor(selectedVehicle)?.code) ? getVehicleColor(selectedVehicle)!.code : (selectedVehicle.colorExterior ? `correo:${selectedVehicle.colorExterior}` : "300"))} onValueChange={v => v.startsWith("correo:") ? handleDraftUpdate(selectedVehicle.id,{colorExterior:v.slice(7),colorCorreo:v.slice(7)}) : handleDraftUpdate(selectedVehicle.id,{colorCodigo:v,colorBMW:v,colorExterior:BMW_COLORS.find(c=>c.code===v)?.name || ""})}><SelectTrigger className="flex-1"><SelectValue/></SelectTrigger><SelectContent className="max-h-64">{selectedVehicle.colorExterior && !BMW_COLORS.some(c=>c.name.toLowerCase()===String(selectedVehicle.colorExterior).toLowerCase()) && <SelectItem value={`correo:${selectedVehicle.colorExterior}`}>{selectedVehicle.colorExterior} · Correo BMW</SelectItem>}<SelectGroup><SelectLabel className="text-xs font-bold uppercase tracking-wider text-blue-700">Colores BMW</SelectLabel>{vehicleColorOptions.filter(c=>c.brand==="BMW").map(c=><SelectItem key={c.code} value={c.code}><span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border border-slate-400 shadow-sm" style={{backgroundColor:c.hex}}/><span>{c.code} · {c.name}</span></span></SelectItem>)}</SelectGroup><SelectSeparator/><SelectGroup><SelectLabel className="text-xs font-bold uppercase tracking-wider text-blue-700">Colores MINI</SelectLabel>{vehicleColorOptions.filter(c=>c.brand==="MINI").map(c=><SelectItem key={c.code} value={c.code}><span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border border-slate-400 shadow-sm" style={{backgroundColor:c.hex}}/><span>{c.code} · {c.name}</span></span></SelectItem>)}</SelectGroup></SelectContent></Select></div></div>
                    <div className="space-y-1"><Label>Tapicería / interior</Label><Input value={selectedVehicle.tapiceria || ""} onChange={e=>handleDraftUpdate(selectedVehicle.id,{tapiceria:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Llantas</Label><Input value={selectedVehicle.llantas || ""} onChange={e=>handleDraftUpdate(selectedVehicle.id,{llantas:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Equipamiento / paquetes</Label><Input value={selectedVehicle.equipamiento || ""} onChange={e=>handleDraftUpdate(selectedVehicle.id,{equipamiento:e.target.value})}/></div>
                  </div>
                </section>
                <section className="bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-black uppercase text-secondary">Gestión comercial y logística</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Tipo logístico</Label><Select value={getVehicleLogisticType(selectedVehicle)} onValueChange={v=>handleDraftUpdate(selectedVehicle.id, normalizeVehicleCategory(v) === "stock expo" || normalizeVehicleCategory(v) === "stock exposicion" ? {tipoLogistico:"Stock exposición",estado:/^P(?:[1-9]|1[0-5])$/i.test(String(selectedVehicle.ubicacion||"")) ? "Exposicion" : "Stock",clienteLogistica:"",destinoLogistico:"",entidadRenting:"",propietario:"",ubicacion:selectedVehicle.ubicacion === "No disponible" ? "Entreplanta" : selectedVehicle.ubicacion} : v === "Demo" ? {tipoLogistico:v,estado:"Demo",clienteLogistica:"",destinoLogistico:"",entidadRenting:"",propietario:""} : v === "Cliente" || v === "Cliente renting" ? {tipoLogistico:v,estado:"Cliente"} : {tipoLogistico:v})}><SelectTrigger><SelectValue placeholder="Seleccionar tipo logístico"/></SelectTrigger><SelectContent>{Array.from(new Set([...TIPOS_LOGISTICOS, ...(selectedVehicle.tipoLogistico ? [selectedVehicle.tipoLogistico] : [])])).map(tipo=><SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Cliente / destino del correo</Label><Input value={selectedVehicle.clienteLogistica || selectedVehicle.destinoLogistico || ""} onChange={e=>handleDraftUpdate(selectedVehicle.id,{clienteLogistica:e.target.value,destinoLogistico:e.target.value})} placeholder="Cliente, empresa o destino logístico"/></div>
                    <div className="space-y-1"><Label>Estado</Label><Select value={isCededVehicle(selectedVehicle) ? "Cedido" : isCustomerVehicle(selectedVehicle) ? "Cliente" : (selectedVehicle.estado || "Stock")} onValueChange={v=>handleVehicleStatusChange(selectedVehicle.id,v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{ESTADOS.map(e=><SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select></div>
                    {isCededVehicle(selectedVehicle) && <div className="space-y-1"><Label>Clasificación del vehículo cedido</Label><Select value={selectedVehicle.cedidoTipo || (selectedVehicle.stockLocator ? "Stock Locator" : "Cedido")} onValueChange={v=>handleDraftUpdate(selectedVehicle.id,{cedidoTipo:v,stockLocator:v === "Stock Locator",categoriaComercial:v === "Stock Locator" ? "Cedido · Stock Locator" : "Cedido"})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Cedido">Cedido</SelectItem><SelectItem value="Stock Locator">Cedido · Stock Locator</SelectItem></SelectContent></Select><p className="text-xs text-slate-500">Ambas opciones quedan fuera del stock operativo del concesionario.</p></div>}
                    <div className="space-y-1"><Label>Ubicación física</Label>{getVehicleLogisticType(selectedVehicle) === "Stock exposición" || normalizeVehicleCategory(selectedVehicle.tipoLogistico) === "stock exposicion" ? <Select value={["Entreplanta","Terraza"].includes(selectedVehicle.ubicacion) || /^P\d+$/i.test(String(selectedVehicle.ubicacion||"")) ? selectedVehicle.ubicacion : "pendiente"} onValueChange={v=>handleDraftUpdate(selectedVehicle.id,{ubicacion:v==="pendiente"?"Pendiente de ubicación":v,estado:/^P\d+$/i.test(v)?"Exposicion":"Stock",tipoLogistico:"Stock exposición",clienteLogistica:"",destinoLogistico:"",entidadRenting:"",propietario:""})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="pendiente">Pendiente de ubicación</SelectItem>{PLAZAS_LIST.map(p=><SelectItem key={p} value={p}>Exposición · {p}</SelectItem>)}<SelectItem value="Entreplanta">Entreplanta</SelectItem><SelectItem value="Terraza">Terraza</SelectItem></SelectContent></Select> : isCustomerVehicle(selectedVehicle) ? <Select value={["Entreplanta","Terraza","Zona de entrega"].includes(selectedVehicle.ubicacion) ? selectedVehicle.ubicacion : "sin-asignar"} onValueChange={v=>handleDraftUpdate(selectedVehicle.id,{ubicacion:v === "sin-asignar" ? "No disponible" : v})}><SelectTrigger><SelectValue placeholder="Seleccionar ubicación del cliente"/></SelectTrigger><SelectContent><SelectItem value="sin-asignar">Sin ubicación asignada</SelectItem><SelectItem value="Entreplanta">Entreplanta</SelectItem><SelectItem value="Terraza">Terraza</SelectItem><SelectItem value="Zona de entrega">Zona de entrega</SelectItem></SelectContent></Select> : selectedVehicle.estado === "Exposicion" ? <Select value={selectedVehicle.ubicacion || ""} onValueChange={v=>handleDraftUpdate(selectedVehicle.id,{ubicacion:v,estado:"Exposicion",tipoLogistico:"Stock exposición"})}><SelectTrigger><SelectValue placeholder="Plaza de exposición"/></SelectTrigger><SelectContent>{PLAZAS_LIST.map(p=><SelectItem key={p} value={p}>Exposición · {p}</SelectItem>)}</SelectContent></Select> : <Input value="No disponible para exposición" readOnly className="bg-slate-100 text-slate-500"/>}</div>
                    <div className="space-y-1"><Label>Fecha de entrada</Label><Input type="date" value={selectedVehicle.fechaEntrada || ""} onChange={e=>handleDraftUpdate(selectedVehicle.id,{fechaEntrada:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Responsable</Label><Input value={selectedVehicle.responsable || ""} onChange={e=>handleDraftUpdate(selectedVehicle.id,{responsable:e.target.value})}/></div>
                    {(selectedVehicle.ubicacion === "Demo en uso" || String(selectedVehicle.tipoLogistico || "").toLowerCase().includes("demo") || String(selectedVehicle.estado || "").toLowerCase().includes("demo")) && <><div className="md:col-span-2 mt-2 border-t border-slate-100 pt-3"><h4 className="text-xs font-black uppercase tracking-wide text-blue-700">Seguimiento del vehículo demo</h4><p className="mt-1 text-[10px] text-slate-400">Indica dónde se encuentra actualmente y quién lo está utilizando. No modifica su clasificación logística ni su ubicación de stock.</p></div><div className="space-y-1"><Label>Ubicación actual del demo</Label><Input value={selectedVehicle.demoUbicacionActual || ""} onChange={e=>handleDraftUpdate(selectedVehicle.id,{demoUbicacionActual:e.target.value})} placeholder="Ej. Ollarzun, San Sebastián"/></div><div className="space-y-1"><Label>Persona que lo está conduciendo</Label><Input value={selectedVehicle.demoAsignadoA || ""} onChange={e=>handleDraftUpdate(selectedVehicle.id,{demoAsignadoA:e.target.value})} placeholder="Nombre y apellidos"/></div></>}
                    <div className="space-y-1"><Label>Vendedor (correo BMW)</Label><Input value={selectedVehicle.vendedorLogistica || ""} readOnly className="bg-slate-50"/></div>
                    <div className="space-y-1"><Label>Fecha recepción</Label><Input value={selectedVehicle.fechaRecepcionCorreo || ""} readOnly className="bg-slate-50"/></div>
                    <div className="space-y-1"><Label>Llegada</Label><Input value={selectedVehicle.llegada || ""} readOnly className="bg-slate-50"/></div>
                    <div className="space-y-1"><Label>Comisión</Label><Input value={selectedVehicle.comision || ""} readOnly className="bg-slate-50"/></div>
                    {isCustomerVehicle(selectedVehicle) && <><div className="md:col-span-2 mt-2 border-t border-slate-100 pt-3"><h4 className="text-xs font-black uppercase tracking-wide text-blue-700">Datos del vehículo de cliente</h4><p className="mt-1 text-[10px] text-slate-400">Las unidades de clientes no ocupan plazas de exposición, pero puedes indicar dónde están físicamente: entreplanta, terraza o zona de entrega.</p></div><div className="space-y-1"><Label>Matrícula del vehículo</Label><Input value={selectedVehicle.matricula || ""} onChange={e=>handleDraftUpdate(selectedVehicle.id,{matricula:e.target.value.toUpperCase()})} placeholder="Ej. 1234 ABC"/></div><div className="space-y-1"><Label>Empresa / entidad cliente</Label><Input value={selectedVehicle.entidadRenting || selectedVehicle.clienteLogistica || selectedVehicle.destinoLogistico || ""} onChange={e=>handleDraftUpdate(selectedVehicle.id,{entidadRenting:e.target.value})} placeholder="Ej. BBVA, Santander, Ayvens, Arval..."/></div><div className="space-y-1"><Label>Propietario</Label><Input value={selectedVehicle.propietario || ""} onChange={e=>handleDraftUpdate(selectedVehicle.id,{propietario:e.target.value})} placeholder="Nombre del propietario o titular"/></div></>}
                  </div>
                </section>
                <section className="bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-2">
                  <h3 className="text-sm font-black uppercase text-secondary">Observaciones</h3>
                  <Input value={selectedVehicle.observaciones || ""} onChange={e=>handleDraftUpdate(selectedVehicle.id,{observaciones:e.target.value})} placeholder="Añadir notas internas del vehículo..."/>
                  <p className="text-[10px] text-slate-400">Alta: {selectedVehicle.createdAt || "Sin fecha"} · Última modificación: {selectedVehicle.updatedAt || "Sin registro"}</p>
                </section>
                <div className="flex justify-end pb-4"><Button variant="destructive" className="font-black uppercase text-xs" onClick={() => { if(confirm("¿Eliminar este vehículo del inventario?")) { deleteDoc(doc(db, "vehiculos", selectedVehicle.id)); handleCloseDetail(); } }}><Trash2 className="w-4 h-4 mr-2"/> Eliminar vehículo</Button></div>
              </div>
              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.06)]">
                <Button onClick={handleSaveVehicleDraft} className="h-11 w-full bg-[#0066b3] font-black uppercase tracking-wide text-white hover:bg-[#00549a]">Guardar cambios</Button>
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
                <div className="space-y-1"><Label>Modelo / versión *</Label><Input placeholder="Ej. BMW X1 sDrive18d" value={formData.modelo} onChange={e=>{const modelo=e.target.value;const motor=suggestedMotor(modelo);const color=suggestedColor(modelo);setFormData({...formData,modelo,...(motor?{motor}:{}),...(color?{colorBMW:color.code}:{})});}}/></div>
                <div className="space-y-1"><Label>VIN completo (opcional)</Label><Input placeholder="17 caracteres" maxLength={17} value={formData.vin} onChange={e=>{const vin=e.target.value.toUpperCase().replace(/\\s/g,"");setFormData({...formData,vin,vin7:vin.length===17?vin.slice(-7):formData.vin7});}}/></div>
                <div className="space-y-1"><Label>VIN7 (obligatorio)</Label><Input placeholder="Últimos 7 caracteres" maxLength={7} value={formData.vin7} onChange={e=>setFormData({...formData,vin7:e.target.value.toUpperCase().replace(/\\s/g,"").slice(0,7)})}/></div>
                <div className="space-y-1"><Label>Matrícula</Label><Input value={formData.matricula} onChange={e=>setFormData({...formData,matricula:e.target.value.toUpperCase()})}/></div>
                <div className="space-y-1"><Label>Motorización sugerida</Label><Input placeholder="Se completa según el modelo; puedes corregirla" value={formData.motor} onChange={e=>setFormData({...formData,motor:e.target.value})}/></div>
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase text-secondary border-b pb-2">2. Configuración y acabado</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Color exterior</Label><div className="flex items-center gap-2"><span className="h-9 w-9 shrink-0 rounded-md border border-slate-300 shadow-inner" style={{backgroundColor:BMW_COLORS.find(c=>c.code===formData.colorBMW)?.hex||"#e5e7eb"}}/><Select value={formData.colorBMW} onValueChange={v=>setFormData({...formData,colorBMW:v})}><SelectTrigger className="flex-1"><SelectValue/></SelectTrigger><SelectContent className="max-h-64"><SelectGroup><SelectLabel className="text-xs font-bold uppercase tracking-wider text-blue-700">Colores BMW</SelectLabel>{newVehicleColorOptions.filter(c=>c.brand==="BMW").map(c=><SelectItem key={c.code} value={c.code}><span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border border-slate-400 shadow-sm" style={{backgroundColor:c.hex}}/><span>{c.code} · {c.name}</span></span></SelectItem>)}</SelectGroup><SelectSeparator/><SelectGroup><SelectLabel className="text-xs font-bold uppercase tracking-wider text-blue-700">Colores MINI</SelectLabel>{newVehicleColorOptions.filter(c=>c.brand==="MINI").map(c=><SelectItem key={c.code} value={c.code}><span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border border-slate-400 shadow-sm" style={{backgroundColor:c.hex}}/><span>{c.code} · {c.name}</span></span></SelectItem>)}</SelectGroup></SelectContent></Select></div></div>
                <div className="space-y-1"><Label>Carrocería</Label><Select value={formData.bodyType} onValueChange={v=>setFormData({...formData,bodyType:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["SUV","Berlina","Coupe","Roadster","Touring","Compacto","Cabrio"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Tapicería / interior</Label><Input value={formData.tapiceria} onChange={e=>setFormData({...formData,tapiceria:e.target.value})}/></div>
                <div className="space-y-1"><Label>Llantas</Label><Input value={formData.llantas} onChange={e=>setFormData({...formData,llantas:e.target.value})}/></div>
                <div className="space-y-1 md:col-span-2"><Label>Equipamiento y paquetes</Label><Input value={formData.equipamiento} onChange={e=>setFormData({...formData,equipamiento:e.target.value})}/></div>
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase text-secondary border-b pb-2">3. Gestión comercial y logística</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Tipo logístico</Label><Select value={formData.tipoLogistico} onValueChange={v=>{const isStockExpo=["stock expo","stock exposicion"].includes(normalizeVehicleCategory(v));const onPlaza=/^P(?:[1-9]|1[0-5])$/i.test(String(formData.ubicacion||""));setFormData({...formData,tipoLogistico:isStockExpo?"Stock exposición":v,estado:isStockExpo?(onPlaza?"Exposicion":"Stock"):formData.estado,entidadRenting:isStockExpo?"":formData.entidadRenting})}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TIPOS_LOGISTICOS.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Estado</Label><Select value={formData.estado} onValueChange={v=>setFormData({...formData,estado:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{ESTADOS.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Ubicación inicial</Label><Select value={formData.ubicacion} onValueChange={v=>{const isStockExpo=["stock expo","stock exposicion"].includes(normalizeVehicleCategory(formData.tipoLogistico));const onPlaza=/^P(?:[1-9]|1[0-5])$/i.test(String(v||""));setFormData({...formData,ubicacion:v,estado:isStockExpo?(onPlaza?"Exposicion":"Stock"):formData.estado,tipoLogistico:isStockExpo?"Stock exposición":formData.tipoLogistico})}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Stock",...PLAZAS_LIST,...OTHER_LOCATIONS.filter(v=>v!=="Stock")].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
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
    const vin7 = formData.vin7.trim().toUpperCase();
    if (!formData.modelo.trim() || vin7.length !== 7) return toast({ variant: "destructive", title: "Faltan datos", description: "Indica el modelo y los últimos 7 caracteres del bastidor (VIN7)." });
    if (vin && (vin.length !== 17 || /[IOQ]/.test(vin))) return toast({ variant: "destructive", title: "Bastidor no válido", description: "El VIN completo debe tener 17 caracteres y no contener I, O ni Q." });
    try {
      // Consulta Firestore en el momento del alta para no depender de una lista React desactualizada.
      const latestVehicles = await getDocs(collection(db, "vehiculos"));
      const latestRecords = latestVehicles.docs.map(item => ({ id: item.id, ...item.data() } as any));
      const normalizedType = normalizeVehicleCategory(formData.tipoLogistico);
      const isStockExpo = ["stock expo","stock exposicion"].includes(normalizedType);
      const isShowroomPlaza = /^P(?:[1-9]|1[0-5])$/i.test(String(formData.ubicacion || ""));
      if (isStockExpo && isShowroomPlaza) {
        const occupied = latestRecords.find(vehicle => vehicle.ubicacion === formData.ubicacion && !["entregado","cedido"].includes(normalizeVehicleCategory(vehicle.estado)));
        if (occupied) return toast({ variant: "destructive", title: "Plaza ocupada", description: `${formData.ubicacion} ya está ocupada por ${occupied.modelo || occupied.vin7 || "otro vehículo"}.` });
      }
      const duplicate = latestRecords.find(vehicle => {
        const savedVin = normalizeVin(vehicle.vin);
        const savedVin7 = normalizeVin(vehicle.vin7) || (savedVin.length === 7 ? savedVin : savedVin.slice(-7));
        return (vin && savedVin.length === 17 && savedVin === vin)
          || ((!vin || savedVin.length !== 17) && savedVin7 === vin7)
          || (savedVin7 === vin7 && (!savedVin || savedVin.length < 17));
      });
      if (duplicate) return toast({ variant: "destructive", title: "Vehículo ya registrado", description: duplicate.modelo || "El bastidor ya existe en stock. No se ha creado un duplicado." });
    } catch (error) {
      return toast({ variant: "destructive", title: "No se pudo verificar el bastidor", description: "No se ha guardado el vehículo. Comprueba la conexión e inténtalo de nuevo." });
    }
    const now = new Date().toISOString();
    const normalizedType = normalizeVehicleCategory(formData.tipoLogistico);
    const isStockExpo = ["stock expo","stock exposicion"].includes(normalizedType);
    const isShowroomPlaza = /^P(?:[1-9]|1[0-5])$/i.test(String(formData.ubicacion || ""));
    const payload = { ...formData, tipoLogistico: isStockExpo ? "Stock exposición" : formData.tipoLogistico, estado: isStockExpo ? (isShowroomPlaza ? "Exposicion" : "Stock") : formData.estado, modelo: formData.modelo.trim(), vin, vin7, kilometraje: null, precio: formData.precio === "" ? null : Number(formData.precio), colorCodigo: formData.colorBMW, colorExterior: BMW_COLORS.find(c => c.code === formData.colorBMW)?.name || "Alpine White", fechaEntrada: now.split('T')[0], createdAt: now, updatedAt: now };
    try {
      await addDoc(collection(db, "vehiculos"), payload);
      toast({ title: "Vehículo Registrado" });
      setIsAddingNew(false);
      setFormData({ marca: "BMW", modelo: "", vin: "", vin7: "", matricula: "", kilometraje: "", motor: "", colorBMW: "300", tapiceria: "", llantas: "", equipamiento: "", bodyType: "SUV", ubicacion: "Stock", estado: "Stock", tipoLogistico: "Stock exposición", entidadRenting: "", precio: "", responsable: "", observaciones: "" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    }
  }
}

const normalizeVin = (value: unknown) => String(value || "").replace(/\s+/g, "").toUpperCase();
export default function ShowroomFinal() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-primary w-10 h-10" /></div>}>
      <ShowroomContent />
    </Suspense>
  );
}