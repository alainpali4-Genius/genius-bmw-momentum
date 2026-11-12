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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams, useRouter } from "next/navigation";
import ShowroomEditor from "@/components/showroom/showroom-editor";

export const BMW_COLORS = [
  // BMW: gama habitual y colores BMW Individual/M.
  {code:"300",name:"Alpine White III",hex:"#F5F5F5",brand:"BMW"},
  {code:"668",name:"Jet Black",hex:"#080808",brand:"BMW"},
  {code:"475",name:"Black Sapphire Metallic",hex:"#1A1A1A",brand:"BMW"},
  {code:"416",name:"Carbon Black Metallic",hex:"#111827",brand:"BMW"},
  {code:"A96",name:"Mineral White Metallic",hex:"#F3F3F1",brand:"BMW"},
  {code:"A83",name:"Glacier Silver Metallic",hex:"#AEB4B8",brand:"BMW"},
  {code:"A75",name:"Melbourne Red Metallic",hex:"#8E1824",brand:"BMW"},
  {code:"B39",name:"Mineral Grey Metallic",hex:"#686C70",brand:"BMW"},
  {code:"B45",name:"Estoril Blue Metallic",hex:"#07549A",brand:"BMW"},
  {code:"A52",name:"Space Grey Metallic",hex:"#737A80",brand:"BMW"},
  {code:"A89",name:"Imperial Blue Metallic",hex:"#172D50",brand:"BMW"},
  {code:"C1M",name:"Phytonic Blue Metallic",hex:"#245A91",brand:"BMW"},
  {code:"C1X",name:"Sunset Orange Metallic",hex:"#C65B20",brand:"BMW"},
  {code:"C10",name:"Mediterranean Blue Metallic",hex:"#164B78",brand:"BMW"},
  {code:"C31",name:"Portimao Blue Metallic",hex:"#004D8D",brand:"BMW"},
  {code:"C3Z",name:"Tanzanite Blue II Metallic",hex:"#172C52",brand:"BMW"},
  {code:"C34",name:"San Francisco Red Metallic",hex:"#8E2634",brand:"BMW"},
  {code:"C35",name:"Blue Ridge Mountain Metallic",hex:"#526D83",brand:"BMW"},
  {code:"C36",name:"Dravit Grey Metallic",hex:"#5D5A55",brand:"BMW"},
  {code:"C3D",name:"Manhattan Metallic",hex:"#77766F",brand:"BMW"},
  {code:"C3G",name:"Toronto Red Metallic",hex:"#A51E2D",brand:"BMW"},
  {code:"C3N",name:"Storm Bay Metallic",hex:"#687A83",brand:"BMW"},
  {code:"C4E",name:"San Remo Green Metallic",hex:"#526A54",brand:"BMW"},
  {code:"C4F",name:"Arctic Race Blue Metallic",hex:"#2A5C9A",brand:"BMW"},
  {code:"C4G",name:"Isle of Man Green Metallic",hex:"#176044",brand:"BMW"},
  {code:"C4H",name:"Sao Paulo Yellow",hex:"#E3C52D",brand:"BMW"},
  {code:"C4P",name:"Brooklyn Grey Metallic",hex:"#7B7D7E",brand:"BMW"},
  {code:"C4W",name:"Skyscraper Grey Metallic",hex:"#8B8E91",brand:"BMW"},
  {code:"X1F",name:"Frozen Pure Grey Metallic",hex:"#85898B",brand:"BMW"},
  {code:"X1G",name:"Frozen Tanzanite Blue Metallic",hex:"#263C62",brand:"BMW"},
  // MINI: colores clásicos y actuales. La disponibilidad depende del modelo y año.
  {code:"850",name:"Pepper White",hex:"#F0EEE4",brand:"MINI"},
  {code:"851",name:"Chili Red",hex:"#B51F2A",brand:"MINI"},
  {code:"A94",name:"Midnight Black Metallic",hex:"#17191D",brand:"MINI"},
  {code:"A62",name:"White Silver Metallic",hex:"#BFC4C7",brand:"MINI"},
  {code:"B22",name:"British Racing Green",hex:"#174B36",brand:"MINI"},
  {code:"B26",name:"Oxford Green",hex:"#243D32",brand:"MINI"},
  {code:"B30",name:"Reef Blue",hex:"#28749A",brand:"MINI"},
  {code:"B47",name:"Rooftop Grey",hex:"#85898C",brand:"MINI"},
  {code:"B58",name:"Thunder Grey",hex:"#777C80",brand:"MINI"},
  {code:"B62",name:"Starlight Blue",hex:"#254B78",brand:"MINI"},
  {code:"B70",name:"Volcanic Orange",hex:"#D66B25",brand:"MINI"},
  {code:"B71",name:"Moonwalk Grey",hex:"#92999C",brand:"MINI"},
  {code:"C19",name:"Rebel Green",hex:"#31513C",brand:"MINI"},
  {code:"C1B",name:"Solaris Orange",hex:"#D96B28",brand:"MINI"},
  {code:"C2C",name:"Pure Burgundy",hex:"#592B3C",brand:"MINI"},
  {code:"C2M",name:"Island Blue",hex:"#4B86A8",brand:"MINI"},
  {code:"C3B",name:"British Racing Green IV",hex:"#174B35",brand:"MINI"},
  {code:"C3Y",name:"Enigmatic Black Metallic",hex:"#252A31",brand:"MINI"},
  {code:"C4L",name:"Sage Green",hex:"#9AA58D",brand:"MINI"},
  {code:"C54",name:"Melting Silver II",hex:"#B9BEC1",brand:"MINI"},
  {code:"C5H",name:"Zesty Yellow",hex:"#D8D33C",brand:"MINI"},
  {code:"C6A",name:"Nanuq White",hex:"#E9E8E0",brand:"MINI"},
  {code:"C6B",name:"Melting Silver III",hex:"#AEB5B9",brand:"MINI"},
  {code:"C6D",name:"Resolute Bronze",hex:"#8C7761",brand:"MINI"},
  {code:"C6F",name:"Indigo Sunset Blue",hex:"#344B79",brand:"MINI"},
  {code:"C6K",name:"Blazing Blue",hex:"#1767A5",brand:"MINI"},
  {code:"C6M",name:"Ocean Wave Green",hex:"#347D72",brand:"MINI"},
  {code:"C6N",name:"Sunny Side Yellow",hex:"#E5D34A",brand:"MINI"},
  {code:"C6P",name:"Legend Grey",hex:"#737A80",brand:"MINI"},
  {code:"C70",name:"Slate Blue",hex:"#657F9B",brand:"MINI"},
  {code:"C71",name:"Smokey Green",hex:"#66796B",brand:"MINI"},
  {code:"C72",name:"Rebel Red",hex:"#B32A35",brand:"MINI"},
  {code:"C74",name:"Chili Red II",hex:"#B51F2A",brand:"MINI"},
  {code:"C77",name:"Copper Grey",hex:"#8C8178",brand:"MINI"}
];


