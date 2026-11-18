
"use client"

import { useState, useMemo, useEffect } from "react"
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
  ArrowDownCircle,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useFirestore, useCollection } from "@/firebase"
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, getDocs, writeBatch } from "firebase/firestore"
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
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleSelectOpen, setVehicleSelectOpen] = useState(false);
  const [deliveryVin, setDeliveryVin] = useState("");
  const [directDisposition, setDirectDisposition] = useState<"cliente" | "stockLocator">("cliente");
  const [directOwner, setDirectOwner] = useState("");
  const [locatorDealer, setLocatorDealer] = useState("");
  const [deliveryMatches, setDeliveryMatches] = useState<any[]>([]);
  const [deliveryLookupBusy, setDeliveryLookupBusy] = useState(false);
  const [deliveryConfirmBusy, setDeliveryConfirmBusy] = useState(false);
  const [deliveryDateTime, setDeliveryDateTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [selectedDeliveryVehicle, setSelectedDeliveryVehicle] = useState<any | null>(null);

  const { data: vehiculosRaw } = useCollection(query(collection(db, "vehiculos"), orderBy("modelo", "asc")));
  const entregasQuery = useMemo(() => query(collection(db, "entregas"), orderBy("fecha", "desc")), [db]);
  const { data: entregasRaw, loading } = useCollection(entregasQuery);

  const [formData, setFormData] = useState({
    vehiculoId: "",
    cliente: "",
    fecha: "",
    hora: "10:00",
    matricula: "",
    fechaPreentrega: "",
    fechaMatriculacion: "",
    zonaEntrega: "",
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
      list = list.filter(d => d.fecha > today && d.estado !== "Entregado");
    } else if (activeTab === "completed") {
      list = list.filter(d => String(d.estado || "").toLowerCase() === "entregado");
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      list = list.filter(d => 
        [d.cliente, d.vehiculoInfo, d.matricula, d.asesor, d.vin].some(value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(s))
      );
    }
    return list;
  }, [entregas, activeTab, searchTerm]);

  const stats = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const hoyCount = entregas.filter(d => d.fecha === todayStr).length;
    const pendientesCount = entregas.filter(d => d.estado !== 'Entregado').length;
    const completadas = entregas.filter(d => d.estado === 'Entregado').length;
    return { hoyCount, pendientesCount, completadas };
  }, [entregas]);

  const normalizeDeliveryVin = (value: unknown) => String(value || "").replace(/\s+/g, "").toUpperCase();

  const handleFindDeliveredVehicle = async () => {
    const entered = normalizeDeliveryVin(deliveryVin);
    if (entered.length !== 17 && entered.length !== 7) {
      toast({ variant: "destructive", title: "Bastidor no válido", description: "Pega el VIN completo de 17 caracteres o únicamente el VIN7 (últimos 7 caracteres)." });
      return;
    }
    if (entered.length === 17 && /[IOQ]/.test(entered)) {
      toast({ variant: "destructive", title: "Bastidor no válido", description: "El VIN no puede contener las letras I, O ni Q." });
      return;
    }
    setDeliveryLookupBusy(true);
    setSelectedDeliveryVehicle(null);
    setDeliveryMatches([]);
    try {
      // Consulta Firestore en tiempo real para no depender de una lista desactualizada.
      const snapshot = await getDocs(collection(db, "vehiculos"));
      const matches = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as any)).filter(vehicle => {
        const full = normalizeDeliveryVin(vehicle.vin);
        const vin7 = normalizeDeliveryVin(vehicle.vin7) || (full.length >= 7 ? full.slice(-7) : "");
        return entered.length === 17
          ? (full === entered || vin7 === entered.slice(-7))
          : (vin7 === entered || (full.length >= 7 && full.slice(-7) === entered));
      });
      setDeliveryMatches(matches);
      if (matches.length === 1) setSelectedDeliveryVehicle(matches[0]);
      if (!matches.length) toast({ variant: "destructive", title: "Vehículo no encontrado", description: "No hay ningún vehículo en la base de datos que coincida con ese bastidor o VIN7." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error de búsqueda", description: "No se ha podido consultar el stock. Inténtalo de nuevo." });
    } finally {
      setDeliveryLookupBusy(false);
    }
  };

  const handleConfirmDirectDelivery = async () => {
    if (!selectedDeliveryVehicle) return;
    setDeliveryConfirmBusy(true);
    try {
      // Segunda comprobación justo antes de confirmar: evita marcar un registro que haya cambiado.
      const snapshot = await getDocs(collection(db, "vehiculos"));
      const vehicleDoc = snapshot.docs.find(item => item.id === selectedDeliveryVehicle.id);
      if (!vehicleDoc) {
        toast({ variant: "destructive", title: "Vehículo no encontrado", description: "El registro ya no está disponible." });
        return;
      }
      const vehicle = { id: vehicleDoc.id, ...vehicleDoc.data() } as any;
      const currentState = String(vehicle.estado || "").toLowerCase();
      const currentLocation = String(vehicle.ubicacion || "").toLowerCase();
      const alreadyLocator = vehicle.stockLocator === true || String(vehicle.tipoLogistico || "").trim().toLowerCase() === "stock locator" || String(vehicle.categoria || "").trim().toLowerCase() === "stock locator" || String(vehicle.categoriaStock || "").trim().toLowerCase() === "stock locator";
      if (currentState === "entregado" || currentLocation === "entregado" || alreadyLocator) {
        toast({ title: alreadyLocator ? "Vehículo cedido por Stock Locator" : "Vehículo ya entregado", description: "Este vehículo ya está fuera del stock activo. Se conserva su ficha y trazabilidad." });
        setSelectedDeliveryVehicle(vehicle);
        return;
      }
      if (directDisposition === "cliente" && !directOwner.trim()) {
        toast({ variant: "destructive", title: "Indica el propietario", description: "Escribe el nombre del cliente o propietario antes de confirmar." });
        return;
      }
      if (directDisposition === "stockLocator" && !locatorDealer.trim()) {
        toast({ variant: "destructive", title: "Indica el concesionario", description: "Escribe el concesionario que recibe el vehículo." });
        return;
      }
      const deliveredAt = new Date(deliveryDateTime);
      if (Number.isNaN(deliveredAt.getTime())) {
        toast({ variant: "destructive", title: "Fecha de entrega no válida", description: "Revisa la fecha y hora de entrega." });
        return;
      }
      const now = new Date();
      const vinFull = normalizeDeliveryVin(vehicle.vin);
      const vin7 = normalizeDeliveryVin(vehicle.vin7) || vinFull.slice(-7);
      const vehicleInfo = `${vehicle.modelo || "Vehículo"} · ${vinFull || vin7}`;
      const batch = writeBatch(db);
      const isLocator = directDisposition === "stockLocator";
      const dispositionLabel = isLocator ? "Stock Locator" : "Entregado";
      const recipient = isLocator ? locatorDealer.trim() : directOwner.trim();
      batch.update(doc(db, "vehiculos", vehicle.id), {
        estado: isLocator ? "Cedido" : "Entregado",
        ubicacion: isLocator ? "Stock Locator" : "Entregado",
        ...(isLocator ? { stockLocator: true, stockLocatorConcesionario: recipient, fechaCesionStockLocator: now.toISOString() } : { propietario: recipient, clienteFinal: recipient, fechaEntrega: deliveredAt.toISOString() }),
        updatedAt: now.toISOString(),
        entregaRegistradaPor: "GENIUS APP",
        entregaOrigen: isLocator ? "Cesión a concesionario mediante Stock Locator" : "Confirmación manual por bastidor"
      });
      const movementRef = doc(collection(db, "movimientos"));
      batch.set(movementRef, {
        vehiculoId: vehicle.id,
        vehiculoInfo: vehicleInfo,
        tipoAccion: isLocator ? "Stock Locator" : "Entrega",
        fecha: deliveredAt,
        usuario: "GENIUS APP",
        detalles: `${isLocator ? "Vehículo cedido a otro concesionario mediante Stock Locator" : "Entrega confirmada al propietario"}: ${recipient}. VIN7: ${vin7 || "No disponible"}.`
      });
      // Si existía una entrega programada para este vehículo, también se cierra.
      entregas.filter(item => item.vehiculoId === vehicle.id && item.estado !== "Entregado").forEach(item => {
        batch.update(doc(db, "entregas", item.id), { estado: "Entregado", progress: 100, fechaEntrega: deliveredAt.toISOString() });
      });
      await batch.commit();
      const deliveredVehicle = { ...vehicle, estado: isLocator ? "Cedido" : "Entregado", ubicacion: isLocator ? "Stock Locator" : "Entregado", ...(isLocator ? { stockLocator: true, stockLocatorConcesionario: recipient, fechaCesionStockLocator: deliveredAt.toISOString() } : { propietario: recipient, clienteFinal: recipient, fechaEntrega: deliveredAt.toISOString() }) };
      setSelectedDeliveryVehicle(deliveredVehicle);
      setDeliveryMatches([deliveredVehicle]);
      setDirectOwner("");
      setLocatorDealer("");
      toast({ title: isLocator ? "Stock Locator registrado" : "Entrega confirmada", description: `${vehicle.modelo || "Vehículo"} se ha retirado del stock activo y figura como ${dispositionLabel}. Destino: ${recipient}.` });
    } catch (error: any) {
      console.error("Error al confirmar entrega manual:", error);
      const detail = error?.code === "permission-denied"
        ? "Firebase ha rechazado alguna escritura por permisos. Revisa las reglas de Firestore."
        : error?.message || "Error desconocido al guardar en Firestore.";
      toast({ variant: "destructive", title: "No se pudo confirmar la entrega", description: detail });
    } finally {
      setDeliveryConfirmBusy(false);
    }
  };

  const handleAddDelivery = async () => {
    if (!formData.vehiculoId || !formData.cliente) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Selecciona un vehículo e indica el cliente." });
      return;
    }

    const vehicle = vehiculos.find(v => v.id === formData.vehiculoId);
    const payload = {
      ...formData,
      vehiculoInfo: vehicle ? `${vehicle.modelo} (${vehicle.vin7 || vehicle.vin?.slice(-7)})` : "Vehículo desconocido",
      estado: formData.fecha ? "Fecha confirmada" : "Pendiente de fecha",
      progress: formData.fecha ? 25 : 0,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, "entregas"), payload);
      if (vehicle) {
        await updateDoc(doc(db, "vehiculos", vehicle.id), { estado: "Preparacion Entrega" });
      }

      setIsAdding(false);
      setFormData({
        vehiculoId: "", cliente: "", fecha: "", hora: "10:00", matricula: "", fechaPreentrega: "", fechaMatriculacion: "", zonaEntrega: "",
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
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 pb-24 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-secondary uppercase italic leading-none">GESTIÓN DE <span className="text-primary not-italic">ENTREGAS</span></h1>
          <p className="text-muted-foreground mt-1 text-[10px] font-black uppercase tracking-widest">Planificación logística Momentum Navarra</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAdding} onOpenChange={(open) => { setIsAdding(open); if (open && !formData.fecha) setFormData(prev => ({ ...prev, fecha: format(new Date(), "yyyy-MM-dd") })); if (!open) setVehicleSearch(""); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-blue-800 h-12 px-6 rounded-xl font-black uppercase tracking-widest shadow-lg">
                <Plus className="w-4 h-4 mr-2" /> Programar Entrega
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md max-h-[90dvh] p-0 flex flex-col overflow-hidden border-none rounded-2xl shadow-2xl">
              <div className="p-6 bg-primary text-white"><h2 className="text-lg font-black uppercase italic">NUEVA ENTREGA</h2></div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-7 space-y-4 bg-white">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Vehículo de Stock</Label>
                  <div className="relative">
  <Input value={vehicleSearch} onChange={e => { setVehicleSearch(e.target.value); setVehicleSelectOpen(true); }} className="h-11 bg-white border-slate-200 rounded-xl text-xs pr-10" placeholder="Buscar por bastidor, VIN, matrícula o modelo…" />
  {vehicleSearch && <Button type="button" variant="ghost" size="icon" aria-label="Limpiar búsqueda" onClick={() => { setVehicleSearch(""); setVehicleSelectOpen(true); }} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></Button>}
</div>
                  <Select open={vehicleSelectOpen} onOpenChange={setVehicleSelectOpen} value={formData.vehiculoId} onValueChange={(v) => {
                      const selectedVehicle = vehiculos.find(vehicle => vehicle.id === v);
                      const correoCliente = String(selectedVehicle?.clienteLogistica || selectedVehicle?.destinoLogistico || "").trim();
                      const categoriasInternas = ["STOCK EXPOSICION", "STOCK EXPOSICIÓN", "DEMO", "TNR", "YUC"];
                      const clienteReal = correoCliente && !categoriasInternas.includes(correoCliente.toUpperCase()) ? correoCliente : "";
                      setFormData(prev => ({
                        ...prev,
                        vehiculoId: v,
                        cliente: clienteReal,
                        matricula: selectedVehicle?.matricula || ""
                      }));
                      setVehicleSearch("");
                      setVehicleSelectOpen(false);
                    }}>

                    <div className="flex items-center gap-2">
                      <SelectTrigger className="h-12 flex-1 bg-slate-50 border-none rounded-xl font-bold text-xs uppercase">
                        <SelectValue placeholder="SELECCIONAR..." />
                      </SelectTrigger>
                      {formData.vehiculoId && <Button type="button" variant="outline" size="icon" aria-label="Quitar vehículo seleccionado" onClick={() => { setFormData(prev => ({ ...prev, vehiculoId: "", cliente: "", matricula: "" })); setVehicleSearch(""); setVehicleSelectOpen(false); }} className="h-10 w-10 shrink-0 rounded-xl border-slate-200 text-slate-500 hover:text-red-600"><X className="h-4 w-4" /></Button>}
                    </div>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      {vehiculos.filter(v => {
                        if (v.estado === "Entregado") return false;
                        const term = vehicleSearch.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, "");
                        if (!term) return true;
                        const haystack = [v.vin, v.vin7, v.matricula, v.modelo, v.version].filter(Boolean).join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        return haystack.includes(vehicleSearch.trim().toLowerCase()) || haystack.replace(/\s/g, "").includes(term);
                      }).map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.modelo} · {v.vin7 || v.vin?.slice(-7)}{v.matricula ? ` · ${v.matricula}` : ""}</SelectItem>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Matrícula</Label>
                    <Input value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value.toUpperCase()})} className="h-12 bg-slate-50 border-none rounded-xl font-bold text-xs" placeholder="1234 ABC" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Zona de entrega</Label>
                    <Input value={formData.zonaEntrega} onChange={e => setFormData({...formData, zonaEntrega: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold text-xs" placeholder="ZONA ENTREGA" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Fecha envío preentrega</Label>
                    <Input type="date" value={formData.fechaPreentrega} onChange={e => setFormData({...formData, fechaPreentrega: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Fecha matriculación</Label>
                    <Input type="date" value={formData.fechaMatriculacion} onChange={e => setFormData({...formData, fechaMatriculacion: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-bold text-xs" />
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

      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-4 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary"><CheckCircle2 className="h-5 w-5" /></div>
            <div>
              <h2 className="font-bold text-slate-900">Registrar una entrega realizada</h2>
              <p className="mt-1 text-sm text-slate-500">Pega el bastidor de 17 caracteres del correo de confirmación. También puedes introducir solo el VIN7.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={deliveryVin}
              onChange={e => { setDeliveryVin(e.target.value.toUpperCase()); setDeliveryMatches([]); setSelectedDeliveryVehicle(null); }}
              onKeyDown={e => { if (e.key === "Enter") handleFindDeliveredVehicle(); }}
              placeholder="Pegar bastidor completo (17 caracteres) o VIN7"
              className="h-12 rounded-xl border-slate-200 font-mono text-sm uppercase"
              maxLength={32}
            />
            <Button onClick={handleFindDeliveredVehicle} disabled={deliveryLookupBusy || deliveryConfirmBusy} className="h-12 rounded-xl bg-primary px-5 text-white">
              {deliveryLookupBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Buscar vehículo
            </Button>
          </div>
          {deliveryMatches.length > 1 && !selectedDeliveryVehicle && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">Hay varios vehículos con ese VIN7. Selecciona el correcto antes de confirmar.</p>
              {deliveryMatches.map(vehicle => (
                <button key={vehicle.id} onClick={() => setSelectedDeliveryVehicle(vehicle)} className="flex w-full flex-col rounded-lg border border-amber-100 bg-white p-3 text-left hover:border-primary">
                  <span className="text-sm font-semibold text-slate-800">{vehicle.modelo || "Modelo sin definir"}</span>
                  <span className="mt-1 font-mono text-xs text-slate-500">{normalizeDeliveryVin(vehicle.vin) || normalizeDeliveryVin(vehicle.vin7)} · {vehicle.matricula || "Sin matrícula"}</span>
                  <span className="mt-1 text-xs text-slate-500">Estado: {vehicle.estado || "Sin estado"} · Ubicación: {vehicle.ubicacion || "Sin ubicación"}</span>
                </button>
              ))}
            </div>
          )}
          {selectedDeliveryVehicle && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vehículo localizado</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{selectedDeliveryVehicle.modelo || "Modelo sin definir"}</p>
                  <p className="mt-1 font-mono text-xs text-slate-600">VIN: {normalizeDeliveryVin(selectedDeliveryVehicle.vin) || "No guardado"} · VIN7: {normalizeDeliveryVin(selectedDeliveryVehicle.vin7) || normalizeDeliveryVin(selectedDeliveryVehicle.vin).slice(-7)}</p>
                  <p className="mt-1 text-xs text-slate-500">Matrícula: {selectedDeliveryVehicle.matricula || "No disponible"} · Estado actual: {selectedDeliveryVehicle.estado || "Sin estado"}</p>
                </div>
                {(String(selectedDeliveryVehicle.estado || "").toLowerCase() === "entregado" || String(selectedDeliveryVehicle.ubicacion || "").toLowerCase() === "entregado") ? (
                  <Badge className="w-fit bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Entregado</Badge>
                ) : (selectedDeliveryVehicle.stockLocator === true || String(selectedDeliveryVehicle.tipoLogistico || "").trim().toLowerCase() === "stock locator" || String(selectedDeliveryVehicle.categoria || "").trim().toLowerCase() === "stock locator" || String(selectedDeliveryVehicle.categoriaStock || "").trim().toLowerCase() === "stock locator") ? (
                  <Badge className="w-fit bg-violet-100 text-violet-800 hover:bg-violet-100">Stock Locator</Badge>
                ) : null}
              </div>
              {(selectedDeliveryVehicle.propietario || selectedDeliveryVehicle.clienteFinal) && <p className="mt-2 text-sm text-slate-600"><strong>Propietario:</strong> {selectedDeliveryVehicle.propietario || selectedDeliveryVehicle.clienteFinal}</p>}
              {selectedDeliveryVehicle.stockLocatorConcesionario && <p className="mt-2 text-sm text-slate-600"><strong>Concesionario destinatario:</strong> {selectedDeliveryVehicle.stockLocatorConcesionario}</p>}
              {String(selectedDeliveryVehicle.estado || "").toLowerCase() !== "entregado" && String(selectedDeliveryVehicle.ubicacion || "").toLowerCase() !== "entregado" && String(selectedDeliveryVehicle.estado || "").toLowerCase() !== "cedido" && String(selectedDeliveryVehicle.ubicacion || "").toLowerCase() !== "stock locator" && (
                <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Destino del vehículo</Label>
                    <Select value={directDisposition} onValueChange={(value: "cliente" | "stockLocator") => setDirectDisposition(value)}>
                      <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cliente">Entregado a cliente / propietario</SelectItem>
                        <SelectItem value="stockLocator">Stock Locator · otro concesionario</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Fecha y hora real de entrega</Label>
                    <Input type="datetime-local" value={deliveryDateTime} onChange={e => setDeliveryDateTime(e.target.value)} className="h-11 rounded-xl bg-white" />
                    <p className="text-xs text-slate-500">Puedes introducir una fecha anterior para registrar una entrega histórica del portal BMW.</p>
                  </div>
                  {directDisposition === "cliente" ? (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-slate-500">Propietario / cliente final</Label>
                      <Input value={directOwner} onChange={e => setDirectOwner(e.target.value)} placeholder="Nombre del propietario o empresa" className="h-11 rounded-xl bg-white" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-slate-500">Concesionario que recibe el vehículo</Label>
                      <Input value={locatorDealer} onChange={e => setLocatorDealer(e.target.value)} placeholder="Nombre del concesionario / ciudad" className="h-11 rounded-xl bg-white" />
                    </div>
                  )}
                  <Button onClick={handleConfirmDirectDelivery} disabled={deliveryConfirmBusy} className="h-11 w-full rounded-xl bg-emerald-600 px-5 text-white hover:bg-emerald-700">
                    {deliveryConfirmBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    {directDisposition === "stockLocator" ? "Confirmar cesión Stock Locator" : "Confirmar entrega"}
                  </Button>
                  <p className="text-xs text-slate-500">Al confirmar, dejará de contar como stock activo. Su ficha seguirá disponible para búsquedas y control histórico.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
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
                <p className="text-3xl font-black mt-1 text-emerald-600">{stats.completadas}</p>
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
                <TabsList className="bg-slate-100/50 rounded-xl">
                  <TabsTrigger value="all" className="rounded-lg text-[10px] font-black uppercase">Todas</TabsTrigger>
                  <TabsTrigger value="today" className="rounded-lg text-[10px] font-black uppercase">Hoy</TabsTrigger>
                  <TabsTrigger value="upcoming" className="rounded-lg text-[10px] font-black uppercase">Próximas</TabsTrigger>
                  <TabsTrigger value="completed" className="rounded-lg text-[10px] font-black uppercase">Entregados ({stats.completadas})</TabsTrigger>
                </TabsList>
                <div className="relative w-full sm:w-64">
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
                  <div className="flex flex-col md:flex-row h-full">
                    <div className={cn("w-1.5 shrink-0", 
                      delivery.estado === 'Entregado' ? 'bg-emerald-500' : 
                      delivery.estado === 'Preparado' ? 'bg-emerald-500' : delivery.estado === 'En preparación' ? 'bg-amber-500' : delivery.estado === 'Fecha confirmada' ? 'bg-blue-500' : 'bg-slate-300'
                    )} />
                    <CardContent className="flex-1 p-6">
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 transition-colors shrink-0">
                            <Car className="text-secondary w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-black text-lg text-secondary uppercase italic leading-none mb-1">{delivery.cliente}</h3>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-black text-muted-foreground uppercase">{delivery.vehiculoInfo}</span>
                              {delivery.matricula && <Badge variant="outline" className="text-[9px]">{delivery.matricula}</Badge>}
                              {delivery.zonaEntrega && <Badge variant="outline" className="text-[9px]">{delivery.zonaEntrega}</Badge>}
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
                                {delivery.estado !== 'Entregado' && (["Pendiente de fecha","Fecha confirmada","En preparación","Preparado"] as const).filter(stage => stage !== delivery.estado).map(stage => (
                                  <DropdownMenuItem key={stage} className="gap-3 rounded-xl py-3 text-[10px] font-semibold" onClick={async () => {
                                    const progress = stage === "Pendiente de fecha" ? 0 : stage === "Fecha confirmada" ? 25 : stage === "En preparación" ? 60 : 90;
                                    const updates:any = { estado: stage, progress, updatedAt: new Date().toISOString() };
                                    if(stage === "En preparación" && !delivery.fechaInicioPreparacion) updates.fechaInicioPreparacion = new Date().toISOString().slice(0,10);
                                    if(stage === "Preparado" && !delivery.fechaPreparado) updates.fechaPreparado = new Date().toISOString().slice(0,10);
                                    await updateDoc(doc(db, "entregas", delivery.id), updates);
                                    toast({ title: "Fase actualizada", description: stage });
                                  }}>
                                    <RefreshCw className="w-4 h-4 text-primary" /> Marcar: {stage}
                                  </DropdownMenuItem>
                                ))}
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

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
                        {delivery.fechaPreentrega && <span>Preentrega: {delivery.fechaPreentrega}</span>}
                        {delivery.fechaMatriculacion && <span>Matriculación: {delivery.fechaMatriculacion}</span>}
                        {delivery.fechaInicioPreparacion && <span>En preparación desde: {delivery.fechaInicioPreparacion}</span>}
                        {delivery.fechaPreparado && <span>Preparado el: {delivery.fechaPreparado}</span>}
                      </div>
                      <div className="mt-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Estado de la Entrega</span>
                          <span className="text-[10px] font-black text-primary uppercase">{delivery.estado}</span>
                        </div>
                        <Progress value={delivery.progress || (delivery.estado === 'Entregado' ? 100 : delivery.estado === 'Preparado' ? 90 : delivery.estado === 'En preparación' ? 60 : delivery.estado === 'Fecha confirmada' ? 25 : 0)} className="h-1.5 bg-slate-100" />
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
