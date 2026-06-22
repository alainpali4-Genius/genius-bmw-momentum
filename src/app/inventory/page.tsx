'use client';

import { useState, useRef, useMemo } from "react";
import { 
  Camera, CheckCircle2, AlertCircle, History, RefreshCw, Car, ChevronRight, Search, Clock, Scan, Loader2, Zap
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from "@/hooks/use-toast";

/**
 * Función de utilidad ultra-rápida para comprimir imágenes antes de enviarlas a la IA.
 * Asegura que el archivo sea ligero para evitar errores de red y de límite de tokens.
 */
const compressImage = (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.6): Promise<string> => {
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

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("No se pudo crear el contexto 2D");
        
        // Ajustes de calidad
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

export default function InventarioGenius() {
  const db = useFirestore();
  const { toast } = useToast();
  const { data: vehiculosRaw } = useCollection(collection(db, "vehiculos"));
  const movementsQuery = useMemo(() => query(collection(db, "movimientos"), orderBy("fecha", "desc"), limit(50)), [db]);
  const { data: movements } = useCollection(movementsQuery);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string | null>(null);
  const [lastAudit, setLastAudit] = useState<any>(null);
  const [manualVin, setManualVin] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const vehiculos = useMemo(() => (vehiculosRaw || []) as any[], [vehiculosRaw]);
  const auditLogs = useMemo(() => (movements || []).filter(m => m.tipoAccion === 'Inventario'), [movements]);

  const handleAudit = async (vinToFind: string) => {
    if (!vinToFind) return;
    
    const vinNorm = vinToFind.trim().toUpperCase();
    
    // Búsqueda flexible (VIN completo o VIN7)
    const vehicle = vehiculos.find(v => 
      v.vin === vinNorm || 
      v.vin7 === vinNorm || 
      (v.vin && v.vin.endsWith(vinNorm)) ||
      (vinNorm.length >= 7 && v.vin7 && vinNorm.endsWith(v.vin7))
    );

    if (vehicle) {
      const payload = {
        vehiculoId: vehicle.id,
        vehiculoInfo: `${vehicle.modelo} (${vehicle.vin7 || vehicle.vin?.slice(-7)})`,
        tipoAccion: 'Inventario',
        fecha: new Date().toISOString(),
        origen: vehicle.ubicacion,
        destino: vehicle.ubicacion,
        usuario: "GENIUS IA",
        detalles: "Inventario confirmado vía escaneo inteligente."
      };

      addDoc(collection(db, "movimientos"), payload).catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'movimientos', operation: 'create', requestResourceData: payload
        }));
      });

      setLastAudit({ ...vehicle, status: 'success', message: 'UBICACIÓN VERIFICADA' });
      setManualVin("");
      toast({ title: "Vehículo Localizado", description: `${vehicle.modelo} confirmado en ${vehicle.ubicacion}` });
    } else {
      setLastAudit({ vin: vinNorm, status: 'error', message: 'VIN NO RECONOCIDO EN EL STOCK ACTUAL' });
      toast({ variant: "destructive", title: "Error de Auditoría", description: `El bastidor ${vinNorm} no coincide con ningún vehículo en stock.` });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessStep("Optimizando imagen...");
    
    try {
      const compressedDataUri = await compressImage(file);
      
      setProcessStep("Analizando bastidor con IA...");
      const result = await scanVIN({ photoDataUri: compressedDataUri });
      
      if (result && result.vin) {
        setProcessStep("Buscando en stock...");
        handleAudit(result.vin);
      } else {
        toast({ 
          variant: "destructive", 
          title: "Lectura Fallida", 
          description: "La IA no pudo leer el VIN con claridad. Asegúrate de que haya buena luz y el código esté centrado." 
        });
      }
    } catch (err) {
      console.error("SCAN ERROR", err);
      toast({ variant: "destructive", title: "Error de Procesamiento", description: "Hubo un problema técnico al analizar la imagen." });
    } finally {
      setIsProcessing(false);
      setProcessStep(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 pb-24">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tighter text-secondary uppercase italic leading-none">
          INVENTARIO <span className="text-emerald-600 not-italic">EXPRESS</span>
        </h1>
        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Auditoría con visión artificial • Momentum Navarra</p>
      </div>

      <Card className="premium-card border-none shadow-2xl bg-gradient-to-br from-[#14284B] to-slate-900 text-white overflow-hidden rounded-[2.5rem] relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-20 translate-x-20" />
        <CardContent className="p-10 flex flex-col items-center text-center space-y-8 relative z-10">
          <div className="w-28 h-28 rounded-full bg-white/5 flex items-center justify-center border-4 border-white/10 relative">
            {isProcessing ? (
              <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
            ) : (
              <Scan className="w-12 h-12 text-white" />
            )}
            {isProcessing && (
              <div className="absolute -bottom-2 bg-emerald-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full animate-bounce">
                PROCESANDO
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">
              {isProcessing ? "IA EN PROCESO" : "ESCANEAR BASTIDOR"}
            </h2>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] max-w-xs mx-auto">
              {processStep || "Captura la placa técnica o el grabado del chasis para auditar el vehículo al instante."}
            </p>
          </div>
          
          <div className="w-full max-w-sm space-y-3">
            <Button 
              size="lg" 
              className={cn(
                "w-full h-20 rounded-3xl font-black uppercase tracking-widest text-base shadow-xl transition-all active:scale-95 border-none",
                isProcessing ? "bg-slate-800 text-white/30 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-400 text-white"
              )}
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Camera className="mr-3 w-7 h-7" />
              {isProcessing ? "AUDITANDO..." : "ABRIR CÁMARA"}
            </Button>
            
            <div className="relative pt-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10" /></div>
              <div className="relative flex justify-center text-[8px] font-black uppercase"><span className="bg-[#14284B] px-4 text-white/30 tracking-widest">O ENTRADA MANUAL</span></div>
            </div>

            <div className="flex gap-2">
              <Input 
                placeholder="VIN7 MANUAL..." 
                className="h-14 bg-white/5 border-white/10 rounded-2xl text-white font-black uppercase text-center placeholder:text-white/10 focus:bg-white/10 transition-colors"
                value={manualVin}
                onChange={(e) => setManualVin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAudit(manualVin)}
              />
              <Button onClick={() => handleAudit(manualVin)} className="h-14 w-14 rounded-2xl bg-white/10 hover:bg-white/20 border-none transition-all active:scale-90">
                <ChevronRight className="w-6 h-6 text-white" />
              </Button>
            </div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
        </CardContent>
      </Card>

      {lastAudit && (
        <Card className={cn("premium-card border-l-[10px] overflow-hidden animate-in slide-in-from-bottom-6 rounded-[2rem] shadow-lg", 
          lastAudit.status === 'success' ? 'border-l-emerald-500 bg-white' : 'border-l-red-500 bg-white'
        )}>
          <CardContent className="p-8">
            <div className="flex gap-6 items-center">
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", 
                lastAudit.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              )}>
                {lastAudit.status === 'success' ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className={cn("w-3 h-3", lastAudit.status === 'success' ? 'text-emerald-500' : 'text-red-500')} />
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Resultado de Auditoría</p>
                </div>
                <h3 className="font-black text-secondary uppercase text-xl leading-none truncate">{lastAudit.modelo || 'VEHÍCULO DESCONOCIDO'}</h3>
                <p className="font-mono text-xs font-bold text-slate-400 mt-2">{lastAudit.vin}</p>
                <p className={cn("text-[10px] font-black uppercase mt-4 tracking-widest flex items-center gap-2", 
                  lastAudit.status === 'success' ? 'text-emerald-600' : 'text-red-600'
                )}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {lastAudit.message}
                </p>
              </div>
              {lastAudit.status === 'success' && (
                <div className="text-right hidden sm:block">
                  <p className="text-[8px] font-black text-slate-300 uppercase mb-2">Ubicación</p>
                  <Badge className="bg-secondary text-white text-[12px] font-black uppercase px-6 py-2 rounded-xl border-none shadow-md">
                    {lastAudit.ubicacion}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-[10px] font-black uppercase text-secondary tracking-widest">Registros de Auditoría Hoy</h3>
          </div>
          <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-400 border-slate-100">
            TOTAL: {auditLogs.length}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {auditLogs.length === 0 ? (
            <div className="bg-white p-12 rounded-[2rem] border-2 border-dashed border-slate-100 text-center flex flex-col items-center gap-4">
              <Clock className="w-10 h-10 text-slate-100" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin actividad reciente de inventario</p>
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="bg-white p-5 rounded-2xl border border-slate-50 shadow-sm flex items-center justify-between hover:border-emerald-200 transition-all group">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                    <Car className="w-6 h-6 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <div>
                    <p className="text-[13px] font-black uppercase text-secondary leading-none mb-2">{log.vehiculoInfo}</p>
                    <div className="flex items-center gap-3">
                       <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-300" />
                          <p className="text-[9px] font-bold text-slate-400 uppercase">{format(log.fecha ? new Date(log.fecha) : new Date(), "HH:mm • dd MMM", { locale: es })}</p>
                       </div>
                       <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <p className="text-[9px] font-black text-emerald-600 uppercase">Confirmado</p>
                       </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-secondary uppercase bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                    {log.origen || 'VN'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