const MOTOR_BY_MODEL: Array<{ test: RegExp; motor: string }> = [
  { test: /ACEMAN\s+SE/i, motor: "Eléctrico · SE · 160 kW (218 CV)" },
  { test: /COUNTRYMAN\s+E\b/i, motor: "Eléctrico · E · 150 kW (204 CV)" },
  { test: /COUNTRYMAN\s+SE\s+ALL4/i, motor: "Eléctrico · SE ALL4 · 230 kW (313 CV)" },
  { test: /BMW\s+M3\s+COMPETITION\s+M\s+XDRIVE\s+TOURING/i, motor: "Gasolina · 3.0 M TwinPower Turbo · 390 kW (530 CV) · M xDrive" },
  { test: /BMW\s+M3\s+COMPETITION/i, motor: "Gasolina · 3.0 M TwinPower Turbo · 390 kW (530 CV)" },
  { test: /X1.*sDRIVE18d/i, motor: "Diésel · 2.0 · 110 kW (150 CV) · sDrive" },
  { test: /X1.*sDRIVE20d/i, motor: "Diésel · 2.0 · 120 kW (163 CV) · sDrive" },
  { test: /X1.*xDRIVE20d/i, motor: "Diésel · 2.0 · 120 kW (163 CV) · xDrive" },
  { test: /iX1.*eDRIVE20/i, motor: "Eléctrico · eDrive20 · 150 kW (204 CV)" },
  { test: /iX1.*xDRIVE30/i, motor: "Eléctrico · xDrive30 · 230 kW (313 CV)" },
  { test: /X1.*sDRIVE18i/i, motor: "Gasolina · 1.5 · 100 kW (136 CV) · sDrive" },
  { test: /X2.*sDRIVE18d/i, motor: "Diésel · 2.0 · 110 kW (150 CV) · sDrive" },
  { test: /X3.*20d.*xDRIVE/i, motor: "Diésel · 2.0 · 140 kW (190 CV) · xDrive" },
  { test: /X5.*30d.*xDRIVE/i, motor: "Diésel · 3.0 · 210 kW (286 CV) · xDrive" },
  { test: /X5.*50e/i, motor: "Híbrido enchufable · 3.0 gasolina + eléctrico · xDrive" },
  { test: /X5.*40d.*xDRIVE/i, motor: "Diésel · 3.0 · 250 kW (340 CV) · xDrive" },
  { test: /X5.*30d.*xDRIVE/i, motor: "Diésel · 3.0 · 210 kW (286 CV) · xDrive" },
  { test: /M5.*TOURING/i, motor: "Híbrido enchufable · 4.4 V8 M TwinPower Turbo · M xDrive" },
  { test: /X2.*M35i.*xDRIVE/i, motor: "Gasolina · 2.0 M TwinPower Turbo · xDrive" },
  { test: /X2.*xDRIVE20d/i, motor: "Diésel · 2.0 · 120 kW (163 CV) · xDrive" },
  { test: /X2.*sDRIVE20d/i, motor: "Diésel · 2.0 · 120 kW (163 CV) · sDrive" },
  { test: /540d.*xDRIVE.*TOURING/i, motor: "Diésel · 3.0 mild hybrid · 223 kW (303 CV) · xDrive" },
  { test: /X3.*40d.*xDRIVE/i, motor: "Diésel · 3.0 · 250 kW (340 CV) · xDrive" },
  { test: /X3.*40d.*xDRIVE/i, motor: "Diésel · 3.0 · xDrive" },
  { test: /X3.*30d.*xDRIVE/i, motor: "Diésel · 3.0 · xDrive" },
  { test: /X3.*20d.*xDRIVE/i, motor: "Diésel · 2.0 · 140 kW (190 CV) · xDrive" },
  { test: /X3.*20i.*xDRIVE/i, motor: "Gasolina · 2.0 · xDrive" },
  { test: /X1.*xDRIVE23d/i, motor: "Diésel · 2.0 · xDrive" },
  { test: /X1.*xDRIVE25e/i, motor: "Híbrido enchufable · 1.5 gasolina + eléctrico · xDrive" },
  { test: /120d/i, motor: "Diésel · 2.0 · 120 kW (163 CV)" },
  { test: /118d/i, motor: "Diésel · 2.0 · 110 kW (150 CV)" },
  { test: /320d/i, motor: "Diésel · 2.0 · 140 kW (190 CV)" },
  { test: /330d/i, motor: "Diésel · 3.0 · 210 kW (286 CV)" },
  { test: /420d.*GRAN\s+COUPE|420\s+D\s+GC/i, motor: "Diésel · 2.0 · 140 kW (190 CV)" },
  { test: /330e/i, motor: "Híbrido enchufable · 2.0 gasolina + eléctrico · 215 kW (292 CV)" },
  { test: /X2.*xDRIVE\s*2\.0\s*D/i, motor: "Diésel · 2.0 · xDrive" },
  { test: /520d.*xDRIVE/i, motor: "Diésel · 2.0 · xDrive" },
  { test: /520d/i, motor: "Diésel · 2.0" },
  { test: /i5.*xDRIVE40/i, motor: "Eléctrico · xDrive · 290 kW (394 CV)" },
  { test: /i5.*eDRIVE40/i, motor: "Eléctrico · eDrive · 250 kW (340 CV)" },
];
export function suggestedMotor(model: string) {
  return MOTOR_BY_MODEL.find(item => item.test.test(model.trim()))?.motor || "";
}
export function suggestedColor(model: string) {
  const value = model.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return BMW_COLORS.find(c => value.includes(c.name.toLowerCase().replace(" metallic", " metalizado")) || value.includes(c.name.toLowerCase())) || null;
}


