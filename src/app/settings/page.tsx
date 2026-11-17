'use client';

import { useMemo, useState } from "react";
import {
  Settings, ShieldCheck, Database, Palette, MapPin, ClipboardList,
  Download, Car, Users, SlidersHorizontal, FileJson, AlertTriangle,
  RefreshCw, CheckCircle2, LockKeyhole, HardDrive, ArrowDownToLine
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection } from "@/firebase";
import { collection } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

type Section = "general" | "stock" | "backup" | "users" | "security";

const menu: { id: Section; label: string; description: string; icon: any }[] = [
  { id: "general", label: "General", description: "Parámetros y estado de la aplicación", icon: SlidersHorizontal },
  { id: "stock", label: "Gestión de stock", description: "Inventario y datos operativos", icon: Car },
  { id: "backup", label: "Exportación y copias", description: "Descargar una copia de los datos", icon: HardDrive },
  { id: "users", label: "Usuarios y contraseñas", description: "Cuentas y permisos de acceso", icon: Users },
  { id: "security", label: "Seguridad", description: "Autenticación y protección de datos", icon: LockKeyhole },
];

const collectionsToExport = ["vehiculos", "movimientos", "entregas", "incidencias"] as const;

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [active, setActive] = useState<Section>("general");
  const [exporting, setExporting] = useState(false);

  const vehiclesQuery = useMemo(() => collection(db, "vehiculos"), [db]);
  const movementsQuery = useMemo(() => collection(db, "movimientos"), [db]);
  const deliveriesQuery = useMemo(() => collection(db, "entregas"), [db]);
  const incidentsQuery = useMemo(() => collection(db, "incidencias"), [db]);
  const { data: vehicles = [], loading: vehiclesLoading } = useCollection(vehiclesQuery);
  const { data: movements = [], loading: movementsLoading } = useCollection(movementsQuery);
  const { data: deliveries = [], loading: deliveriesLoading } = useCollection(deliveriesQuery);
  const { data: incidents = [], loading: incidentsLoading } = useCollection(incidentsQuery);

  const loading = vehiclesLoading || movementsLoading || deliveriesLoading || incidentsLoading;
  const counts = [
    { label: "Vehículos", value: vehicles.length },
    { label: "Movimientos", value: movements.length },
    { label: "Entregas", value: deliveries.length },
    { label: "Incidencias", value: incidents.length },
  ];

  const exportAll = () => {
    if (loading) return;
    setExporting(true);
    try {
      const backup = {
        application: "GENIUS BMW EXPO · Momentum Navarra",
        exportedAt: new Date().toISOString(),
        formatVersion: 1,
        collections: {
          vehiculos,
          movimientos: movements,
          entregas: deliveries,
          incidencias: incidents,
        },
      };
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`genius-momentum-backup-${date}.json`, backup);
      toast({ title: "Copia descargada", description: "Se han incluido vehículos, movimientos, entregas e incidencias." });
    } catch {
      toast({ variant: "destructive", title: "No se pudo exportar", description: "Vuelve a intentarlo." });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[1450px] space-y-6 px-5 py-7 md:px-8 md:py-9">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0066b3]">Sistema · Momentum Navarra</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Configuración</h1>
          <p className="mt-1 text-sm text-slate-500">Centro de administración de GENIUS: inventario, copias de seguridad, usuarios y seguridad.</p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
          <Card className="h-fit rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-1 p-3">
              <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Administración</p>
              {menu.map(item => {
                const Icon = item.icon;
                return <button key={item.id} onClick={() => setActive(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active === item.id ? "bg-blue-50 text-[#005eb8]" : "text-slate-600 hover:bg-slate-50"}`}>
                  <Icon className="h-5 w-5 shrink-0"/>
                  <span className="min-w-0"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-[11px] text-slate-400">{item.description}</span></span>
                </button>;
              })}
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-5">
            {active === "general" && <>
              <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0066b3]"><Settings className="h-5 w-5"/></div>
                  <div className="min-w-0"><h2 className="font-semibold text-slate-900">Panel de administración</h2><p className="mt-1 text-sm leading-6 text-slate-500">Desde este menú se centraliza la gestión de la aplicación. Las acciones disponibles se habilitan de forma progresiva para proteger los datos reales del concesionario.</p></div>
                  <Badge variant="outline" className="ml-auto shrink-0">GENIUS</Badge>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { icon: MapPin, title: "Zonas logísticas", detail: "Exposición P1–P15, stock, terraza y entreplanta." },
                  { icon: ClipboardList, title: "Estados de vehículo", detail: "Exposición, stock, demo, cliente, reservado, entregado y cedido." },
                  { icon: Palette, title: "Identidad visual", detail: "Interfaz y elementos visuales Momentum." },
                  { icon: Database, title: "Base de datos", detail: "Persistencia operativa en Firebase / Firestore." },
                ].map(item => <Card key={item.title} className="rounded-xl border-slate-200 bg-white shadow-sm"><CardContent className="flex items-start gap-3 p-4"><item.icon className="mt-0.5 h-5 w-5 text-slate-500"/><div><h3 className="text-sm font-semibold text-slate-800">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p></div><CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600"/></CardContent></Card>)}
              </div>
            </>}

            {active === "stock" && <>
              <div><h2 className="text-xl font-semibold text-slate-900">Gestión de stock y datos</h2><p className="mt-1 text-sm text-slate-500">Resumen de los registros almacenados en las colecciones operativas.</p></div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{counts.map(item => <Card key={item.label} className="rounded-xl border-slate-200 bg-white shadow-sm"><CardContent className="p-4"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{loading ? "…" : item.value}</p></CardContent></Card>)}</div>
              <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="space-y-3 p-5"><div className="flex items-center gap-3"><Car className="h-5 w-5 text-[#0066b3]"/><h3 className="font-semibold text-slate-900">Inventario operativo</h3></div><p className="text-sm leading-6 text-slate-500">La edición individual de vehículos se realiza desde Stock y la ficha de cada vehículo. La eliminación masiva se mantendrá bloqueada hasta disponer de inicio de sesión, permisos de administrador y copia de seguridad verificable.</p><Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Acciones destructivas protegidas</Badge></CardContent></Card>
            </>}

            {active === "backup" && <>
              <div><h2 className="text-xl font-semibold text-slate-900">Exportación y copias de seguridad</h2><p className="mt-1 text-sm text-slate-500">Descarga una copia local de los datos operativos actuales.</p></div>
              <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-3"><div className="rounded-xl bg-blue-50 p-3 text-[#0066b3]"><FileJson className="h-6 w-6"/></div><div className="flex-1"><h3 className="font-semibold text-slate-900">Copia completa en JSON</h3><p className="mt-1 text-sm leading-6 text-slate-500">Incluye vehículos, historial de movimientos, entregas e incidencias. El archivo se descarga en tu ordenador y puede conservarse como respaldo.</p></div></div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{counts.map(item=><div key={item.label} className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{item.label}</p><p className="text-lg font-semibold tabular-nums">{loading ? "…" : item.value}</p></div>)}</div>
                <Button onClick={exportAll} disabled={loading || exporting} className="h-11 w-full bg-[#0066b3] text-white hover:bg-[#00549a] sm:w-auto"><Download className="mr-2 h-4 w-4"/>{exporting ? "Preparando copia…" : "Exportar todos los datos"}</Button>
                <p className="text-[11px] text-slate-400">La exportación no modifica ni elimina ningún registro de Firestore.</p>
              </CardContent></Card>
            </>}

            {active === "users" && <>
              <div><h2 className="text-xl font-semibold text-slate-900">Usuarios y contraseñas</h2><p className="mt-1 text-sm text-slate-500">Administración de cuentas para el futuro acceso privado a GENIUS.</p></div>
              <Card className="rounded-2xl border-amber-200 bg-amber-50/70 shadow-sm"><CardContent className="flex items-start gap-3 p-5"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"/><div><h3 className="font-semibold text-amber-950">Módulo pendiente de autenticación segura</h3><p className="mt-1 text-sm leading-6 text-amber-900/80">La aplicación todavía no tiene un sistema de acceso privado implantado. No sería seguro crear, cambiar o borrar contraseñas desde esta pantalla. Primero hay que activar Firebase Authentication, definir roles (administrador y usuario) y proteger Firestore.</p></div></CardContent></Card>
              <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="space-y-3 p-5"><h3 className="font-semibold text-slate-900">Funciones previstas</h3>{["Crear y desactivar usuarios","Restablecer contraseña mediante correo seguro","Asignar roles y permisos","Consultar actividad y último acceso"].map(v=><div key={v} className="flex items-center gap-2 text-sm text-slate-600"><ShieldCheck className="h-4 w-4 text-slate-400"/>{v}<Badge className="ml-auto" variant="outline">Pendiente</Badge></div>)}</CardContent></Card>
            </>}

            {active === "security" && <>
              <div><h2 className="text-xl font-semibold text-slate-900">Seguridad y permisos</h2><p className="mt-1 text-sm text-slate-500">Estado de la protección de datos y próximos controles.</p></div>
              <Card className="rounded-2xl border-red-200 bg-red-50/70 shadow-sm"><CardContent className="flex items-start gap-3 p-5"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700"/><div><h3 className="font-semibold text-red-950">Revisión de seguridad prioritaria</h3><p className="mt-1 text-sm leading-6 text-red-900/80">Las reglas actuales de Firestore permiten lectura y escritura sin autenticación. Antes de publicar un inicio de sesión o habilitar operaciones destructivas, es imprescindible restringir la base de datos a usuarios autenticados y validar los permisos de administrador en servidor.</p></div></CardContent></Card>
              <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="space-y-3 p-5"><h3 className="font-semibold text-slate-900">Plan de protección</h3>{["Activar Firebase Authentication","Crear roles de administrador y operador","Restringir reglas de Firestore por usuario y rol","Registrar auditoría de cambios y eliminaciones","Exigir confirmación y copia previa para vaciados masivos"].map((v,i)=><div key={v} className="flex items-center gap-3 text-sm text-slate-600"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">{i+1}</span>{v}</div>)}</CardContent></Card>
            </>}
          </div>
        </div>
        <p className="flex items-center gap-2 text-[11px] text-slate-400"><RefreshCw className="h-3.5 w-3.5"/> Los datos se consultan directamente desde Firestore. Las exportaciones son copias de lectura.</p>
      </div>
    </div>
  );
}
