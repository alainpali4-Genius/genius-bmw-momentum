
'use client';

import { useState, useRef, useMemo } from "react";
import { Camera, CheckCircle2, AlertCircle, RefreshCw, Car, ChevronRight, Scan, Loader2 } from "lucide-react";
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
import { BMW_COLORS, TIPOS_LOGISTICOS } from "@/lib/vehicle-constants";

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

const suggestedScannerMotor = (model: string) => {
  const value = model.trim().toLowerCase();
  if (/^420d$/.test(value)) return "Diésel · 2.0 · 140 kW (190 CV)";
  if (/^320d$/.test(value)) return "Diésel · 2.0 · 140 kW (190 CV)";
  if (/^330d$/.test(value)) return "Diésel · 3.0 · 210 kW (286 CV)";
  if (/^520d$/.test(value)) return "Diésel · 2.0";
  if (/^118d$/.test(value)) return "Diésel · 2.0 · 110 kW (150 CV)";
  if (/^120d$/.test(value)) return "Diésel · 2.0 · 120 kW (163 CV)";
  return "";
};

export function ScannerPanel({ compact = false }: { compact?: boolean }) {
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
    motor: "",
    vin: "",
    vin7: "",
    colorBMW: "",
    bodyType: "SUV",
    ubicacion: "Stock",
    tipoLogistico: "Stock Expo",
    entidadRenting: ""
  });

  const vehiculos = (vehiculosRaw || []) as any[];

  const handleAudit = async (vinToFind: string, aiResult?: { modelo?: string; colorCode?: string }) => {
    if (!vinToFind) return;
    const vinNorm = vinToFind.trim().toUpperCase();
    const vin7 = vinNorm.length >= 7 ? vinNorm.slice(-7) : vinNorm;
    
    const vehicle = vehiculos.find(v => 
      v.vin === vinNorm || v.vin7 === vin7 || v.vin?.endsWith(vin7)
    );

    if (vehicle) {
      const detectedColor = aiResult?.colorCode ? BMW_COLORS.find(c => c.code === aiResult.colorCode) : undefined;
      const enrichment: Record<string, any> = {};
      if (!vehicle.modelo && aiResult?.modelo) enrichment.modelo = aiResult.modelo;
      if (!vehicle.colorCodigo && aiResult?.colorCode) enrichment.colorCodigo = aiResult.colorCode;
      if (!vehicle.colorExterior && detectedColor) enrichment.colorExterior = detectedColor.name;
      if (Object.keys(enrichment).length) await updateDoc(doc(db, "vehiculos", vehicle.id), { ...enrichment, updatedAt: new Date().toISOString() });
      const payload = {
        vehiculoId: vehicle.id,
        vehiculoInfo: `${vehicle.modelo} (${vehicle.vin7})`,
        tipoAccion: 'Inventario',
        fecha: new Date().toISOString(),
        origen: vehicle.ubicacion || "N/A",
        destino: vehicle.ubicacion || "N/A",
        usuario: "GENIUS IA",
        detalles: "Identificación realizada desde Escáner VIN."
      };
      try {
        await addDoc(collection(db, "movimientos"), payload);
        setLastAudit({ ...vehicle, ...enrichment, vin: vinNorm, colorCodigo: enrichment.colorCodigo || vehicle.colorCodigo || aiResult?.colorCode, colorExterior: enrichment.colorExterior || vehicle.colorExterior || detectedColor?.name, status: 'success', message: 'VEHÍCULO YA EXISTE EN STOCK · ' + (vehicle.ubicacion || 'SIN UBICACIÓN') });
        setManualVin("");
        toast({ title: "Vehículo ya registrado", description: `${vehicle.modelo || "Modelo pendiente"} · ${vehicle.ubicacion || "Sin ubicación"}. No se ha creado un duplicado.` });
      } catch (e) {
        toast({ variant: "destructive", title: "Error al registrar auditoría" });
      }
    } else {
      setLastAudit({ vin: vinNorm, status: 'error', message: 'BASTIDOR NO ENCONTRADO EN STOCK' });
      setNewVehicleData({
        modelo: aiResult?.modelo || "",
        motor: aiResult?.modelo ? suggestedScannerMotor(aiResult.modelo) : "",
        vin: vinNorm,
        vin7: vin7,
        colorBMW: BMW_COLORS.some(c => c.code === aiResult?.colorCode) ? aiResult!.colorCode! : "",
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
    setProcessStep("Preparando imagen para lectura local...");
    try {
      const photoDataUri = await compressImage(file, 2600, 0.96);
      setProcessStep("Cargando lector OCR en el dispositivo...");
      const engine = await loadLocalOcr();
      const image = new Image(); image.src = photoDataUri;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("No se ha podido preparar la fotografía.")); });
      const variants: string[] = [];
      for (const threshold of [null, 155, 190]) {
        const canvas = document.createElement("canvas");
        const scale = Math.min(2, 3200 / Math.max(image.width, image.height));
        canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("El navegador no permite procesar la fotografía.");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        if (threshold !== null) {
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < pixels.data.length; i += 4) {
            const gray = pixels.data[i] * 0.299 + pixels.data[i + 1] * 0.587 + pixels.data[i + 2] * 0.114;
            const value = gray > threshold ? 255 : 0;
            pixels.data[i] = value; pixels.data[i + 1] = value; pixels.data[i + 2] = value;
          }
          ctx.putImageData(pixels, 0, 0);
        }
        variants.push(canvas.toDataURL("image/png"));
      }
      let recognized = "";
      const recognizedCandidates: string[] = [];
      let plateText = "";
      const bmwWmi = /^(WBA|WBS|WBY|WBX|WMW|3MW|5UX|5YM|4US|4WZ)/;
      // Leer las tres versiones completas aunque el VIN aparezca pronto: el modelo y
      // el código de pintura están en la columna izquierda de la placa.
      for (let i = 0; i < variants.length; i++) {
        setProcessStep("Leyendo bastidor, modelo y color (" + (i + 1) + "/3)...");
        const result = await engine.recognize(variants[i], "eng", { tessedit_char_whitelist: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789", preserve_interword_spaces: "1", tessedit_pageseg_mode: "11" });
        const text = String(result?.data?.text || "");
        plateText += "\n" + text;
        const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/[IQ]/g, "1");
        const matches = compact.match(/(?:WBA|WBS|WBY|WBX|WMW|3MW|5UX|5YM|4US|4WZ)[A-Z0-9]{14}/g) || [];
        const valid = matches.find(candidate => candidate.length === 17 && bmwWmi.test(candidate) && /^[A-HJ-NPR-Z0-9]{17}$/.test(candidate));
        if (valid) recognizedCandidates.push(valid);
      }
      if (!recognizedCandidates.length) throw new Error("No se ha podido extraer el bastidor completo. Prueba una foto más cercana, enfocada y sin reflejos, o introduce el VIN7 manualmente.");
      const candidateCounts = recognizedCandidates.reduce((counts, candidate) => { counts[candidate] = (counts[candidate] || 0) + 1; return counts; }, {} as Record<string, number>);
      recognized = Object.entries(candidateCounts).sort((a, b) => b[1] - a[1])[0][0];


      // Lectura dedicada de la columna izquierda de la placa BMW.
      // Se amplían por separado las zonas del modelo y del código de pintura.
      const detailTexts: string[] = [];
      const readPlateCrop = async (x: number, y: number, w: number, h: number) => {
        const sx = Math.max(0, Math.round(image.width * x));
        const sy = Math.max(0, Math.round(image.height * y));
        const sw = Math.min(image.width - sx, Math.round(image.width * w));
        const sh = Math.min(image.height - sy, Math.round(image.height * h));
        if (sw < 20 || sh < 20) return;
        const crop = document.createElement("canvas");
        crop.width = sw * 6;
        crop.height = sh * 6;
        const ctx = crop.getContext("2d");
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
        for (const psm of ["6", "11", "12", "13"]) {
          const result = await engine.recognize(crop.toDataURL("image/png"), "eng", {
            preserve_interword_spaces: "1",
            tessedit_pageseg_mode: psm,
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
          });
          detailTexts.push(String(result?.data?.text || ""));
        }
        const pixels = ctx.getImageData(0, 0, crop.width, crop.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const gray = pixels.data[i] * 0.299 + pixels.data[i + 1] * 0.587 + pixels.data[i + 2] * 0.114;
          const value = gray > 150 ? 255 : 0;
          pixels.data[i] = value; pixels.data[i + 1] = value; pixels.data[i + 2] = value;
        }
        ctx.putImageData(pixels, 0, 0);
        for (const psm of ["6", "11", "13"]) {
          const result = await engine.recognize(crop.toDataURL("image/png"), "eng", {
            preserve_interword_spaces: "1",
            tessedit_pageseg_mode: psm,
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
          });
          detailTexts.push(String(result?.data?.text || ""));
        }
      };
      // Placa: texto vertical de identificación en el lateral izquierdo.
      await readPlateCrop(0.01, 0.14, 0.27, 0.58);
      await readPlateCrop(0.01, 0.22, 0.24, 0.27);
      await readPlateCrop(0.01, 0.43, 0.24, 0.25);

      const detailRaw = detailTexts.join("\n");
      plateText += "\n" + detailRaw;
      const detailCompact = detailRaw.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/[|Il]/g, "1");
      const modelMatch = detailCompact.match(/(?:118|120|318|320|330|418|420|430|518|520|530|630|640|718|720|730|740|840|850)[DIE0]/);
      const modelDetected = modelMatch
        ? modelMatch[0].slice(0, -1) + (modelMatch[0].endsWith("0") ? "d" : modelMatch[0].slice(-1).toLowerCase())
        : "";
      const colorAliases: Record<string, string[]> = {
        A96: ["A96", "A9G", "A9B", "A9S"],
        A83: ["A83", "A8B", "A8S"],
        A52: ["A52", "AS2"],
        A75: ["A75", "A7S"],
        B39: ["B39", "B3G"],
        B45: ["B45", "B4S"]
      };
      const colorCode = BMW_COLORS.find(color =>
        (colorAliases[color.code.toUpperCase()] || [color.code.toUpperCase()]).some(alias => detailCompact.includes(alias))
      )?.code || "";
      const detectedDetails = { modelo: modelDetected, colorCode };
            setManualVin(recognized);
      await handleAudit(recognized, detectedDetails);
      toast({ title: "Lectura completada", description: [recognized, modelDetected, colorCode ? "Color " + colorCode : ""].filter(Boolean).join(" · ") });
    } catch (err: any) {
      toast({ variant: "destructive", title: "No se ha podido leer la placa", description: err?.message || "Repite la fotografía o introduce manualmente los últimos siete caracteres del VIN." });
    } finally { setIsProcessing(false); setProcessStep(null); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };
  const handleCreateNewVehicle = async () => {
    if (!newVehicleData.modelo || !newVehicleData.vin) return toast({ variant: "destructive", title: "Faltan datos", description: "Introduce o confirma el modelo antes de guardar." });
    const duplicate = vehiculos.find(v => String(v.vin || "").toUpperCase() === newVehicleData.vin.toUpperCase() || String(v.vin7 || "").toUpperCase() === newVehicleData.vin7.toUpperCase() || String(v.vin || "").toUpperCase().endsWith(newVehicleData.vin7.toUpperCase()));
    if (duplicate) {
      setIsNewVehicleDialogOpen(false);
      setLastAudit({ ...duplicate, status: "success", message: "VEHÍCULO YA EXISTE EN STOCK · NO SE HA DUPLICADO" });
      toast({ title: "Vehículo duplicado detectado", description: `${duplicate.modelo || "Modelo pendiente"} · ${duplicate.ubicacion || "Sin ubicación"}` });
      return;
    }
    const color = BMW_COLORS.find(c => c.code === newVehicleData.colorBMW);
    const payload = { ...newVehicleData, motor: newVehicleData.motor || suggestedScannerMotor(newVehicleData.modelo), vin: newVehicleData.vin.toUpperCase(), vin7: newVehicleData.vin7.toUpperCase(), colorExterior: color?.name || "", colorCodigo: newVehicleData.colorBMW || "", estado: "Stock", fechaEntrada: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
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
        detalles: "Alta iniciada desde Escáner VIN."
      });
      setIsNewVehicleDialogOpen(false);
      setLastAudit({ ...payload, id: docRef.id, status: 'success', message: 'VEHÍCULO REGISTRADO Y AUDITADO' });
      toast({ title: "Vehículo Registrado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    }
  };

  return (
    <div className={compact ? "space-y-4" : "h-full overflow-y-auto bg-slate-50"}><div className={compact ? "space-y-4" : "mx-auto max-w-[1200px] space-y-6 px-5 py-7 pb-10 md:px-8 md:py-9"}>
      {!compact && <div className="flex flex-col gap-0.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0066b3]">Operaciones · Momentum Navarra</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Escáner VIN</h1>
        <p className="mt-1 text-sm text-slate-500">Lectura local de la placa con OCR. La fotografía se procesa en este dispositivo.</p>
      </div>}

      <Card className="overflow-hidden rounded-xl border-slate-200/80 bg-white text-slate-900 shadow-sm">
        <CardContent className="flex flex-col items-center space-y-5 p-7 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-[#0066b3]">
            {isProcessing ? <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" /> : <Scan className="w-8 h-8 text-white" />}
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{isProcessing ? "LEYENDO BASTIDOR..." : "IDENTIFICAR VEHÍCULO"}</h2>
            <p className="text-sm text-slate-500">{processStep || "Enfoca la placa del bastidor; también puedes introducir el VIN7 manualmente."}</p>
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
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Resultado de identificación</p>
                <h3 className="font-black text-secondary uppercase text-sm truncate">{lastAudit.modelo || 'BASTIDOR DESCONOCIDO'}</h3>
                <p className="font-mono text-[9px] font-bold text-slate-400 tracking-widest truncate">{lastAudit.vin}</p>
                {(lastAudit.colorCodigo || lastAudit.colorExterior) && <p className="mt-1 text-xs text-slate-500">Color: {lastAudit.colorExterior || "Sin nombre"} · Código {lastAudit.colorCodigo}</p>}
                <p className={cn("text-[8px] font-black uppercase mt-2", lastAudit.status === 'success' ? 'text-emerald-600' : 'text-red-600')}>{lastAudit.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!compact && <Card className="overflow-hidden rounded-xl border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-semibold text-slate-900">Actividad reciente</h2><p className="mt-1 text-xs text-slate-500">Últimos movimientos y auditorías registrados.</p></div><Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-600">{movements.length} registros</Badge></div>
        <div className="divide-y divide-slate-100">
          {movementsLoading ? <p className="p-6 text-sm text-slate-400">Cargando actividad…</p> : movements.length === 0 ? <p className="p-6 text-sm text-slate-400">Todavía no hay movimientos registrados.</p> : movements.map((movement: any) => <div key={movement.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{movement.vehiculoInfo || 'Movimiento de vehículo'}</p><p className="mt-1 text-xs text-slate-500">{movement.detalles || movement.tipoAccion || 'Actividad registrada'}</p></div><div className="flex shrink-0 items-center gap-2"><Badge variant="outline" className="border-slate-200 text-[10px]">{movement.tipoAccion || 'Movimiento'}</Badge><span className="text-xs text-slate-400">{movement.fecha ? format(new Date(movement.fecha), 'dd/MM/yyyy HH:mm', { locale: es }) : '—'}</span></div></div>)}
        </div>
      </Card>}

      <Dialog open={isNewVehicleDialogOpen} onOpenChange={setIsNewVehicleDialogOpen}>
        <DialogContent className="p-0 border-none rounded-3xl overflow-hidden max-w-[90vw] md:max-w-md shadow-2xl">
          <div className="bg-[#0066b3] p-5 text-center text-sm font-semibold text-white">VEHÍCULO NO ENCONTRADO · NUEVA ALTA</div>
          <div className="p-6 space-y-4 bg-white max-h-[80vh] overflow-y-auto">
            <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Bastidor reconocido (VIN)</Label><Input value={newVehicleData.vin} onChange={e => { const vin = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17); setNewVehicleData({...newVehicleData, vin, vin7: vin.slice(-7)}); }} maxLength={17} className="h-11 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs tracking-wide" /></div>
            <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Modelo detectado · editable</Label><Input value={newVehicleData.modelo} placeholder="Modelo no identificado: introdúcelo" onChange={e => setNewVehicleData({...newVehicleData, modelo: e.target.value})} className="h-11 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]" /></div>
            <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Motorización sugerida</Label><Input value={newVehicleData.motor} placeholder="Se completa según el modelo" onChange={e => setNewVehicleData({...newVehicleData, motor: e.target.value})} className="h-11 bg-slate-50 border-none rounded-xl text-[10px]" /></div>
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
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Color exterior</Label><Select value={newVehicleData.colorBMW} onValueChange={v => setNewVehicleData({...newVehicleData, colorBMW: v})}><SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-bold text-[9px] px-3"><SelectValue placeholder="Seleccionar color"/></SelectTrigger><SelectContent className="max-h-[200px]">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code} className="text-[9px]">{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Ubicación</Label><Select value={newVehicleData.ubicacion} onValueChange={v => setNewVehicleData({...newVehicleData, ubicacion: v})}><SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-bold text-[9px] px-3"><SelectValue/></SelectTrigger><SelectContent>{["Stock", "Terraza", "Entreplanta", "Lavadero"].map(u => <SelectItem key={u} value={u} className="text-[9px] uppercase">{u}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Button onClick={handleCreateNewVehicle} className="mt-2 h-12 w-full rounded-lg bg-[#0066b3] text-sm font-semibold text-white hover:bg-[#00549a]">CONFIRMAR ALTA UNIDAD</Button>
          </div>
        </DialogContent>
      </Dialog>
      </div></div>
  );
}
