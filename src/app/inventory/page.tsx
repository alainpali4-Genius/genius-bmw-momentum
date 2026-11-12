
'use client';

import { useState, useRef, useMemo } from "react";
import { 
  Camera, CheckCircle2, AlertCircle, History, RefreshCw, Car, ChevronRight, Scan, Loader2, Zap, Clock, Plus, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, addDoc, limit, doc, updateDoc } from "firebase/firestore";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BMW_COLORS, TIPOS_LOGISTICOS } from "../showroom/page";

const compressImage = (file: File, maxWidth = 1600, quality = 0.82): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onerror = () => reject("Error al cargar la imagen");
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("Canvas Error");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
  });
};


const loadLocalOcr = async (): Promise<any> => {
  if ((window as any).Tesseract) return (window as any).Tesseract;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-genius-tesseract="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("No se ha podido cargar el motor OCR.")), { once: true });
      if ((window as any).Tesseract) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    script.async = true;
    script.dataset.geniusTesseract = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se ha podido cargar el lector local. Comprueba la conexión del móvil."));
    document.head.appendChild(script);
  });
  const engine = (window as any).Tesseract;
  if (!engine?.recognize) throw new Error("El lector OCR no está disponible en este navegador.");
  return engine;
};

const normalizeOcr = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0");

