
"use client"

import { useState, useMemo } from "react"
import { 
  AlertCircle, 
  Search, 
  Plus, 
  Camera, 
  Car, 
  Calendar,
  ShieldAlert,
  Clock,
  Loader2,
  CheckCircle2,
  Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useFirestore, useCollection } from "@/firebase"
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function IncidentsReports() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  
  const { data: vehiculosRaw } = useCollection(collection(db, "vehiculos"));
  const incidenciasQuery = useMemo(() => query(collection(db, "incidencias"), orderBy("fechaReporte", "desc")), [db]);
  const { data: incidenciasRaw, loading } = useCollection(incidenciasQuery);

  const [formData, setFormData] = useState({
    vehiculoId: "",
    tipo: "Daño",
    severidad: "Media",
    descripcion: ""
  });

  const incidencias = (incidenciasRaw || []) as any[];
  const vehiculos = (vehiculosRaw || []) as any[];

  const filteredIncidencias = useMemo(() => {
    return incidencias.filter(i => 
      i.vehiculoInfo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.vin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [incidencias, searchTerm]);

  const stats = useMemo(() => {
    const activas = incidencias.filter(i => i.estado !== 'Resuelto').length;
    const evaluacion = incidencias.filter(i => i.estado === 'Evaluación').length;
    const resueltas = incidencias.filter(i => i.estado === 'Resuelto').length;
    const porcentaje = incidencias.length > 0 ? Math.round((resueltas / incidencias.length) * 100) : 0;
    return { activas, evaluacion, porcentaje };
  }, [incidencias]);

  const handleAddIncidencia = async () => {
    if (!formData.vehiculoId || !formData.descripcion) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Selecciona un vehículo y describe el problema." });
      return;
    }

    const vehicle = vehiculos.find(v => v.id === formData.vehiculoId);
    const payload = {
      ...formData,
      vehiculoInfo: vehicle ? `${vehicle.modelo}` : "Vehículo desconocido",
      vin: vehicle ? (vehicle.vin7 || vehicle.vin?.slice(-7)) : "N/A",
      estado: "Reportado",
      fechaReporte: new Date().toISOString(),
      reportadoPor: "Genius App"
    };

    try {
      await addDoc(collection(db, "incidencias"), payload);
      setIsAdding(false);
      setFormData({ vehiculoId: "", tipo: "Daño", severidad: "Media", descripcion: "" });
      toast({ title: "Incidencia Reportada", description: "Se ha registrado correctamente en el sistema." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la incidencia." });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "incidencias", id), { estado: newStatus });
      toast({ title: "Estado Actualizado", description: `Incidencia marcada como ${newStatus}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado." });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Eliminar este reporte de incidencia?")) {
      try {
        await deleteDoc(doc(db, "incidencias", id));
        toast({ title: "Reporte Eliminado" });
      } catch (e) {
        toast({ variant: "destructive", title: "Error" });
      }
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-secondary uppercase italic font-black">INCIDENCIAS <span className="text-accent not-italic">VN</span></h1>
          <p className="text-muted-foreground mt-1 text-sm font-black uppercase tracking-widest">Momentum Navarra • Control de Daños y Estado</p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-red-800 text-white h-12 px-6 rounded-xl font-black uppercase tracking-widest shadow-lg">
              <Plus className="w-5 h-5 mr-2" /> Reportar Daño
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
            <div className="p-6 bg-accent text-white"><h2 className="text-lg font-black uppercase italic tracking-tight">NUEVO REPORTE</h2></div>
            <div className="p-6 space-y-4 bg-white">
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Vehículo Afectado</Label>
                <Select value={formData.vehiculoId} onValueChange={(v) => setFormData({...formData, vehiculoId: v})}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold text-xs uppercase">
                    <SelectValue placeholder="SELECCIONAR..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {vehiculos.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.modelo} ({v.vin7 || v.vin?.slice(-7)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Tipo</Label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({...formData, tipo: v})}>
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold text-xs uppercase"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      {["Daño", "Mecánico", "Pintura", "Transporte", "Otro"].map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Severidad</Label>
                  <Select value={formData.severidad} onValueChange={(v) => setFormData({...formData, severidad: v})}>
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold text-xs uppercase"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      {["Baja", "Media", "Alta"].map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Descripción</Label>
                <Input value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl text-xs font-bold uppercase" placeholder="EJ: RAYADURA EN LLANTA..." />
              </div>
              <Button onClick={handleAddIncidencia} className="w-full h-14 bg-secondary text-white rounded-xl font-black uppercase text-[10px] shadow-xl mt-4 border-none transition-all active:scale-95">
                ENVIAR REPORTE A LOGÍSTICA
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="premium-card bg-red-50/50 border-red-100 border-none shadow-sm rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[9px] font-black text-red-700 uppercase tracking-widest">Activas</p>
                <p className="text-3xl font-black text-red-900 mt-1">{stats.activas}</p>
              </div>
              <ShieldAlert className="text-red-600 w-8 h-8 opacity-40" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="premium-card bg-white border-none shadow-sm rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Evaluación</p>
                <p className="text-3xl font-black text-secondary mt-1">{stats.evaluacion}</p>
              </div>
              <Clock className="text-blue-600 w-8 h-8 opacity-40" />
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card lg:col-span-2 bg-white border-none shadow-sm rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-[9px] font-black text-muted-foreground uppercase mb-4 tracking-widest">Tasa de Resolución</p>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <Progress value={stats.porcentaje} className="h-2 bg-slate-100" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-emerald-600">{stats.porcentaje}%</p>
                <p className="text-[8px] font-black text-slate-400 uppercase">OBJETIVO: 90%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <Input 
            className="h-12 bg-white border-none rounded-xl text-xs font-black uppercase tracking-widest pl-11 shadow-sm placeholder:text-slate-200" 
            placeholder="BUSCAR VIN O MODELO..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
        ) : filteredIncidencias.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
             <CheckCircle2 className="w-12 h-12 text-slate-100 mx-auto mb-4" />
             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin incidencias registradas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredIncidencias.map((incident) => (
              <Card key={incident.id} className="premium-card overflow-hidden hover:border-primary/50 transition-all border-none bg-white rounded-2xl shadow-sm flex flex-col">
                <div className="p-4 bg-slate-50/50 border-b flex justify-between items-center">
                  <Badge variant="outline" className="text-[8px] font-mono bg-white uppercase border-slate-200">ID: {incident.id?.slice(-5)}</Badge>
                  <Badge className={cn("text-[8px] font-black uppercase px-3 py-1 border-none",
                    incident.severidad === 'Alta' ? 'bg-red-600 text-white' :
                    incident.severidad === 'Media' ? 'bg-orange-500 text-white' :
                    'bg-blue-600 text-white'
                  )}>
                    {incident.severidad}
                  </Badge>
                </div>
                <CardContent className="p-5 flex-1 flex flex-col space-y-4">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
                      <Car className="text-secondary w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-secondary text-sm uppercase leading-none mb-1">{incident.vehiculoInfo}</h3>
                      <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">BASTIDOR: {incident.vin}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl italic text-[11px] text-slate-600 font-medium">
                    "{incident.descripcion}"
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[9px] pt-2 border-t border-slate-50 mt-auto">
                    <div className="space-y-1">
                      <p className="font-black text-slate-400 uppercase tracking-widest">Estado Actual</p>
                      <div className="flex items-center gap-1.5 font-black text-primary uppercase">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        {incident.estado}
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="font-black text-slate-400 uppercase tracking-widest">Fecha Reporte</p>
                      <div className="flex items-center gap-1.5 justify-end font-black text-secondary">
                        <Calendar className="w-3 h-3" />
                        {incident.fechaReporte ? format(new Date(incident.fechaReporte), "dd/MM/yyyy", { locale: es }) : 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex gap-2">
                    {incident.estado !== 'Resuelto' ? (
                      <Button onClick={() => handleUpdateStatus(incident.id, 'Resuelto')} className="flex-1 h-10 text-[9px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl border-none shadow-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Finalizar
                      </Button>
                    ) : (
                      <Button onClick={() => handleDelete(incident.id)} variant="outline" className="flex-1 h-10 text-[9px] font-black uppercase border-slate-100 hover:bg-red-50 hover:text-red-600 rounded-xl">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Eliminar
                      </Button>
                    )}
                    <Select value={incident.estado} onValueChange={(val) => handleUpdateStatus(incident.id, val)}>
                      <SelectTrigger className="w-fit h-10 px-3 bg-slate-50 border-none rounded-xl text-[9px] font-black uppercase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        {["Reportado", "Evaluación", "Taller", "Resuelto"].map(st => <SelectItem key={st} value={st}>{st.toUpperCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