export function getVehicleColor(vehicle: any) {
  const code = String(vehicle?.colorCodigo || vehicle?.colorBMW || "").trim().toUpperCase();
  if (code) {
    const byCode = BMW_COLORS.find(c => c.code === code);
    if (byCode) return byCode;
  }
  const raw = String(vehicle?.colorExterior || vehicle?.colorCorreo || "");
  const name = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\bmetalizado\b/g, "metallic");
  const aliases: Array<[RegExp, string]> = [
    [/black sapphire/, "475"], [/brooklyn grey/, "C4P"], [/fire red/, "C68"],
    [/skyscraper grey/, "C4W"], [/dravit grey/, "C36"], [/arctic race blue/, "C4R"],
    [/portimao blue/, "C31"], [/alpine white/, "300"], [/carbon black/, "416"],
    [/sophisto grey/, "A90"], [/black uni/, "668"], [/mineral white/, "A96"],
    [/san remo green/, "C6K"], [/isle of man green/, "C6M"], [/vegas red/, "C77"]
  ];
  const match = aliases.find(([pattern]) => pattern.test(name));
  if (match) return BMW_COLORS.find(c => c.code === match[1]) || null;
  if (/\bgris\b|grey|gray/.test(name)) return { code: "GEN-GREY", name: raw || "Gris", hex: "#85898d" };
  if (/\bazul\b|blue/.test(name)) return { code: "GEN-BLUE", name: raw || "Azul", hex: "#2864a0" };
  if (/\bnegro\b|black/.test(name)) return { code: "GEN-BLACK", name: raw || "Negro", hex: "#202124" };
  if (/\brojo\b|red/.test(name)) return { code: "GEN-RED", name: raw || "Rojo", hex: "#a5161a" };
  return null;
}

