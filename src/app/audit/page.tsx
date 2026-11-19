"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, RefreshCw, Search, ClipboardCheck, ArrowRight, Wrench } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useFirestore, useCollection } from "@/firebase"
import { collection, query, updateDoc, doc, addDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

const norm = (v: unknown) => String(v ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase()
const vinKey = (v: any) => norm(v?.vin).length >= 7 ? norm(v.vin).slice(-7) : norm(v?.vin7)
const isDelivered = (v: any) => norm(v?.estado) === "ENTREGADO" || norm(v?.ubicacion) === "ENTREGADO"
const activeCategory = (v: any) => String(v?.tipoLogistico || v?.categoriaComercial || v?.estado || "Sin clasificar")

export default function VehicleAuditPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState("")
  const vehiclesQuery = useMemo(() => query(collection(db, "vehiculos")), [db])
  const deliveriesQuery = useMemo(() => query(collection(db, "entregas")), [db])
  const { data: vehiclesRaw, loading: vehiclesLoading } = useCollection(vehiclesQuery)
  const { data: deliveriesRaw, loading: deliveriesLoading } = useCollection(deliveriesQuery)
  const vehicles = (vehiclesRaw || []) as any[]
  const deliveries = (deliveriesRaw || []) as any[]
  const audit = useMemo(() => {
    const deliveryByVin = new Map<string, any[]>()
    const deliveryByVehicle = new Map<string, any[]>()
    deliveries.forEach(d => {
      const key = norm(d.vin)
      if (key) deliveryByVin.set(key, [...(deliveryByVin.get(key) || []), d])
      if (d.vehiculoId) deliveryByVehicle.set(String(d.vehiculoId), [...(deliveryByVehicle.get(String(d.vehiculoId)) || []), d])
    })
    const duplicateMap = new Map<string, any[]>()
    vehicles.forEach(v => { const key = vinKey(v); if (key) duplicateMap.set(key, [...(duplicateMap.get(key) || []), v]) })
    const duplicates = [...duplicateMap.entries()].filter(([, group]) => group.length > 1)
    const deliveredActive = vehicles.map(v => {
      const linked = [...(deliveryByVehicle.get(String(v.id)) || []), ...(deliveryByVin.get(norm(v.vin)) || [])]
      const completed = linked.filter(d => norm(d.estado) === "ENTREGADO" || d.fechaEntrega || String(d.origen || "").toLowerCase().includes("históric"))
      return { vehicle: v, deliveries: [...new Map(completed.map(d => [d.id, d])).values()] }
    }).filter(x => x.deliveries.length && !isDelivered(x.vehicle))
    const unmatched = deliveries.filter(d => (norm(d.vin) || d.vehiculoId) && !vehicles.some(v => (d.vehiculoId && String(v.id) === String(d.vehiculoId)) || (norm(d.vin) && norm(v.vin) === norm(d.vin))) && (norm(d.estado) === "ENTREGADO" || d.fechaEntrega || String(d.origen || "").toLowerCase().includes("históric")))
    const already = vehicles.filter(isDelivered)
    return { deliveredActive, unmatched, duplicates, already }
  }, [vehicles, deliveries])
  const filtered = useMemo(() => audit.deliveredActive.filter(({vehicle, deliveries: linked}) => {
    const q = search.toLowerCase()
    return !q || [vehicle.modelo, vehicle.vin, vehicle.vin7, vehicle.matricula, vehicle.clienteLogistica, vehicle.propietario, ...linked.map(d=>d.cliente)].some(v=>String(v||"").toLowerCase().includes(q))
  }), [audit, search])
  const fix = async (item: any) => {
    const v = item.vehicle
    if (!v?.id || busyId) return
    setBusyId(String(v.id))
    try {
      const latest = [...item.deliveries].sort((a,b)=>String(b.fechaEntrega||b.fecha||"").localeCompare(String(a.fechaEntrega||a.fecha||"")))[0]
      const client = latest?.cliente || v.clienteLogistica || v.propietario || ""
      const now = new Date().toISOString()
      await updateDoc(doc(db, "vehiculos", v.id), { estado: "Entregado", ubicacion: "Entregado", propietario: client, clienteFinal: client, fechaEntrega: latest?.fechaEntrega || latest?.fecha || now, entregaAuditada: true, entregaAuditadaAt: now, updatedAt: now })
      await addDoc(collection(db, "movimientos"), { vehiculoId: v.id, vehiculoInfo: v.modelo || "Vehículo", tipoAccion: "Edicion", fecha: new Date(), usuario: "AUDITORÍA GENIUS", detalles: "Corrección de estado: entrega histórica localizada. Vehículo marcado como Entregado." })
      toast({ title: "Vehículo corregido", description: "Se ha retirado de las categorías activas y marcado como Entregado." })
    } catch (e: any) {
      toast({ title: "No se pudo corregir", description: e?.message || "Error al actualizar el vehículo", variant: "destructive" })
    } finally { setBusyId("") }
  }
  const loading = vehiclesLoading || deliveriesLoading
  return <div className="mx-auto max-w-[1600px] p-4 md:p-8 space-y-6">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div><div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Control de integridad</div><h1 className="text-3xl font-bold tracking-tight text-secondary mt-1">Auditoría de vehículos y entregas</h1><p className="text-muted-foreground mt-2">Cruza el stock actual con entregas registradas para localizar vehículos que deberían haber salido del stock activo.</p></div>
      <Button variant="outline" onClick={()=>window.location.reload()}><RefreshCw className="h-4 w-4 mr-2"/>Actualizar auditoría</Button>
    </div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <Card><CardContent className="pt-5"><div className="text-sm text-muted-foreground">Vehículos revisados</div><div className="text-3xl font-bold">{loading ? "…" : vehicles.length}</div></CardContent></Card>
      <Card className="border-amber-200"><CardContent className="pt-5"><div className="text-sm text-muted-foreground">Entregados que siguen activos</div><div className="text-3xl font-bold text-amber-600">{loading ? "…" : audit.deliveredActive.length}</div></CardContent></Card>
      <Card><CardContent className="pt-5"><div className="text-sm text-muted-foreground">Entregas sin vehículo vinculado</div><div className="text-3xl font-bold">{loading ? "…" : audit.unmatched.length}</div></CardContent></Card>
      <Card><CardContent className="pt-5"><div className="text-sm text-muted-foreground">VIN duplicados</div><div className="text-3xl font-bold">{loading ? "…" : audit.duplicates.length}</div></Card></Card>
    </div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5"/>Correcciones sugeridas</CardTitle><CardDescription>Solo se muestran vehículos con entrega registrada y que todavía no figuran como entregados. La corrección se ejecuta individualmente y registra un movimiento.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input className="pl-10 h-12" placeholder="Buscar modelo, VIN, matrícula o cliente…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        {loading ? <div className="py-12 text-center"><RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary"/></div> : filtered.length ? <div className="space-y-3">{filtered.map(({vehicle, deliveries: linked})=><div key={vehicle.id} className="rounded-xl border p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div className="min-w-0 space-y-2"><div className="flex flex-wrap items-center gap-2"><Badge variant="destructive">Entrega detectada</Badge><Badge variant="outline">{activeCategory(vehicle)}</Badge></div><div className="font-bold text-secondary">{vehicle.modelo || "Vehículo sin modelo"}</div><div className="text-sm text-muted-foreground">VIN: {vehicle.vin || vehicle.vin7 || "No disponible"} · Matrícula: {vehicle.matricula || "—"}</div><div className="text-sm">Entrega: {linked.map(d=>d.cliente).filter(Boolean).join(", ") || "Cliente no identificado"} · {linked.map(d=>d.fechaEntrega || d.fecha).filter(Boolean).join(", ")}</div></div><Button disabled={busyId===String(vehicle.id)||!!busyId} onClick={()=>fix({vehicle,deliveries:linked})} className="shrink-0"><ClipboardCheck className="h-4 w-4 mr-2"/>{busyId===String(vehicle.id)?"Corrigiendo…":"Marcar como entregado"}<ArrowRight className="h-4 w-4 ml-2"/></Button></div>)}</div> : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center"><CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600"/><p className="font-semibold mt-2">No hay vehículos activos con entrega histórica detectada.</p></div>}
      </CardContent>
    </Card>
    <div className="grid lg:grid-cols-2 gap-4">
      <Card><CardHeader><CardTitle>Entregas sin vincular</CardTitle><CardDescription>Registros históricos que no coinciden con ningún vehículo del inventario.</CardDescription></CardHeader><CardContent>{audit.unmatched.length ? <div className="space-y-2">{audit.unmatched.slice(0,50).map(d=><div key={d.id} className="border rounded-lg p-3 text-sm"><div className="font-semibold">{d.vehiculoInfo || d.modelo || "Vehículo"}</div><div className="text-muted-foreground">VIN: {d.vin || "—"} · Cliente: {d.cliente || "—"} · Fecha: {d.fechaEntrega || d.fecha || "—"}</div></div>)}</div> : <p className="text-sm text-muted-foreground">No se detectan entregas históricas sin vehículo asociado.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>VIN duplicados</CardTitle><CardDescription>Registros con el mismo VIN7. Revisar antes de consolidar.</CardDescription></CardHeader><CardContent>{audit.duplicates.length ? <div className="space-y-2">{audit.duplicates.map(([key, group])=><div key={key} className="border rounded-lg p-3"><div className="font-semibold">VIN7: {key}</div>{group.map((v:any)=><div key={v.id} className="text-sm text-muted-foreground">{v.modelo || "Vehículo"} · {v.vin || v.vin7} · {v.tipoLogistico || v.estado || "Sin categoría"}</div>)}</div>)}</div> : <p className="text-sm text-muted-foreground">No se detectan VIN duplicados.</p>}</CardContent></Card>
    </div>
    <p className="text-xs text-muted-foreground">La auditoría no modifica datos por sí sola. Las correcciones individuales actualizan estado y ubicación, y generan un registro de auditoría.</p>
  </div>
}
