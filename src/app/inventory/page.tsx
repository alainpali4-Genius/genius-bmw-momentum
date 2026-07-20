
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
import { scanVIN } from "@/ai/flows/scan-vin-flow";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BMW_COLORS } from "../showroom/page";

const compressImage = (file: File, maxWidth = 1024, quality = 0.6): Promise<string> => {
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

export default function InventarioGenius() {
  const db = useFirestore();
  const { toast } = useToast();
  const { data: vehiculosRaw } = useCollection(collection(db, "vehiculos"));
  const movementsQuery = useMemo(() => query(collection(db, "movimientos"), orderBy("fecha", "desc"), limit(20)), [db]);
  const { data: movements } = useCollection(movementsQuery);
  
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
    ubicacion: "Stock"
  });

  const vehiculos = (vehiculosRaw || []) as any[];
  const auditLogs = (movements || []).filter(m => m.tipoAccion === 'Inventario');

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
        detalles: "Inventario verificado por IA."
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
        ubicacion: "Stock"
      });
      setIsNewVehicleDialogOpen(true);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessStep("Optimizando imagen...");
    try {
      const compressedDataUri = await compressImage(file);
      setProcessStep("Analizando con Gemini...");
      const result = await scanVIN({ photoDataUri: compressedDataUri });
      
      if (result?.vin) {
        setProcessStep("Verificando stock...");
        await handleAudit(result.vin, { modelo: result.modelo });
      } else {
        toast({ variant: "destructive", title: "IA no detectó datos" });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error de procesamiento" });
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
        detalles: "Alta por escaneo IA."
      });
      setIsNewVehicleDialogOpen(false);
      setLastAudit({ ...payload, id: docRef.id, status: 'success', message: 'VEHÍCULO REGISTRADO Y AUDITADO' });
      toast({ title: "Vehículo Registrado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1000px] mx-auto space-y-4 pb-24 h-screen overflow-y-auto">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl md:text-2xl font-black tracking-tighter text-secondary uppercase italic leading-none">INVENTARIO <span className="text-emerald-600 not-italic">EXPRESS</span></h1>
        <p className="text-muted-foreground text-[8px] font-black uppercase tracking-widest">IA DE VISIÓN LOGÍSTICA • MOMENTUM</p>
      </div>

      <Card className="premium-card border-none shadow-xl bg-[#14284B] text-white overflow-hidden rounded-3xl">
        <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border-2 border-white/10 relative">
            {isProcessing ? <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" /> : <Scan className="w-8 h-8 text-white" />}
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-black uppercase italic tracking-tighter">{isProcessing ? "IA ANALIZANDO..." : "ESCANEAR PLACA VIN"}</h2>
            <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">{processStep || "Captura la chapa del bastidor"}</p>
          </div>
          <div className="w-full max-w-sm space-y-3">
            <Button size="lg" className="w-full h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest text-sm shadow-lg" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
              <Camera className="mr-2 w-5 h-5" /> {isProcessing ? "AUDITANDO..." : "ABRIR CÁMARA"}
            </Button>
            <div className="flex gap-2">
              <Input placeholder="VIN7 MANUAL..." className="h-11 bg-white/5 border-white/10 rounded-xl text-white font-black uppercase text-center text-xs placeholder:text-white/10" value={manualVin} onChange={e => setManualVin(e.target.value)} />
              <Button onClick={() => handleAudit(manualVin)} className="h-11 w-11 rounded-xl bg-white/10 hover:bg-white/20 p-0 shrink-0"><ChevronRight className="w-5 h-5" /></Button>
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
              {lastAudit.status === 'success' && (
                <Badge className="bg-secondary text-white text-[9px] font-black uppercase px-2 py-1 rounded-md">{lastAudit.ubicacion}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isNewVehicleDialogOpen} onOpenChange={setIsNewVehicleDialogOpen}>
        <DialogContent className="p-0 border-none rounded-3xl overflow-hidden max-w-[90vw] md:max-w-md shadow-2xl">
          <div className="p-6 bg-emerald-600 text-white text-center font-black uppercase italic text-sm tracking-tighter">ALTA POR ESCANEO IA</div>
          <div className="p-6 space-y-4 bg-white">
            <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Modelo Detectado</Label><Input value={newVehicleData.modelo} onChange={e => setNewVehicleData({...newVehicleData, modelo: e.target.value})} className="h-11 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Color BMW</Label><Select value={newVehicleData.colorBMW} onValueChange={v => setNewVehicleData({...newVehicleData, colorBMW: v})}><SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-bold text-[9px] px-3"><SelectValue/></SelectTrigger><SelectContent className="max-h-[200px]">{BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code} className="text-[9px]">{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 px-1">Ubicación</Label><Select value={newVehicleData.ubicacion} onValueChange={v => setNewVehicleData({...newVehicleData, ubicacion: v})}><SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-bold text-[9px] px-3"><SelectValue/></SelectTrigger><SelectContent>{["Stock", "Terraza", "Entreplanta", "Lavadero"].map(u => <SelectItem key={u} value={u} className="text-[9px] uppercase">{u}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Button onClick={handleCreateNewVehicle} className="w-full h-14 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-xl mt-2">CONFIRMAR ALTA UNIDAD</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
