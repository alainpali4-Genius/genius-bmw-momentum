'use client';

import { useState, useRef, useMemo } from "react";
import { 
  Camera, CheckCircle2, AlertCircle, History, RefreshCw, Car, ChevronRight, Scan, Loader2, Zap, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, addDoc, limit } from "firebase/firestore";
import { scanVIN } from "@/ai/flows/scan-vin-flow";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/**
 * Utilidad de compresión para asegurar fotos ligeras (<1MB) para la IA.
 */
const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
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

  const vehiculos = (vehiculosRaw || []) as any[];
  const auditLogs = (movements || []).filter(m => m.tipoAccion === 'Inventario');

  const handleAudit = async (vinToFind: string) => {
    if (!vinToFind) return;
    const vinNorm = vinToFind.trim().toUpperCase();
    const vehicle = vehiculos.find(v => 
      v.vin === vinNorm || v.vin7 === vinNorm || v.vin?.endsWith(vinNorm) || (vinNorm.length >= 7 && v.vin7 === vinNorm.slice(-7))
    );

    if (vehicle) {
      const payload = {
        vehiculoId: vehicle.id,
        vehiculoInfo: `${vehicle.modelo} (${vehicle.vin7})`,
        tipoAccion: 'Inventario',
        fecha: new Date().toISOString(),
        origen: vehicle.ubicacion,
        destino: vehicle.ubicacion,
        usuario: "GENIUS IA",
        detalles: "Inventario verificado por IA."
      };
      await addDoc(collection(db, "movimientos"), payload);
      setLastAudit({ ...vehicle, status: 'success', message: 'UBICACIÓN CONFIRMADA' });
      setManualVin("");
      toast({ title: "Vehículo Localizado", description: `${vehicle.modelo} en ${vehicle.ubicacion}` });
    } else {
      setLastAudit({ vin: vinNorm, status: 'error', message: 'BASTIDOR NO ENCONTRADO EN STOCK' });
      toast({ variant: "destructive", title: "Error Auditoría", description: "VIN no reconocido." });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessStep("Optimizando imagen...");
    try {
      const compressedDataUri = await compressImage(file);
      setProcessStep("Analizando con IA...");
      const result = await scanVIN({ photoDataUri: compressedDataUri });
      
      if (result?.vin) {
        setProcessStep("Verificando stock...");
        handleAudit(result.vin);
      } else {
        toast({ variant: "destructive", title: "IA no detectó VIN", description: "Intenta con más luz." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error técnico" });
    } finally {
      setIsProcessing(false);
      setProcessStep(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 pb-24 h-full overflow-y-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tighter text-secondary uppercase italic leading-none">
          INVENTARIO <span className="text-emerald-600 not-italic">EXPRESS</span>
        </h1>
        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">IA DE VISIÓN LOGÍSTICA</p>
      </div>

      <Card className="premium-card border-none shadow-2xl bg-[#14284B] text-white overflow-hidden rounded-[2.5rem]">
        <CardContent className="p-10 flex flex-col items-center text-center space-y-8">
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border-4 border-white/10 relative">
            {isProcessing ? <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" /> : <Scan className="w-10 h-10 text-white" />}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">{isProcessing ? "IA ANALIZANDO..." : "ESCANEAR PLACA VIN"}</h2>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">{processStep || "Captura la chapa del bastidor para auditar el vehículo"}</p>
          </div>
          <div className="w-full max-w-sm space-y-4">
            <Button size="lg" className="w-full h-20 rounded-3xl bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest text-base shadow-xl disabled:opacity-50" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
              <Camera className="mr-3 w-7 h-7" /> {isProcessing ? "AUDITANDO..." : "ABRIR CÁMARA"}
            </Button>
            <div className="flex gap-2">
              <Input placeholder="VIN7 MANUAL..." className="h-14 bg-white/5 border-white/10 rounded-2xl text-white font-black uppercase text-center" value={manualVin} onChange={e => setManualVin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAudit(manualVin)} />
              <Button onClick={() => handleAudit(manualVin)} className="h-14 w-14 rounded-2xl bg-white/10 hover:bg-white/20 border-none"><ChevronRight /></Button>
            </div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
        </CardContent>
      </Card>

      {lastAudit && (
        <Card className={cn("premium-card border-l-[10px] rounded-[2rem] shadow-lg bg-white", lastAudit.status === 'success' ? 'border-l-emerald-500' : 'border-l-red-500')}>
          <CardContent className="p-8">
            <div className="flex gap-6 items-center">
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shrink-0", lastAudit.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                {lastAudit.status === 'success' ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Resultado Auditoría</p>
                <h3 className="font-black text-secondary uppercase text-xl">{lastAudit.modelo || 'VIN DESCONOCIDO'}</h3>
                <p className="font-mono text-xs font-bold text-slate-400">{lastAudit.vin}</p>
                <p className={cn("text-[10px] font-black uppercase mt-4 tracking-widest", lastAudit.status === 'success' ? 'text-emerald-600' : 'text-red-600')}>{lastAudit.message}</p>
              </div>
              {lastAudit.status === 'success' && <Badge className="bg-secondary text-white text-[12px] font-black uppercase px-6 py-2 rounded-xl">{lastAudit.ubicacion}</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <h3 className="text-[10px] font-black uppercase text-secondary tracking-widest">Últimos Registros Hoy</h3>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {auditLogs.map((log) => (
            <div key={log.id} className="bg-white p-5 rounded-2xl border border-slate-50 shadow-sm flex items-center justify-between">
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center"><Car className="w-5 h-5 text-slate-300" /></div>
                <div>
                  <p className="text-[12px] font-black uppercase text-secondary leading-none mb-1">{log.vehiculoInfo}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(log.fecha), "HH:mm • dd MMM", { locale: es })}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[9px] font-black uppercase text-emerald-600 border-emerald-100">Confirmado</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
