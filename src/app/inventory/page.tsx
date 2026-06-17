'use client';

import { useState, useRef, useMemo } from "react";
import { 
  Camera, CheckCircle2, AlertCircle, History, RefreshCw, Car, ChevronRight, Search, Clock, Scan, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, limit } from "firebase/firestore";
import { scanVIN } from "@/ai/flows/scan-vin-flow";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from "@/hooks/use-toast";

/**
 * Función de utilidad para comprimir imágenes antes de enviarlas al servidor.
 * Redimensiona a un máximo de 1280px y baja la calidad a 0.7 para asegurar que el peso sea < 1MB.
 */
const compressImage = (file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.7): Promise<string> => {
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
        ctx?.drawImage(img, 0, 0, width, height);
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
  
  const [isScanning, setIsScanning] = useState(false);
  const [lastAudit, setLastAudit] = useState<any>(null);
  const [manualVin, setManualVin] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const vehiculos = useMemo(() => (vehiculosRaw || []) as any[], [vehiculosRaw]);
  const auditLogs = useMemo(() => (movements || []).filter(m => m.tipoAccion === 'Inventario'), [movements]);

  const handleAudit = async (vinToFind: string) => {
    if (!vinToFind) return;
    
    const vinNorm = vinToFind.trim().toUpperCase();
    
    const vehicle = vehiculos.find(v => 
      v.vin === vinNorm || 
      v.vin7 === vinNorm || 
      v.vin?.endsWith(vinNorm) ||
      vinNorm.endsWith(v.vin7)
    );

    if (vehicle) {
      const payload = {
        vehiculoId: vehicle.id,
        vehiculoInfo: `${vehicle.modelo} (${vehicle.vin7 || vehicle.vin?.slice(-7)})`,
        tipoAccion: 'Inventario',
        fecha: new Date().toISOString(),
        origen: vehicle.ubicacion,
        destino: vehicle.ubicacion,
        usuario: "Genius Auditor IA",
        detalles: "Auditoría física confirmada por escaneo comprimido."
      };

      addDoc(collection(db, "movimientos"), payload).catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'movimientos', operation: 'create', requestResourceData: payload
        }));
      });

      setLastAudit({ ...vehicle, status: 'success', message: 'UBICACIÓN CORRECTA' });
      setManualVin("");
      toast({ title: "Vehículo Auditado", description: `${vehicle.modelo} verificado en ${vehicle.ubicacion}` });
    } else {
      setLastAudit({ vin: vinNorm, status: 'error', message: 'VEHÍCULO NO ENCONTRADO EN STOCK' });
      toast({ variant: "destructive", title: "No encontrado", description: `El bastidor ${vinNorm} no consta en el stock actual.` });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      // Compresión crítica para evitar Error 413
      const compressedDataUri = await compressImage(file);
      const result = await scanVIN({ photoDataUri: compressedDataUri });
      
      if (result && result.vin) {
        handleAudit(result.vin);
      } else {
        toast({ variant: "destructive", title: "Error de lectura", description: "La IA no pudo detectar el VIN. Intenta con más luz." });
      }
    } catch (err) {
      console.error("SCAN ERROR", err);
      toast({ variant: "destructive", title: "Error", description: "Error al procesar la imagen comprimida." });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tighter text-secondary uppercase italic leading-none">
          INVENTARIO <span className="text-emerald-600 not-italic">EXPRESS IA</span>
        </h1>
        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Auditoría física Momentum Navarra</p>
      </div>

      <Card className="premium-card border-none shadow-2xl bg-gradient-to-br from-secondary to-slate-900 text-white overflow-hidden rounded-[2.5rem]">
        <CardContent className="p-10 flex flex-col items-center text-center space-y-8">
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center border-4 border-white/20">
            {isScanning ? <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" /> : <Scan className="w-12 h-12 text-white" />}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">
              {isScanning ? "Comprimiendo..." : "Modo Recorrido"}
            </h2>
            <p className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em] px-10">
              Captura el VIN. La imagen se optimiza automáticamente para cumplir el límite de 1MB.
            </p>
          </div>
          
          <div className="w-full max-w-sm space-y-3">
            <Button 
              size="lg" 
              className={cn(
                "w-full h-20 rounded-3xl font-black uppercase tracking-widest text-base shadow-xl transition-all active:scale-95",
                isScanning ? "bg-slate-700 text-white/50" : "bg-white text-secondary hover:bg-white/90"
              )}
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
            >
              <Camera className="mr-3 w-6 h-6" />
              {isScanning ? "Procesando..." : "ESCANEAR BASTIDOR"}
            </Button>
            
            <div className="flex gap-2">
              <Input 
                placeholder="VIN7 MANUAL..." 
                className="h-14 bg-white/10 border-white/20 rounded-2xl text-white font-black uppercase text-center placeholder:text-white/20"
                value={manualVin}
                onChange={(e) => setManualVin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAudit(manualVin)}
              />
              <Button onClick={() => handleAudit(manualVin)} className="h-14 w-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 border-none transition-all active:scale-90">
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
        </CardContent>
      </Card>

      {lastAudit && (
        <Card className={cn("premium-card border-l-8 overflow-hidden animate-in slide-in-from-bottom-4 rounded-3xl", 
          lastAudit.status === 'success' ? 'border-l-emerald-500 bg-emerald-50/30' : 'border-l-red-500 bg-red-50/30'
        )}>
          <CardContent className="p-6">
            <div className="flex gap-5 items-center">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", 
                lastAudit.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
              )}>
                {lastAudit.status === 'success' ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Verificación Logística</p>
                <h3 className="font-black text-secondary uppercase text-lg leading-none">{lastAudit.modelo || 'NO LOCALIZADO'}</h3>
                <p className="font-mono text-xs font-bold text-slate-500 mt-1">{lastAudit.vin}</p>
                <p className={cn("text-[10px] font-black uppercase mt-3 tracking-widest", 
                  lastAudit.status === 'success' ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {lastAudit.message}
                </p>
              </div>
              {lastAudit.status === 'success' && (
                <div className="text-right">
                  <Badge className="bg-emerald-600 text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-lg border-none shadow-sm">{lastAudit.ubicacion}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <h3 className="text-[10px] font-black uppercase text-secondary tracking-widest">Actividad Reciente Inventario</h3>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {auditLogs.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-200 text-center">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay registros de auditoría hoy</p>
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center"><Car className="w-5 h-5 text-slate-400" /></div>
                  <div>
                    <p className="text-xs font-black uppercase text-secondary leading-none mb-1.5">{log.vehiculoInfo}</p>
                    <div className="flex items-center gap-2">
                       <Clock className="w-2.5 h-2.5 text-slate-300" />
                       <p className="text-[9px] font-bold text-slate-400 uppercase">{format(log.fecha ? new Date(log.fecha) : new Date(), "HH:mm • dd MMM", { locale: es })}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border-emerald-100 h-6">CONFIRMADO</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
