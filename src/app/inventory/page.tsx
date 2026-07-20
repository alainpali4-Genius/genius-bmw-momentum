
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

/**
 * Utilidad de compresión para asegurar fotos ligeras (<1MB) para la IA.
 */
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
      toast({ 
        title: "Nuevo Vehículo Detectado", 
        description: "El bastidor no está registrado. Puedes darlo de alta ahora.",
        duration: 5000
      });
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
        toast({ 
          variant: "destructive", 
          title: "IA no detectó datos", 
          description: "Asegúrate de que el VIN sea legible y haya buena iluminación." 
        });
      }
    } catch (err: any) {
      console.error("INVENTORY_ERROR", err);
      toast({ 
        variant: "destructive", 
        title: "Error de procesamiento", 
        description: "No se pudo conectar con el servicio de IA." 
      });
    } finally {
      setIsProcessing(false);
      setProcessStep(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateNewVehicle = async () => {
    if (!newVehicleData.modelo || !newVehicleData.vin) {
      toast({ variant: "destructive", title: "Faltan datos obligatorios" });
      return;
    }

    const color = BMW_COLORS.find(c => c.code === newVehicleData.colorBMW);
    const payload = {
      ...newVehicleData,
      vin: newVehicleData.vin.toUpperCase(),
      vin7: newVehicleData.vin7.toUpperCase(),
      colorExterior: color?.name || "Alpine White",
      colorCodigo: newVehicleData.colorBMW,
      estado: "Stock",
      fechaEntrada: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

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
        detalles: "Vehículo dado de alta mediante escaneo IA."
      });

      setIsNewVehicleDialogOpen(false);
      setLastAudit({ ...payload, id: docRef.id, status: 'success', message: 'VEHÍCULO REGISTRADO Y AUDITADO' });
      toast({ title: "Vehículo Registrado", description: "Alta completada correctamente." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar el vehículo" });
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 pb-24 h-full overflow-y-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tighter text-secondary uppercase italic leading-none">
          INVENTARIO <span className="text-emerald-600 not-italic">EXPRESS</span>
        </h1>
        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">IA DE VISIÓN LOGÍSTICA • MOMENTUM NAVARRA</p>
      </div>

      <Card className="premium-card border-none shadow-2xl bg-[#14284B] text-white overflow-hidden rounded-[2.5rem]">
        <CardContent className="p-10 flex flex-col items-center text-center space-y-8">
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border-4 border-white/10 relative">
            {isProcessing ? (
              <div className="relative">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />
              </div>
            ) : <Scan className="w-10 h-10 text-white" />}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">{isProcessing ? "IA ANALIZANDO..." : "ESCANEAR PLACA VIN"}</h2>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">{processStep || "Captura la chapa del bastidor para auditar o dar de alta"}</p>
          </div>
          <div className="w-full max-w-sm space-y-4">
            <Button size="lg" className="w-full h-20 rounded-3xl bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest text-base shadow-xl disabled:opacity-50 transition-all active:scale-95" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
              <Camera className="mr-3 w-7 h-7" /> {isProcessing ? "AUDITANDO..." : "ABRIR CÁMARA"}
            </Button>
            <div className="flex gap-2">
              <Input placeholder="VIN7 MANUAL..." className="h-14 bg-white/5 border-white/10 rounded-2xl text-white font-black uppercase text-center placeholder:text-white/10" value={manualVin} onChange={e => setManualVin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAudit(manualVin)} />
              <Button onClick={() => handleAudit(manualVin)} className="h-14 w-14 rounded-2xl bg-white/10 hover:bg-white/20 border-none transition-all active:scale-90"><ChevronRight /></Button>
            </div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
        </CardContent>
      </Card>

      {lastAudit && (
        <Card className={cn("premium-card border-l-[10px] rounded-[2rem] shadow-lg bg-white overflow-hidden animate-in slide-in-from-bottom-5 duration-300", lastAudit.status === 'success' ? 'border-l-emerald-500' : 'border-l-red-500')}>
          <CardContent className="p-8">
            <div className="flex gap-6 items-center flex-col md:flex-row text-center md:text-left">
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shrink-0", lastAudit.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                {lastAudit.status === 'success' ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Resultado de Operación</p>
                <h3 className="font-black text-secondary uppercase text-xl">{lastAudit.modelo || 'BASTIDOR DESCONOCIDO'}</h3>
                <p className="font-mono text-xs font-bold text-slate-400 tracking-widest">{lastAudit.vin}</p>
                <p className={cn("text-[10px] font-black uppercase mt-4 tracking-widest", lastAudit.status === 'success' ? 'text-emerald-600' : 'text-red-600')}>{lastAudit.message}</p>
              </div>
              {lastAudit.status === 'success' && (
                <div className="flex flex-col items-center md:items-end gap-2">
                   <Badge className="bg-secondary text-white text-[12px] font-black uppercase px-6 py-2 rounded-xl shadow-md">{lastAudit.ubicacion}</Badge>
                   <p className="text-[8px] font-black text-slate-300 uppercase">AUDITADO AHORA</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isNewVehicleDialogOpen} onOpenChange={setIsNewVehicleDialogOpen}>
        <DialogContent className="p-0 border-none rounded-[3rem] overflow-hidden max-w-[95vw] md:max-w-md shadow-2xl">
          <div className="p-8 bg-emerald-600 text-white flex justify-between items-center">
            <div className="space-y-1">
              <h2 className="text-xl font-black uppercase italic tracking-tighter">ALTA POR ESCANEO</h2>
              <p className="text-emerald-100 text-[9px] font-black uppercase tracking-widest">NUEVA UNIDAD DETECTADA</p>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <Plus className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="p-8 space-y-6 bg-white">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Modelo Detectado</Label>
              <Input value={newVehicleData.modelo} onChange={e => setNewVehicleData({...newVehicleData, modelo: e.target.value})} className="h-14 bg-slate-50 border-none rounded-2xl font-bold uppercase text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">VIN7</Label>
              <Input value={newVehicleData.vin7} disabled className="h-14 bg-slate-50 border-none rounded-2xl font-black uppercase text-xs text-center tracking-[0.2em]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Color BMW</Label>
                <Select value={newVehicleData.colorBMW} onValueChange={v => setNewVehicleData({...newVehicleData, colorBMW: v})}>
                  <SelectTrigger className="h-14 bg-slate-50 border-none rounded-2xl font-bold text-[10px] uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl max-h-[300px]">
                    {BMW_COLORS.map(c => <SelectItem key={c.code} value={c.code} className="text-[10px]">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Ubicación</Label>
                <Select value={newVehicleData.ubicacion} onValueChange={v => setNewVehicleData({...newVehicleData, ubicacion: v})}>
                  <SelectTrigger className="h-14 bg-slate-50 border-none rounded-2xl font-bold text-[10px] uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    {["Stock", "Terraza", "Entreplanta", "Lavadero"].map(u => <SelectItem key={u} value={u} className="text-[10px]">{u.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="pt-4 flex gap-3">
              <Button variant="ghost" onClick={() => setIsNewVehicleDialogOpen(false)} className="h-16 flex-1 rounded-2xl font-black uppercase text-xs text-slate-400">CANCELAR</Button>
              <Button onClick={handleCreateNewVehicle} className="h-16 flex-2 bg-emerald-600 text-white font-black uppercase text-xs rounded-2xl shadow-xl flex-1 hover:bg-emerald-700">GUARDAR UNIDAD</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <h3 className="text-[10px] font-black uppercase text-secondary tracking-widest">Últimos Registros de Inventario</h3>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {auditLogs.length === 0 ? (
            <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
              <p className="text-[10px] font-black uppercase text-slate-300 italic">No hay registros hoy</p>
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="bg-white p-5 rounded-2xl border border-slate-50 shadow-sm flex items-center justify-between hover:border-emerald-100 transition-colors">
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center"><Car className="w-5 h-5 text-slate-300" /></div>
                  <div>
                    <p className="text-[12px] font-black uppercase text-secondary leading-none mb-1">{log.vehiculoInfo}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(log.fecha), "HH:mm • dd MMM", { locale: es })}</p>
                      <Badge variant="outline" className="text-[7px] font-black uppercase border-slate-100 py-0">{log.destino}</Badge>
                    </div>
                  </div>
                </div>
                <Badge className="bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase border-none px-3 py-1">Confirmado</Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
