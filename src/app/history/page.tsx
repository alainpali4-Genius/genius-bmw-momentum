
'use client';

import { useMemo } from "react";
import { ArrowRight, User, Search, RefreshCw, Clock, History, AlertCircle, Trash2, Edit, Plus, Move } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function MovementHistory() {
  const db = useFirestore();
  const movementsQuery = useMemo(() => query(collection(db, "movimientos"), orderBy("fecha", "desc"), limit(200)), [db]);
  const { data: movements, loading: movementsLoading } = useCollection(movementsQuery);
  const deliveriesQuery = useMemo(() => query(collection(db, "entregas"), orderBy("fecha", "desc"), limit(200)), [db]);
  const { data: deliveries, loading: deliveriesLoading } = useCollection(deliveriesQuery);
  const loading = movementsLoading || deliveriesLoading;
  const historyRows = useMemo(() => {
    const movementRows = (movements || []).map((mov: any) => ({ ...mov, _source: "movement" as const }));
    const knownDeliveryIds = new Set(movementRows.filter((mov: any) => mov.tipoAccion === "Entrega").map((mov: any) => String(mov.vehiculoId || "")));
    const deliveryRows = (deliveries || [])
      .filter((delivery: any) => String(delivery.estado || "").toLowerCase() === "entregado")
      .filter((delivery: any) => !knownDeliveryIds.has(String(delivery.vehiculoId || "")) || delivery.origen === "Registro histórico manual")
      .map((delivery: any) => {
        const dateValue = delivery.fechaEntrega || (delivery.fecha && delivery.hora ? `${delivery.fecha}T${delivery.hora}:00` : delivery.fecha);
        const parsedDate = dateValue?.toDate ? dateValue.toDate() : dateValue ? new Date(dateValue) : null;
        return {
          id: `delivery-${delivery.id}`,
          fecha: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
          tipoAccion: "Entrega",
          vehiculoInfo: delivery.vehiculoInfo || "Vehículo sin descripción",
          detalles: `Entrega registrada a ${delivery.cliente || "cliente no indicado"}${delivery.origen ? ` · ${delivery.origen}` : ""}`,
          usuario: delivery.entregaRegistradaPor || "GENIUS",
          _source: "delivery" as const
        };
      });
    return [...movementRows, ...deliveryRows].sort((a: any, b: any) => {
      const dateA = a.fecha?.toDate ? a.fecha.toDate().getTime() : a.fecha instanceof Date ? a.fecha.getTime() : 0;
      const dateB = b.fecha?.toDate ? b.fecha.toDate().getTime() : b.fecha instanceof Date ? b.fecha.getTime() : 0;
      return dateB - dateA;
    }).slice(0, 300);
  }, [movements, deliveries]);

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'Alta': return <Plus className="w-4 h-4 text-emerald-600" />;
      case 'Edicion': return <Edit className="w-4 h-4 text-blue-600" />;
      case 'Eliminacion': return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'Movimiento': return <Move className="w-4 h-4 text-primary" />;
      default: return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-secondary uppercase font-headline">Auditoría Logística</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Historial completo e inalterable de operaciones Momentum Navarra.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="premium-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center"><Clock className="w-6 h-6 text-blue-600" /></div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase">Registros 200</p>
                <p className="text-2xl font-bold text-secondary">Actividad Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center"><Plus className="w-6 h-6 text-emerald-600" /></div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase">Nuevas Altas</p>
                <p className="text-2xl font-bold text-secondary">Últimos 7 Días</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center"><History className="w-6 h-6 text-slate-600" /></div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase">Modificaciones</p>
                <p className="text-2xl font-bold text-secondary">Control Integridad</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="premium-card overflow-hidden">
        <CardHeader className="bg-white border-b p-6">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-10 h-11 bg-slate-50 border-slate-200 text-xs font-bold" placeholder="Filtrar auditoría por VIN o Usuario..." />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-20"><RefreshCw className="w-10 h-10 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-bold py-5">Fecha y Hora</TableHead>
                  <TableHead className="font-bold">Acción</TableHead>
                  <TableHead className="font-bold">Vehículo / Bastidor</TableHead>
                  <TableHead className="font-bold">Logística</TableHead>
                  <TableHead className="font-bold">Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.map((mov: any) => (
                  <TableRow key={mov.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-bold text-[10px] text-slate-500 uppercase">
                      {mov.fecha?.toDate ? format(mov.fecha.toDate(), "dd/MM/yyyy HH:mm:ss", { locale: es }) : mov.fecha instanceof Date ? format(mov.fecha, "dd/MM/yyyy HH:mm:ss", { locale: es }) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(mov.tipoAccion)}
                        <span className="text-[10px] font-black uppercase">{mov.tipoAccion}</span>
                      </div>
                    </TableCell>
                    <TableCell><span className="text-xs font-black text-secondary uppercase">{mov.vehiculoInfo}</span></TableCell>
                    <TableCell>
                      {mov.tipoAccion === 'Movimiento' ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] font-bold">{mov.origen}</Badge>
                          <ArrowRight className="w-3 h-3 text-slate-300" />
                          <Badge className="bg-primary text-white text-[9px] font-bold">{mov.destino}</Badge>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold italic">{mov.detalles || 'N/A'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center"><User className="w-3 h-3 text-blue-700" /></div>
                        <span className="text-[10px] font-black text-slate-600 uppercase">{mov.usuario}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