export const TIPOS_LOGISTICOS = [
  "Stock Expo",
  "Entrega Renting",
  "Entrega Cliente",
  "Demo",
  "Devolucion Renting"
];

const ESTADOS = ["Exposicion", "Stock", "Demo", "Reservado", "Preparacion Entrega", "Entregado", "Cedido"];
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
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [movingVehicleId, setMovingVehicleId] = useState<string | null>(null);
  const [draggedPlaza, setDraggedPlaza] = useState<string | null>(null);
  const [isStockSheetOpen, setIsStockSheetOpen] = useState(false);

  const [formData, setFormData] = useState({
    marca: "BMW", modelo: "", vin: "", vin7: "", matricula: "", kilometraje: "", motor: "",
    colorBMW: "300", tapiceria: "", llantas: "", equipamiento: "", bodyType: "SUV",
    ubicacion: "Stock", estado: "Stock", tipoLogistico: "Stock Expo", entidadRenting: "",
    precio: "", responsable: "", observaciones: ""
  });

  const vehiculos = useMemo(() => (vehiculosRaw || []) as any[], [vehiculosRaw]);
  const pendingStock = useMemo(() => vehiculos.filter(v => !/^P\d+$/i.test(String(v.ubicacion || "")) && v.estado !== "Entregado"), [vehiculos]);
  const selectedVehicle = useMemo(() => vehiculos.find(v => v.id === selectedVehicleId), [vehiculos, selectedVehicleId]);
  const vehicleColorOptions = useMemo(() => BMW_COLORS.filter(c => c.brand === (/^MINI\\b/i.test(selectedVehicle?.modelo || "") || selectedVehicle?.marca === "MINI" ? "MINI" : "BMW")), [selectedVehicle]);
  const newVehicleColorOptions = useMemo(() => BMW_COLORS.filter(c => c.brand === formData.marca), [formData.marca]);

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
                    <div className="space-y-1"><Label>Modelo / versión</Label><Input value={selectedVehicle.modelo || ""} onChange={e => { const model=e.target.value; const motor=suggestedMotor(model); const color=suggestedColor(model); handleUpdateVehicle(selectedVehicle.id,{modelo:model,...(motor?{motor}:{}),...(color?{colorCodigo:color.code,colorBMW:color.code,colorExterior:color.name}:{})}); }}/></div>
                    <div className="space-y-1"><Label>Marca</Label><Input value={/^MINI\b/i.test(selectedVehicle.modelo || "") ? "MINI" : (selectedVehicle.marca || "BMW")} readOnly className="bg-slate-50"/></div>
                    <div className="space-y-1 md:col-span-2"><Label>Bastidor completo (VIN)</Label><Input value={selectedVehicle.vin || ""} onChange={e => handleUpdateVehicle(selectedVehicle.id,{vin:e.target.value.toUpperCase(),vin7:e.target.value.slice(-7).toUpperCase()})}/></div>
                    <div className="space-y-1"><Label>Matrícula</Label><Input value={selectedVehicle.matricula || ""} onChange={e => handleUpdateVehicle(selectedVehicle.id,{matricula:e.target.value.toUpperCase()})}/></div>
                    <div className="space-y-1"><Label>Motorización</Label><Input value={selectedVehicle.motor || suggestedMotor(selectedVehicle.modelo || "")} onChange={e => handleUpdateVehicle(selectedVehicle.id,{motor:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Carrocería</Label><Select value={selectedVehicle.bodyType || "SUV"} onValueChange={v => handleUpdateVehicle(selectedVehicle.id,{bodyType:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["SUV","Berlina","Coupe","Roadster","Touring","Compacto","Cabrio"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </section>
                <section className="bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-black uppercase text-secondary">Configuración y acabado</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Color exterior</Label><div className="flex items-center gap-2"><span className="h-9 w-9 shrink-0 rounded-md border border-slate-300 shadow-inner" style={{backgroundColor:getVehicleColor(selectedVehicle)?.hex||"#e5e7eb"}}/><Select value={selectedVehicle.colorCodigo || selectedVehicle.colorBMW || (getVehicleColor(selectedVehicle) && BMW_COLORS.some(c=>c.code===getVehicleColor(selectedVehicle)?.code) ? getVehicleColor(selectedVehicle)!.code : (selectedVehicle.colorExterior ? `correo:${selectedVehicle.colorExterior}` : "300"))} onValueChange={v => v.startsWith("correo:") ? handleUpdateVehicle(selectedVehicle.id,{colorExterior:v.slice(7),colorCorreo:v.slice(7)}) : handleUpdateVehicle(selectedVehicle.id,{colorCodigo:v,colorBMW:v,colorExterior:BMW_COLORS.find(c=>c.code===v)?.name || ""})}><SelectTrigger className="flex-1"><SelectValue/></SelectTrigger><SelectContent className="max-h-64">{selectedVehicle.colorExterior && !BMW_COLORS.some(c=>c.name.toLowerCase()===String(selectedVehicle.colorExterior).toLowerCase()) && <SelectItem value={`correo:${selectedVehicle.colorExterior}`}>{selectedVehicle.colorExterior} · Correo BMW</SelectItem>}<SelectGroup><SelectLabel className="text-xs font-bold uppercase tracking-wider text-blue-700">Colores BMW</SelectLabel>{vehicleColorOptions.filter(c=>c.brand==="BMW").map(c=><SelectItem key={c.code} value={c.code}><span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border border-slate-400 shadow-sm" style={{backgroundColor:c.hex}}/><span>{c.code} · {c.name}</span></span></SelectItem>)}</SelectGroup><SelectSeparator/><SelectGroup><SelectLabel className="text-xs font-bold uppercase tracking-wider text-blue-700">Colores MINI</SelectLabel>{vehicleColorOptions.filter(c=>c.brand==="MINI").map(c=><SelectItem key={c.code} value={c.code}><span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border border-slate-400 shadow-sm" style={{backgroundColor:c.hex}}/><span>{c.code} · {c.name}</span></span></SelectItem>)}</SelectGroup></SelectContent></Select></div></div>
                    <div className="space-y-1"><Label>Tapicería / interior</Label><Input value={selectedVehicle.tapiceria || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{tapiceria:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Llantas</Label><Input value={selectedVehicle.llantas || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{llantas:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Equipamiento / paquetes</Label><Input value={selectedVehicle.equipamiento || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{equipamiento:e.target.value})}/></div>
                  </div>
                </section>
                <section className="bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-black uppercase text-secondary">Gestión comercial y logística</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Cliente / destino del correo</Label><Input value={selectedVehicle.clienteLogistica || selectedVehicle.destinoLogistico || selectedVehicle.tipoLogistico || ""} readOnly className="bg-slate-50"/></div>
                    <div className="space-y-1"><Label>Estado</Label><Select value={selectedVehicle.estado || "Stock"} onValueChange={v=>handleUpdateVehicle(selectedVehicle.id,{estado:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{ESTADOS.map(e=><SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Ubicación física</Label><Select value={selectedVehicle.ubicacion || "Entreplanta"} onValueChange={v=>handleUpdateVehicle(selectedVehicle.id,{ubicacion:v, estado:v==="Demo en uso"?"Demo en uso":selectedVehicle.estado})}><SelectTrigger><SelectValue placeholder="Seleccionar ubicación"/></SelectTrigger><SelectContent><SelectItem value="Entreplanta">Entreplanta</SelectItem><SelectItem value="Terraza">Terraza</SelectItem><SelectItem value="Zona de entrega">Zona de entrega</SelectItem><SelectItem value="Demo en uso">Demo en uso</SelectItem><Separator className="my-1"/>{Array.from(new Set([...PLAZAS_LIST,...vehiculos.map(v=>String(v.ubicacion||"")).filter(v=>/^P\d+$/i.test(v))])).map(p=><SelectItem key={p} value={p}>Exposición · {p}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Fecha de entrada</Label><Input type="date" value={selectedVehicle.fechaEntrada || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{fechaEntrada:e.target.value})}/></div>
                    <div className="space-y-1"><Label>Responsable</Label><Input value={selectedVehicle.responsable || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{responsable:e.target.value})}/></div>
                    {selectedVehicle.ubicacion === "Demo en uso" && <div className="space-y-1 md:col-span-2"><Label>Persona que tiene el demo</Label><Input value={selectedVehicle.demoAsignadoA || ""} onChange={e=>handleUpdateVehicle(selectedVehicle.id,{demoAsignadoA:e.target.value})} placeholder="Nombre y apellidos"/></div>}
                    <div className="space-y-1"><Label>Vendedor (correo BMW)</Label><Input value={selectedVehicle.vendedorLogistica || ""} readOnly className="bg-slate-50"/></div>
                    <div className="space-y-1"><Label>Fecha recepción</Label><Input value={selectedVehicle.fechaRecepcionCorreo || ""} readOnly className="bg-slate-50"/></div>
                    <div className="space-y-1"><Label>Llegada</Label><Input value={selectedVehicle.llegada || ""} readOnly className="bg-slate-50"/></div>
                    <div className="space-y-1"><Label>Comisión</Label><Input value={selectedVehicle.comision || ""} readOnly className="bg-slate-50"/></div>
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
    const vin7 = formData.vin7.trim().toUpperCase();
    if (!formData.modelo.trim() || vin7.length !== 7) return toast({ variant: "destructive", title: "Faltan datos", description: "Indica el modelo y los últimos 7 caracteres del bastidor (VIN7)." });
    if (vin && (vin.length !== 17 || /[IOQ]/.test(vin))) return toast({ variant: "destructive", title: "Bastidor no válido", description: "El VIN completo debe tener 17 caracteres y no contener I, O ni Q." });
    if (vehiculos.some(v => (v.vin7 || (String(v.vin || "").length===7 ? v.vin : "")).toUpperCase() === vin7 || (vin && (v.vin || "").toUpperCase() === vin))) return toast({ variant: "destructive", title: "Vehículo duplicado", description: "Ya existe un vehículo con ese VIN7 o bastidor." });
    const now = new Date().toISOString();
    const payload = { ...formData, modelo: formData.modelo.trim(), vin, vin7, kilometraje: null, precio: formData.precio === "" ? null : Number(formData.precio), colorCodigo: formData.colorBMW, colorExterior: BMW_COLORS.find(c => c.code === formData.colorBMW)?.name || "Alpine White", fechaEntrada: now.split('T')[0], createdAt: now, updatedAt: now };
    try {
      await addDoc(collection(db, "vehiculos"), payload);
      toast({ title: "Vehículo Registrado" });
      setIsAddingNew(false);
      setFormData({ marca: "BMW", modelo: "", vin: "", vin7: "", matricula: "", kilometraje: "", motor: "", colorBMW: "300", tapiceria: "", llantas: "", equipamiento: "", bodyType: "SUV", ubicacion: "Stock", estado: "Stock", tipoLogistico: "Stock Expo", entidadRenting: "", precio: "", responsable: "", observaciones: "" });
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