
"use client"

import { useState, useMemo } from "react"
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  CheckCircle2, 
  Circle,
  MoreVertical,
  Plus,
  Car,
  FileText,
  Search,
  Loader2,
  Trash2,
  CheckCircle,
  Mail,
  RefreshCw,
  ArrowDownCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useFirestore, useCollection } from "@/firebase"
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

export default function DeliveryManagement() {
  const db = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: vehiculosRaw } = useCollection(query(collection(db, "vehiculos"), orderBy("modelo", "asc")));
  const entregasQuery = useMemo(() => query(collection(db, "entregas"), orderBy("fecha", "desc")), [db]);
  const { data: entregasRaw, loading } = useCollection(entregasQuery);

  const [formData, setFormData] = useState({
    vehiculoId: "",
    cliente: "",
    fecha: format(new Date(), "yyyy-MM-dd"),
    hora: "10:00",
    asesor: "",
    actaEnviada: false,
    recogidaRenting: false,
    recogidaRentingInfo: ""
  });

  const entregas = (entregasRaw || []) as any[];
  const vehiculos = (vehiculosRaw || []) as any[];

  const filteredDeliveries = useMemo(() => {
    let list = entregas;
    if (activeTab === "today") {
      const today = format(new Date(), "yyyy-MM-dd");
      list = list.filter(d => d.fecha === today);
    } else if (activeTab === "upcoming") {
      const today = format(new Date(), "yyyy-MM-dd");
      list = list.filter(d => d.fecha > today);
    }

    if (searchTerm) {
      list = list.filter(d => 
        d.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.vehiculoInfo?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return list;
  }, [entregas, activeTab, searchTerm]);

  const stats = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const hoyCount = entregas.filter(d => d.fecha === today).length;
    const pendientesCount = entregas.filter(d => d.estado !== 'Entregado').length;
    const completadasSemana = entregas.filter(d => d.estado === 'Entregado').length; // Simplificado
    return { hoyCount, pendientesCount, completadasSemana };
  }, [entregas]);

  const handleAddDelivery = async () => {
    if (!formData.vehiculoId || !formData.cliente || !formData.fecha) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Completa los campos obligatorios." });
      return;
    }

    const vehicle = vehiculos.find(v => v.id === formData.vehiculoId);
    const payload = {
      ...formData,
      vehiculoInfo: vehicle ? `${vehicle.modelo} (${vehicle.vin7 || vehicle.vin?.slice(-7)})` : "Vehículo desconocido",
      estado: "Preparación",
      progress: 0,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, "entregas"), payload);
      // Opcional: Actualizar estado del vehículo a "Preparacion Entrega"
      if (vehicle) {
        await updateDoc(doc(db, "vehiculos", vehicle.id), { estado: "Preparacion Entrega" });
      }

      setIsAdding(false);
      setFormData({
        vehiculoId: "", cliente: "", fecha: format(new Date(), "yyyy-MM-dd"), hora: "10:00",
        asesor: "", actaEnviada: false, recogidaRenting: false, recogidaRentingInfo: ""
      });
      toast({ title: "Entrega Programada", description: "Se ha registrado correctamente." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la entrega." });
    }
  };

  const handleCompleteDelivery = async (deliveryId: string, vehiculoId: string, info: string) => {
    try {
      await updateDoc(doc(db, "entregas", deliveryId), { estado: "Entregado", progress: 100 });
      if (vehiculoId) {
        await updateDoc(doc(db, "vehiculos", vehiculoId), { estado: "Entregado", ubicacion: "Entregado" });
      }
      
      await addDoc(collection(db, "movimientos"), {
        vehiculoId,
        vehiculoInfo: info,
        tipoAccion: 'Entrega',
        fecha: new Date().toISOString(),
        usuario: "GENIUS APP",
        detalles: "Vehículo entregado al cliente final."
      });

      toast({ title: "Entrega Finalizada", description: "El vehículo ha sido marcado como entregado." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo completar la entrega." });
    }
  };

  const toggleActa = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, "entregas", id), { actaEnviada: !current });
      toast({ title: "Estado Acta", description: !current ? "Acta marcada como enviada." : "Acta marcada como pendiente." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Eliminar esta programación de entrega?")) {
      await deleteDoc(doc(db, "entregas", id));
      toast({ title: "Entrega eliminada" });
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-secondary uppercase italic">GESTIÓN DE <span className="text-primary not-italic">ENTREGAS</span></h1>
          <p className="text-muted-foreground mt-1 text-[10px] font-black uppercase tracking-widest">Planificación logística Momentum Navarra</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-blue-800 h-12 px-6 rounded-xl font-black uppercase tracking-widest shadow-lg">
                <Plus className="w-4 h-4 mr-2" /> Programar Entrega
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[2rem] shadow-2xl">
              <div className="p-6 bg-primary text-white"><h2 className="text-lg font-black uppercase italic">NUEVA ENTREGA</h2></div>
              <div className="p-8 space-y-5 bg-white">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Vehículo de Stock</Label>
                  <Select value={formData.vehiculoId} onValueChange={(v) => setFormData({...formData, vehiculoId: v})}>
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold text-xs uppercase">
                      <SelectValue placeholder="SELECCIONAR..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      {vehiculos.filter(v => v.estado !== 'Entregado').map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.modelo} ({v.vin7 || v.vin?.slice(-7)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Cliente</Label>
                  <Input value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" placeholder="NOMBRE DEL CLIENTE..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Fecha</Label>
                    <Input type="date" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Hora</Label>
                    <Input type="time" value={formData.hora} onChange={e => setFormData({...formData, hora: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Asesor Comercial</Label>
                  <Input value={formData.asesor} onChange={e => setFormData({...formData, asesor: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" placeholder="EJ: ALAIN..." />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox id="renting" checked={formData.recogidaRenting} onCheckedChange={(v) => setFormData({...formData, recogidaRenting: !!v})} />
                  <label htmlFor="renting" className="text-[10px] font-black uppercase text-secondary cursor-pointer">Coche Recogida Renting</label>
                </div>
                {formData.recogidaRenting && (
                  <Input value={formData.recogidaRentingInfo} onChange={e => setFormData({...formData, recogidaRentingInfo: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-xs" placeholder="INFO DEL COCHE A RECOGER..." />
                )}
                <Button onClick={handleAddDelivery} className="w-full h-14 bg-secondary text-white rounded-xl font-black uppercase text-[11px] shadow-xl mt-4">
                  CONFIRMAR PROGRAMACIÓN
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="premium-card border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Entregas de Hoy</p>
                <p className="text-3xl font-black mt-1 text-secondary">{stats.hoyCount}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                <Clock className="text-blue-600 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Pendientes</p>
                <p className="text-3xl font-black mt-1 text-accent">{stats.pendientesCount}</p>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <RefreshCw className="text-red-600 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Completadas</p>
                <p className="text-3xl font-black mt-1 text-emerald-600">{stats.completadasSemana}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="text-emerald-600 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Main Delivery List */}
        <div className="xl:col-span-3 space-y-6">
          <div className="flex items-center justify-between bg-white p-2 rounded-2xl border-none shadow-sm">
            <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
              <div className="flex items-center justify-between px-2">
                <TabsList className="bg-slate-100/50 rounded-xl">
                  <TabsTrigger value="all" className="rounded-lg text-[10px] font-black uppercase">Todas</TabsTrigger>
                  <TabsTrigger value="today" className="rounded-lg text-[10px] font-black uppercase">Hoy</TabsTrigger>
                  <TabsTrigger value="upcoming" className="rounded-lg text-[10px] font-black uppercase">Próximas</TabsTrigger>
                </TabsList>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                  <Input 
                    className="pl-9 bg-slate-50 border-none h-10 text-xs font-bold uppercase rounded-xl" 
                    placeholder="BUSCAR CLIENTE..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </Tabs>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
            ) : filteredDeliveries.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay entregas programadas</p>
              </div>
            ) : (
              filteredDeliveries.map((delivery) => (
                <Card key={delivery.id} className="premium-card border-none shadow-sm overflow-hidden group rounded-2xl bg-white">
                  <div className="flex flex-col md:flex-row">
                    <div className={cn("w-1.5", 
                      delivery.estado === 'Entregado' ? 'bg-emerald-500' : 
                      delivery.estado === 'Listo' ? 'bg-blue-500' : 'bg-primary'
                    )} />
                    <CardContent className="flex-1 p-6">
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 transition-colors shrink-0">
                            <Car className="text-secondary w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-black text-lg text-secondary uppercase italic leading-none mb-1">{delivery.cliente}</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-muted-foreground uppercase">{delivery.vehiculoInfo}</span>
                              {delivery.recogidaRenting && (
                                <Badge className="bg-orange-50 text-orange-600 text-[8px] font-black uppercase border-orange-100">
                                  <ArrowDownCircle className="w-2.5 h-2.5 mr-1" /> RECOGIDA
                                </Badge>
                              )}
                              {delivery.actaEnviada && (
                                <Badge className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase border-emerald-100">
                                  <Mail className="w-2.5 h-2.5 mr-1" /> ACTA ENVIADA
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-8 items-center">
                          <div className="text-center md:text-right">
                            <div className="flex items-center gap-1 text-[11px] font-black text-secondary justify-center md:justify-end uppercase">
                              <CalendarIcon className="w-3.5 h-3.5" /> {delivery.fecha}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold justify-center md:justify-end mt-0.5">
                              <Clock className="w-3.5 h-3.5" /> {delivery.hora}
                            </div>
                          </div>

                          <div className="hidden sm:block min-w-[120px]">
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Comercial</p>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-blue-100 text-[10px] flex items-center justify-center font-black text-blue-700">
                                {delivery.asesor ? delivery.asesor.slice(0, 2).toUpperCase() : "??"}
                              </div>
                              <span className="text-[10px] font-black uppercase text-secondary">{delivery.asesor || "N/A"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-xl"><MoreVertical className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 rounded-2xl border-none shadow-2xl p-2">
                                <DropdownMenuItem className="gap-3 rounded-xl py-3 text-[10px] font-black uppercase" onClick={() => toggleActa(delivery.id, !!delivery.actaEnviada)}>
                                  <Mail className="w-4 h-4 text-primary" /> {delivery.actaEnviada ? "Marcar Acta Pendiente" : "Marcar Acta Enviada"}
                                </DropdownMenuItem>
                                {delivery.estado !== 'Entregado' && (
                                  <DropdownMenuItem className="gap-3 rounded-xl py-3 text-[10px] font-black uppercase text-emerald-600" onClick={() => handleCompleteDelivery(delivery.id, delivery.vehiculoId, delivery.vehiculoInfo)}>
                                    <CheckCircle className="w-4 h-4" /> Marcar como Entregado
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem className="gap-3 rounded-xl py-3 text-[10px] font-black uppercase text-red-600" onClick={() => handleDelete(delivery.id)}>
                                  <Trash2 className="w-4 h-4" /> Eliminar Registro
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Estado de la Entrega</span>
                          <span className="text-[10px] font-black text-primary uppercase">{delivery.estado}</span>
                        </div>
                        <Progress value={delivery.progress || (delivery.estado === 'Entregado' ? 100 : delivery.estado === 'Listo' ? 80 : 30)} className="h-1.5 bg-slate-100" />
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar: Quick Checklist */}
        <div className="space-y-6">
          <Card className="premium-card border-none shadow-sm h-fit sticky top-8 rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b p-6">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-secondary">Control Operativo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Actas Hoy</span>
                    <span className="text-xs font-black text-secondary">{entregas.filter(d => d.actaEnviada && d.fecha === format(new Date(), "yyyy-MM-dd")).length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Recogidas Renting</span>
                    <span className="text-xs font-black text-secondary">{entregas.filter(d => d.recogidaRenting && d.estado !== 'Entregado').length}</span>
                  </div>
                </div>
                
                <Separator className="bg-slate-50" />
                
                <div className="space-y-3">
                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.3em] mb-4">Última Recogida Renting</p>
                  {entregas.find(d => d.recogidaRenting && d.recogidaRentingInfo) ? (
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                      <p className="text-[10px] font-black text-orange-700 uppercase leading-tight mb-1">
                        {entregas.find(d => d.recogidaRenting && d.recogidaRentingInfo)?.recogidaRentingInfo}
                      </p>
                      <p className="text-[8px] font-black text-orange-600/60 uppercase">
                        VINCULADO A: {entregas.find(d => d.recogidaRenting && d.recogidaRentingInfo)?.cliente}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[9px] font-black text-slate-300 uppercase italic">No hay recogidas activas</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card bg-secondary border-none shadow-xl rounded-[2rem] text-white overflow-hidden relative p-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full translate-x-16 -translate-y-16" />
            <div className="relative z-10 space-y-6">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-white/40">Objetivos VN</h3>
              <div className="space-y-4">
                 <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                      <span className="text-white/80">Entregas Finalizadas</span>
                      <span>{entregas.filter(d => d.estado === 'Entregado').length}/30</span>
                    </div>
                    <Progress value={(entregas.filter(d => d.estado === 'Entregado').length / 30) * 100} className="h-1.5 bg-white/10" />
                 </div>
                 <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                      <span className="text-white/80">Eficiencia Actas</span>
                      <span>{Math.round((entregas.filter(d => d.actaEnviada).length / (entregas.length || 1)) * 100)}%</span>
                    </div>
                    <Progress value={(entregas.filter(d => d.actaEnviada).length / (entregas.length || 1)) * 100} className="h-1.5 bg-white/10" />
                 </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