export default function InventarioGenius() {
  const db = useFirestore();
  const { toast } = useToast();
  const { data: vehiculosRaw } = useCollection(collection(db, "vehiculos"));
  const movementsQuery = useMemo(() => query(collection(db, "movimientos"), orderBy("fecha", "desc"), limit(20)), [db]);
  const { data: movementsRaw, loading: movementsLoading } = useCollection(movementsQuery);
  const movements = (movementsRaw || []) as any[];
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string | null>(null);
  const [lastAudit, setLastAudit] = useState<any>(null);
  const [manualVin, setManualVin] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isNewVehicleDialogOpen, setIsNewVehicleDialogOpen] = useState(false);
  const [newVehicleData, setNewVehicleData] = useState({
    modelo: "",
    vin: "",
    vin7: "",
    colorBMW: "300",
    bodyType: "SUV",
    ubicacion: "Stock",
    tipoLogistico: "Stock Expo",
    entidadRenting: ""
  });

  const vehiculos = (vehiculosRaw || []) as any[];

  const handleAudit = async (vinToFind: string, aiResult?: { modelo?: string }) => {
    if (!vinToFind) return;
    const vinNorm = vinToFind.trim().toUpperCase();
    const vin7 = vinNorm.length >= 7 ? vinNorm.slice(-7) : vinNorm;
    
    const vehicle = vehiculos.find(v => 
      v.vin === vinNorm || v.vin7 === vin7 || v.vin?.endsWith(vin7)
    );

    if (vehicle) {
      const payload = {
        vehiculoId: vehicle.id,
        vehiculoInfo: `${vehicle.modelo} (${vehicle.vin7})`,
        tipoAccion: 'Inventario',
        fecha: new Date().toISOString(),
        origen: vehicle.ubicacion || "N/A",
        destino: vehicle.ubicacion || "N/A",
        usuario: "GENIUS IA",
        detalles: "Inventario verificado mediante lectura OCR local."
      };
      try {
        await addDoc(collection(db, "movimientos"), payload);
        setLastAudit({ ...vehicle, vin: vinNorm, status: 'success', message: 'UBICACIÓN CONFIRMADA' });
        setManualVin("");
        toast({ title: "Vehículo Localizado", description: `${vehicle.modelo} en ${vehicle.ubicacion}` });
      } catch (e) {
        toast({ variant: "destructive", title: "Error al registrar auditoría" });
      }
    } else {
      setLastAudit({ vin: vinNorm, status: 'error', message: 'BASTIDOR NO ENCONTRADO EN STOCK' });
      setNewVehicleData({
        modelo: aiResult?.modelo || "",
        vin: vinNorm,
        vin7: vin7,
        colorBMW: "300",
        bodyType: "SUV",
        ubicacion: "Stock",
        tipoLogistico: "Stock Expo",
        entidadRenting: ""
      });
      setIsNewVehicleDialogOpen(true);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setProcessStep("Preparando fotografía...");
    try {
      const image = await compressImage(file, 2200, 0.94);
      setProcessStep("Cargando reconocimiento local...");
      const ocr = await loadLocalOcr();
      setProcessStep("Leyendo el número de bastidor...");
      const result = await ocr.recognize(image, "eng", {
        logger: (info: any) => {
          if (info?.status === "recognizing text") {
            setProcessStep(`Leyendo placa: ${Math.round((info.progress || 0) * 100)}%`);
          }
        },
      });
      const rawText = String(result?.data?.text || "");
      const compact = normalizeOcr(rawText);
      const fullVin = compact.match(/[A-HJ-NPR-Z0-9]{17}/)?.[0];

      // Primero se intenta identificar un VIN7 que coincida con un vehículo real del stock.
      const stockMatches = vehiculos.filter((vehicle: any) => {
        const known = String(vehicle.vin7 || vehicle.vin || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (known.length < 7) return false;
        const key = known.slice(-7);
        return compact.includes(key) || compact.includes(key.replace(/0/g, "O"));
      });

      if (stockMatches.length === 1) {
        setProcessStep("Vehículo localizado en stock...");
        await handleAudit(stockMatches[0].vin7 || stockMatches[0].vin);
        return;
      }

      if (stockMatches.length > 1) {
        toast({ variant: "destructive", title: "Lectura ambigua", description: "Se han encontrado varias coincidencias. Introduce manualmente los últimos 7 caracteres." });
        return;
      }

      if (fullVin) {
        setProcessStep("Comprobando bastidor...");
        await handleAudit(fullVin);
        return;
      }

      // Si la placa solo deja leer siete caracteres, se muestran para validación manual.
      const candidates = rawText.toUpperCase().match(/[A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9\s-]{5,12}[A-HJ-NPR-Z0-9]/g) || [];
      const seven = candidates
        .map((candidate: string) => candidate.replace(/[^A-Z0-9]/g, ""))
        .filter((candidate: string) => candidate.length >= 7)
        .map((candidate: string) => candidate.slice(-7))
        .find((candidate: string) => /^[A-HJ-NPR-Z0-9]{7}$/.test(candidate));

      if (seven) {
        setManualVin(seven);
        toast({ title: "VIN7 leído", description: "Revisa los 7 caracteres detectados y pulsa la flecha para buscar el vehículo." });
      } else {
        toast({ variant: "destructive", title: "No se distingue el bastidor", description: "Prueba otra foto más cerca, enfocada y sin reflejos. También puedes introducir el VIN7 manualmente." });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error en el lector de placa", description: err?.message || "No se ha podido leer la fotografía." });
    } finally {
      setIsProcessing(false);
      setProcessStep(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateNewVehicle = async () => {
    if (!newVehicleData.modelo || !newVehicleData.vin) return toast({ variant: "destructive", title: "Faltan datos" });
    const color = BMW_COLORS.find(c => c.code === newVehicleData.colorBMW);
    const payload = { ...newVehicleData, vin: newVehicleData.vin.toUpperCase(), vin7: newVehicleData.vin7.toUpperCase(), colorExterior: color?.name || "Alpine White", colorCodigo: newVehicleData.colorBMW, estado: "Stock", fechaEntrada: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    try {
      const docRef = await addDoc(collection(db, "vehiculos"), payload);
      await addDoc(collection(db, "movimientos"), {
        vehiculoId: docRef.id,
        vehiculoInfo: `${payload.modelo} (${payload.vin7})`,
        tipoAccion: 'Inventario',
        fecha: new Date().toISOString(),
        origen: "N/A",
        destino: payload.ubicacion,
        usuario: "GENIUS IA",
        detalles: "Alta mediante lectura OCR local."
      });
      setIsNewVehicleDialogOpen(false);
      setLastAudit({ ...payload, id: docRef.id, status: 'success', message: 'VEHÍCULO REGISTRADO Y AUDITADO' });
      toast({ title: "Vehículo Registrado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50"><div className="mx-auto max-w-[1200px] space-y-6 px-5 py-7 pb-10 md:px-8 md:py-9">
      <div className="flex flex-col gap-0.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0066b3]">Operaciones · Momentum Navarra</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Inventario y movimientos</h1>
        <p className="mt-1 text-sm text-slate-500">Identificación rápida por fotografía del bastidor o introducción manual del VIN7.</p>
      </div>

      <Card className="overflow-hidden rounded-xl border-slate-200/80 bg-white text-slate-900 shadow-sm">
        <CardContent className="flex flex-col items-center space-y-5 p-7 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-[#0066b3]">
            {isProcessing ? <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" /> : <Scan className="w-8 h-8 text-white" />}
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{isProcessing ? "LEYENDO PLACA..." : "ESCANEAR PLACA VIN"}</h2>
            <p className="text-sm text-slate-500">{processStep || "Fotografía los últimos 7 caracteres o la placa VIN completa"}</p>
          </div>
          <div className="w-full max-w-sm space-y-3">
            <Button size="lg" className="h-12 w-full rounded-lg bg-[#0066b3] text-sm font-semibold text-white shadow-none hover:bg-[#00549a]" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
              <Camera className="mr-2 w-5 h-5" /> {isProcessing ? "AUDITANDO..." : "ABRIR CÁMARA"}
            </Button>
            <div className="flex gap-2">
              <Input placeholder="VIN7 MANUAL..." className="h-11 rounded-lg border-slate-200 text-center text-sm text-slate-900 placeholder:text-slate-400" value={manualVin} onChange={e => setManualVin(e.target.value)} />
              <Button onClick={() => handleAudit(manualVin)} className="h-11 w-11 shrink-0 rounded-lg bg-slate-100 p-0 text-slate-700 hover:bg-slate-200"><ChevronRight className="w-5 h-5" /></Button>
            </div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
        </CardContent>
      </Card>

      {lastAudit && (
        <Card className={cn("premium-card border-l-[6px] rounded-2xl shadow-md bg-white animate-in slide-in-from-bottom-5", lastAudit.status === 'success' ? 'border-l-emerald-500' : 'border-l-red-500')}>
          <CardContent className="p-6">
            <div className="flex gap-4 items-center">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", lastAudit.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                {lastAudit.status === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Resultado de Operación</p>
                <h3 className="font-black text-secondary uppercase text-sm truncate">{lastAudit.modelo || 'BASTIDOR DESCONOCIDO'}</h3>
                <p className="font-mono text-[9px] font-bold text-slate-400 tracking-widest truncate">{lastAudit.vin}</p>
                <p className={cn("text-[8px] font-black uppercase mt-2", lastAudit.status === 'success' ? 'text-emerald-600' : 'text-red-600')}>{lastAudit.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden rounded-xl border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-semibold text-slate-900">Actividad reciente</h2><p className="mt-1 text-xs text-slate-500">Últimos movimientos y auditorías registrados.</p></div><Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-600">{movements.length} registros</Badge></div>
        <div className="divide-y divide-slate-100">
          {movementsLoading ? <p className="p-6 text-sm text-slate-400">Cargando actividad…</p> : movements.length === 0 ? <p className="p-6 text-sm text-slate-400">Todavía no hay movimientos registrados.</p> : movements.map((movement: any) => <div key={movement.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{movement.vehiculoInfo || 'Movimiento de vehículo'}</p><p className="mt-1 text-xs text-slate-500">{movement.detalles || movement.tipoAccion || 'Actividad registrada'}</p></div><div className="flex shrink-0 items-center gap-2"><Badge variant="outline" className="border-slate-200 text-[10px]">{movement.tipoAccion || 'Movimiento'}</Badge><span className="text-xs text-slate-400">{movement.fecha ? format(new Date(movement.fecha), 'dd/MM/yyyy HH:mm', { locale: es }) : '—'}</span></div></div>)}
        </div>
      </Card>

      <Dialog open={isNewVehicleDialogOpen} onOpenChange={setIsNewVehicleDialogOpen}>
        <DialogContent className="p-0 border-none rounded-3xl overflow-hidden max-w-[90vw] md:max-w-md shadow-2xl">
          <div className="bg-[#0066b3] p-5 text-center text-sm font-semibold text-white">ALTA DE VEHÍCULO · VIN RECONOCIDO</div>
          <div className="p-6 space-y-4 bg-white max-h-[80vh] overflow-y-auto">
            <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Modelo Detectado</Label><Input value={newVehicleData.modelo} onChange={e => setNewVehicleData({...newVehicleData, modelo: e.target.value})} className="h-11 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]" /></div>
            <div className="space-y-1">
              <Label className="text-[8px] font-black uppercase text-slate-400 px-1">Tipo Logístico</Label>
              <Select value={newVehicleData.tipoLogistico} onValueChange={v => setNewVehicleData({...newVehicleData, tipoLogistico: v})}>
                <SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-bold text-[9px] px-3"><SelectValue/></SelectTrigger>
                <SelectContent>{TIPOS_LOGISTICOS.map(t => <SelectItem key={t} value={t} className="text-[9px] uppercase font-bold">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(newVehicleData.tipoLogistico.includes('Renting') || newVehicleData.tipoLogistico === 'Entrega Cliente') && (
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-400 px-1">{newVehicleData.tipoLogistico === 'Entrega Cliente' ? 'Nombre Cliente' : 'Empresa Renting'}</Label>
                <Input value={newVehicleData.entidadRenting} onChange={e => setNewVehicleData({...newVehicleData, entidadRenting: e.target.value})} className="h-11 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Color BMW</Label><Select value={newVehicleData.colorBMW} onValueChange={v => setNewVehicleData({...newVehicleData, colorBMW: v})}><SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-bold text-[9px] px-3"><SelectValue/></SelectTrigger><SelectContent className="max-h-[200px]">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code} className="text-[9px]">{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Ubicación</Label><Select value={newVehicleData.ubicacion} onValueChange={v => setNewVehicleData({...newVehicleData, ubicacion: v})}><SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-bold text-[9px] px-3"><SelectValue/></SelectTrigger><SelectContent>{["Stock", "Terraza", "Entreplanta", "Lavadero"].map(u => <SelectItem key={u} value={u} className="text-[9px] uppercase">{u}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Button onClick={handleCreateNewVehicle} className="mt-2 h-12 w-full rounded-lg bg-[#0066b3] text-sm font-semibold text-white hover:bg-[#00549a]">CONFIRMAR ALTA UNIDAD</Button>
          </div>
        </DialogContent>
      </Dialog>
      </div></div>
  );
}
