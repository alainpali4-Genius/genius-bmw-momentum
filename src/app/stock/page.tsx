'use client';

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Loader2, Car, MapPin, ArrowUpRight, Building2, User, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, writeBatch, doc } from "firebase/firestore";
import { differenceInDays, parseISO, isValid } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { getVehicleColor } from "../showroom/page";
import { BMW_COLORS, suggestedMotor, findBmwColorByName } from "@/lib/vehicle-constants";

type FilterType = 'all' | 'terraza' | 'entreplanta' | 'entrega' | 'exposicion' | 'demo' | 'destino-stockexpo' | 'destino-demo' | 'destino-renting' | 'destino-clientes' | 'entregados' | 'cedidos' | 'stocklocator' | 'todos';

export default function StockManagement() {
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehiclesQuery = useMemo(() => query(collection(db, "vehiculos"), orderBy("createdAt", "desc")), [db]);
  const { data: rawVehicles, loading } = useCollection(vehiclesQuery);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<'vehicle'|'motor'|'color'|'logistic'|'location'|'client'|'days'>('vehicle');
  const [sortDirection, setSortDirection] = useState<'asc'|'desc'>('asc');
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const requestedFilter = searchParams.get('filter') as FilterType | null;
  const validFilters: FilterType[] = ['all','terraza','entreplanta','entrega','exposicion','demo','destino-stockexpo','destino-demo','destino-renting','destino-clientes','entregados','cedidos','stocklocator','todos'];
  const [activeFilter, setActiveFilter] = useState<FilterType>(requestedFilter && validFilters.includes(requestedFilter) ? requestedFilter : 'all');
  useEffect(() => {
    const next = searchParams.get('filter') as FilterType | null;
    setActiveFilter(next && validFilters.includes(next) ? next : 'all');
  }, [searchParams]);
  const allVehicles = (rawVehicles || []) as any[];
  const normalizeVinKey = (vehicle: any) => {
    const full = String(vehicle?.vin || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const short = String(vehicle?.vin7 || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return short.length === 7 ? short : full.length >= 7 ? full.slice(-7) : "";
  };
  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, any[]>();
    allVehicles.forEach(vehicle => {
      const key = normalizeVinKey(vehicle);
      if (!key) return;
      groups.set(key, [...(groups.get(key) || []), vehicle]);
    });
    return [...groups.entries()].filter(([, group]) => group.length > 1);
  }, [allVehicles]);
  const completenessScore = (vehicle: any) => ["vin","vin7","modelo","marca","motor","colorExterior","colorCodigo","matricula","estado","ubicacion","tipoLogistico","clienteLogistica","destinoLogistico","entidadRenting","responsable","fechaEntrada","fechaRecepcionCorreo","observaciones"].reduce((score, field) => score + (String(vehicle?.[field] ?? "").trim() ? 1 : 0), 0) + (vehicle?.stockLocator ? 2 : 0);
  const cleanDuplicateVehicles = async () => {
    if (cleaningDuplicates || !duplicateGroups.length) return;
    setCleaningDuplicates(true);
    let removed = 0;
    try {
      for (const [, group] of duplicateGroups) {
        const ordered = [...group].sort((a, b) => completenessScore(b) - completenessScore(a) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
        const keeper = ordered[0];
        const merged: Record<string, any> = {};
        ordered.slice(1).forEach(duplicate => Object.entries(duplicate).forEach(([key, value]) => {
          if (["id","createdAt","updatedAt"].includes(key)) return;
          const existing = keeper[key] ?? merged[key];
          if ((existing === undefined || existing === null || existing === "") && value !== undefined && value !== null && value !== "") merged[key] = value;
        }));
        const batch = writeBatch(db);
        if (Object.keys(merged).length) batch.update(doc(db, "vehiculos", keeper.id), { ...merged, updatedAt: new Date().toISOString(), duplicadosConsolidados: ordered.slice(1).map(v => v.id) });
        ordered.slice(1).forEach(duplicate => batch.delete(doc(db, "vehiculos", duplicate.id)));
        await batch.commit();
        removed += group.length - 1;
      }
      window.location.reload();
    } catch (error) {
      console.error("Error al depurar vehículos duplicados", error);
      alert(`Limpieza parcial: se han eliminado ${removed} duplicados. Revisa el stock antes de volver a ejecutar.`);
    } finally { setCleaningDuplicates(false); }
  };
  const normalizeStatus = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const logisticCategoryLabel = (value: unknown) => { const normalized = normalizeStatus(value); if (normalized.includes("stock expo") || normalized.includes("stock exposicion")) return "Stock exposición"; return String(value || "Stock Expo").trim(); };
  const isLegacyStockExhibition = (vehicle: any) => [vehicle?.clienteLogistica, vehicle?.destinoLogistico, vehicle?.entidadRenting, vehicle?.propietario].some(value => ["stock expo","stock exposicion"].includes(normalizeStatus(value)));
  const getLogisticCategory = (vehicle: any) => isLegacyStockExhibition(vehicle) ? "Stock exposición" : isDemoVehicle(vehicle) ? "Demo" : isCustomerVehicle(vehicle) ? "Cliente" : logisticCategoryLabel(vehicle.tipoLogistico);
  const isCededVehicle = (vehicle: any) => [vehicle.estado, vehicle.ubicacion, vehicle.categoria, vehicle.categoriaStock, vehicle.categoriaComercial, vehicle.cedidoTipo, vehicle.tipoLogistico, vehicle.destinoLogistico].some(value => normalizeStatus(value).includes("cedido")) || vehicle.stockLocator === true && normalizeStatus(vehicle.cedidoTipo) === "stock locator";
  // Unifica la detección de demos: puede identificarse por tipo logístico o por ubicación.
  const isDemoVehicle = (vehicle: any) => String(vehicle.tipoLogistico || "").toLowerCase().includes("demo") || String(vehicle.ubicacion || "").toLowerCase() === "demo en uso" || String(vehicle.estado || "").toLowerCase().includes("demo");
  // Stock Locator solo existe cuando se ha marcado expresamente como tal; "cedido" por sí solo no basta.
const isCustomerVehicle = (vehicle: any) => {
  const normalize = (value: any) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\\s+/g, " ");
  const legacyStockLabel = [vehicle?.clienteLogistica, vehicle?.destinoLogistico, vehicle?.entidadRenting, vehicle?.propietario].some(value => ["stock expo","stock exposicion"].includes(normalize(value)));
  if (legacyStockLabel) return false;
  const categoryFields = [vehicle?.tipoLogistico, vehicle?.categoriaComercial, vehicle?.categoria, vehicle?.categoriaStock].map(normalize);
  const explicitNonCustomer = categoryFields.some(value => /^(stock expo|stock exposicion|demo|demo en uso|sin clasificar|cedido|cedido stock locator|stock locator)$/.test(value));
  // La clasificación explícita de stock propio/demo prevalece sobre campos antiguos
  // de cliente que puedan haber quedado guardados por importaciones anteriores.
  if (explicitNonCustomer) return false;
  const identityFields = [vehicle?.clienteLogistica, vehicle?.destinoLogistico, vehicle?.entidadRenting, vehicle?.propietario];
  const identities = identityFields.map(normalize).filter(Boolean);
  const knownGeneric = /^(asignacion cliente\/?renting|entrega cliente|cliente|renting|sin clasificar|stock expo|stock exposicion|demo|demo en uso)$/;
  if (identities.some(value => !knownGeneric.test(value))) return true;
  // En registros antiguos el nombre del cliente quedó guardado en tipoLogistico.
  const legacyType = normalize(vehicle?.tipoLogistico);
  if (legacyType && !knownGeneric.test(legacyType) && !/^(stock locator|cedido)$/.test(legacyType)) return true;
  return normalize(vehicle?.estado) === "cliente";
};
  const isStockLocatorVehicle = (vehicle: any) => vehicle.stockLocator === true || normalizeStatus(vehicle.cedidoTipo).includes("stock locator") || [vehicle.tipoLogistico, vehicle.categoria, vehicle.categoriaStock, vehicle.categoriaComercial].some(value => normalizeStatus(value).includes("stock locator"));
  // La ubicación física del plano es la fuente de verdad: cualquier vehículo en P1-P15 ocupa una plaza, independientemente de su clasificación comercial.
  const isPhysicalExhibitionLocation = (location: unknown) => /^P(?:[1-9]|1[0-5])$/i.test(String(location || "").trim());
  const isExhibitionVehicle = (vehicle: any) => isPhysicalExhibitionLocation(vehicle.ubicacion);
  // Unidades etiquetadas como Stock Expo, fuera de las plazas físicas de exposición.
  const isStockExhibitionType = (vehicle: any) => normalizeStatus(vehicle.tipoLogistico).includes("stock expo") || normalizeStatus(vehicle.tipoLogistico).includes("stock exposicion") || isLegacyStockExhibition(vehicle);
  const isReserveExhibitionStock = (vehicle: any) => {
    const category = normalizeStatus(vehicle.tipoLogistico);
    const inExhibitionBay = String(vehicle.ubicacion || "").trim().toUpperCase().startsWith("P");
    return (category.includes("stock expo") || category.includes("stock exposicion")) && !inExhibitionBay;
  };
  const vehicles = allVehicles.filter(vehicle => {
    const state = String(vehicle.estado || "").toLowerCase();
    const location = String(vehicle.ubicacion || "").toLowerCase();
    const explicitLocator = vehicle.stockLocator === true || String(vehicle.tipoLogistico || "").trim().toLowerCase() === "stock locator" || String(vehicle.categoria || "").trim().toLowerCase() === "stock locator" || String(vehicle.categoriaStock || "").trim().toLowerCase() === "stock locator";
    return state !== "entregado" && location !== "entregado" && !isCededVehicle(vehicle) && !explicitLocator;
  });

  // Completa de forma conservadora los datos que faltan en unidades ya importadas.
  // Nunca sobrescribe una motorización ni un código de color existente.
  useEffect(() => {
    if (!vehicles.length) return;
    const batch = writeBatch(db);
    let changes = 0;
    vehicles.forEach(vehicle => {
      const patch: Record<string, string> = {};
      const currentMotor = String(vehicle.motor || "").trim();
      const suggested = suggestedMotor(vehicle.modelo || "");
      // Sustituye también los valores antiguos demasiado genéricos que se guardaron
      // antes de ampliar el catálogo (p. ej. "Diésel · 2.0").
      const genericMotor = /^(di[eé]sel|gasolina)\s*[·-]\s*(1[.]\d|2[.]\d|3[.]\d)(\s*(turbo|twinpower turbo))?$/i.test(currentMotor)
        || /^(di[eé]sel|gasolina)\s*[·-].*(twinpower turbo|1[.]5|2[.]0|3[.]0)$/i.test(currentMotor) && !/\d+\s*kW.*\d+\s*CV/i.test(currentMotor)
        || /^(h[ií]brido enchufable|el[eé]ctrico)\s*[·-].*$/i.test(currentMotor) && !/\d+\s*kW.*\d+\s*CV/i.test(currentMotor)
        || /^(di[eé]sel|gasolina)\s*[·-]\s*(motor )?(twinpower turbo)$/i.test(currentMotor)
        || /^gasolina\s*[·-]\s*motor BMW M$/i.test(currentMotor)
        || /^di[eé]sel\s*[·-]\s*2[.]0$/i.test(currentMotor)
        || /1[.]5\/2[.]0/.test(currentMotor);
      const normalizedModel = String(vehicle.modelo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      // Corrige datos incompatibles importados anteriormente (ej.: 120d etiquetado como sDrive20i).
      const wrongFuelType = (/M3|M4|M2|M35I/.test(normalizedModel) && !/390 kW|375 kW|353 kW|221 kW|300 CV|530 CV|510 CV|480 CV/.test(currentMotor))
        || (/(?:18D|20D|30D|40D|35D|420D|520D|120D)$/.test(normalizedModel)
        && /gasolina|sdrive20i|twinpower turbo.*gasolina/i.test(currentMotor));
      // Los modelos actuales del configurador tienen potencia exacta; sustituimos también textos antiguos ambiguos.
      const exactCurrentModel = normalizedModel.endsWith("118D") || normalizedModel.endsWith("120D");
      if ((!currentMotor || currentMotor === "—" || genericMotor || wrongFuelType || exactCurrentModel) && suggested) {
        if (suggested !== currentMotor) patch.motor = suggested;
      }
      const currentColorCode = String(vehicle.colorCodigo || vehicle.colorBMW || "").trim().toUpperCase();
      const knownColorCode = BMW_COLORS.some(color => color.code === currentColorCode);
      const color = findBmwColorByName(vehicle.colorExterior || vehicle.colorCorreo || "");
      if (color && (!knownColorCode || currentColorCode !== color.code)) {
        patch.colorCodigo = color.code;
        patch.colorBMW = color.code;
        patch.colorExterior = color.name;
      }
      if (Object.keys(patch).length) {
        batch.update(doc(db, "vehiculos", vehicle.id), { ...patch, updatedAt: new Date().toISOString() });
        changes++;
      }
    });
    if (changes) batch.commit().catch(error => console.error("No se pudo completar la ficha de stock", error));
  }, [db, vehicles]);

  const stats = useMemo(() => ({
    total: vehicles.length,
    exposicion: allVehicles.filter(isExhibitionVehicle).length,
    terraza: vehicles.filter(v => v.ubicacion?.toLowerCase() === 'terraza').length,
    entreplanta: vehicles.filter(v => v.ubicacion?.toLowerCase() === 'entreplanta').length,
    demo: vehicles.filter(isDemoVehicle).length,
    entrega: vehicles.filter(v => v.ubicacion?.toLowerCase().includes('entrega')).length,
  }), [vehicles]);

  const filtered = useMemo(() => {
    let result = activeFilter === 'cedidos' ? allVehicles.filter(isCededVehicle) : activeFilter === 'entregados' ? allVehicles.filter(v => normalizeStatus(v.estado) === 'entregado' || normalizeStatus(v.ubicacion) === 'entregado')
      : activeFilter === 'stocklocator' ? allVehicles.filter(isStockLocatorVehicle)
      : vehicles;
    if (activeFilter === 'terraza') result = result.filter(v => v.ubicacion?.toLowerCase() === 'terraza');
    else if (activeFilter === 'entreplanta') result = result.filter(v => v.ubicacion?.toLowerCase() === 'entreplanta');
    else if (activeFilter === 'demo' || activeFilter === 'destino-demo') result = result.filter(isDemoVehicle);
    else if (activeFilter === 'entrega') result = result.filter(v => v.ubicacion?.toLowerCase().includes('entrega'));
    else if (activeFilter === 'exposicion') result = allVehicles.filter(isExhibitionVehicle);
    else if (activeFilter === 'destino-stockexpo') result = result.filter(v => normalizeStatus(v.tipoLogistico).includes('stock expo') || normalizeStatus(v.tipoLogistico).includes('stock exposicion') || isLegacyStockExhibition(v));
    else if (activeFilter === 'destino-renting') result = result.filter(v => String(v.tipoLogistico || '').toLowerCase().includes('renting') || !!v.entidadRenting);
    else if (activeFilter === 'destino-clientes') result = result.filter(v => String(v.tipoLogistico || '').toLowerCase().includes('cliente') || (!!v.clienteLogistica && !v.entidadRenting));
    const q = searchTerm.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (q) result = result.filter(v => [v.modelo,v.vin,v.vin7,v.matricula,v.entidadRenting,v.motor,v.destinoLogistico,v.clienteLogistica,v.colorExterior].some(x => String(x || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)));
    return result;
  }, [vehicles, allVehicles, activeFilter, searchTerm]);
  const sortedFiltered = useMemo(() => {
    const valueFor = (car: any) => {
      switch (sortKey) {
        case 'vehicle': return String(car.modelo || '');
        case 'motor': return String(car.motor || suggestedMotor(car.modelo || '') || '');
        case 'color': return String(getVehicleColor(car)?.name || car.colorExterior || '');
        case 'logistic': return String(isCededVehicle(car) ? (isStockLocatorVehicle(car) ? 'Cedido · Stock Locator' : 'Cedido') : getLogisticCategory(car));
        case 'location': return String(car.ubicacion || '');
        case 'client': return String(car.entidadRenting || car.clienteLogistica || car.destinoLogistico || car.propietario || '');
        case 'days': { const parsed = car.fechaEntrada ? parseISO(car.fechaEntrada) : null; return parsed && isValid(parsed) ? Math.max(0, differenceInDays(new Date(), parsed)) : -1; }
      }
    };
    return [...filtered].sort((a,b) => {
      const av = valueFor(a), bv = valueFor(b);
      const comparison = typeof av === 'number' && typeof bv === 'number' ? av-bv : String(av ?? '').localeCompare(String(bv ?? ''), 'es', {numeric:true,sensitivity:'base'});
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filtered, sortKey, sortDirection]);

  const filters = [
    {key:'exposicion' as const,label:'Exposición',value:allVehicles.filter(v => isPhysicalExhibitionLocation(v.ubicacion)).length,icon:Car},
    {key:'entreplanta' as const,label:'Entreplanta',value:vehicles.filter(v => normalizeStatus(v.ubicacion) === 'entreplanta' && !isStockExhibitionType(v)).length,icon:LayoutGrid},
    {key:'terraza' as const,label:'Terraza',value:vehicles.filter(v => normalizeStatus(v.ubicacion) === 'terraza' && !isStockExhibitionType(v)).length,icon:MapPin},
    {key:'entrega' as const,label:'Zona de entrega',value:vehicles.filter(v => normalizeStatus(v.ubicacion).includes('entrega') && !isStockExhibitionType(v)).length,icon:ArrowUpRight},
    {key:'destino-stockexpo' as const,label:'Stock exposición',value:vehicles.filter(v => normalizeStatus(v.tipoLogistico).includes('stock expo') || normalizeStatus(v.tipoLogistico).includes('stock exposicion') || isLegacyStockExhibition(v)).length,icon:Car},
  ];

  const subgroupFilters = [
    { key: 'destino-demo' as const, label: 'Demo', value: allVehicles.filter(isDemoVehicle).length, icon: Car },
    { key: 'destino-renting' as const, label: 'Renting', value: allVehicles.filter(v => String(v.tipoLogistico || '').toLowerCase().includes('renting') || !!v.entidadRenting).length, icon: Building2 },
    { key: 'destino-clientes' as const, label: 'Clientes', value: allVehicles.filter(isCustomerVehicle).length, icon: User },
    { key: 'entregados' as const, label: 'Entregados', value: allVehicles.filter(v => normalizeStatus(v.estado) === 'entregado' || normalizeStatus(v.ubicacion) === 'entregado').length, icon: ArrowUpRight },
    { key: 'cedidos' as const, label: 'Cedidos', value: allVehicles.filter(isCededVehicle).length, icon: Building2 },
    { key: 'stocklocator' as const, label: 'Stock Locator', value: allVehicles.filter(isStockLocatorVehicle).length, icon: MapPin },
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 px-5 py-7 md:px-8 md:py-9">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0066b3]">Inventario · Momentum Navarra</p><h1 className="text-3xl font-semibold tracking-tight text-slate-900">Gestión de stock</h1><p className="mt-1 text-sm text-slate-500">{stats.total} vehículos registrados en las zonas logísticas.</p></div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => router.push('/showroom')}><LayoutGrid className="mr-2 h-4 w-4"/> Ver plano</Button>
            <Button className="h-10 rounded-lg bg-[#0066b3] text-white hover:bg-[#00549a]" onClick={() => router.push('/showroom?add=true')}><Plus className="mr-2 h-4 w-4"/> Añadir vehículo</Button>
          </div>
        </div>

        <section className="space-y-3">
          {duplicateGroups.length > 0 && <Card className="border-amber-200 bg-amber-50/70 shadow-sm"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-amber-950">Se han detectado {duplicateGroups.length} bastidores repetidos</p><p className="mt-1 text-xs text-amber-800">Se conservará una ficha por VIN7, priorizando la más completa y completando sus campos vacíos antes de eliminar las demás.</p></div><Button onClick={cleanDuplicateVehicles} disabled={cleaningDuplicates} className="shrink-0 bg-amber-700 text-white hover:bg-amber-800">{cleaningDuplicates ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Depurando…</> : `Eliminar ${duplicateGroups.reduce((sum, [, group]) => sum + group.length - 1, 0)} duplicados`}</Button></CardContent></Card>}
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Stock del concesionario</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {filters.map(f => <button key={f.key} onClick={() => setActiveFilter(activeFilter === f.key ? 'all' : f.key)} className="rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-sm hover:border-blue-300">
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{f.label}</span><f.icon className="h-4 w-4 text-slate-400"/></div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{f.value}</div>
            </button>)}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Subgrupos · gestión independiente</h2>
            <span className="text-[10px] text-slate-400">Filtros secundarios</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {subgroupFilters.map(f => <button key={f.key} onClick={() => setActiveFilter(activeFilter === f.key ? 'all' : f.key)} className={`rounded-lg border p-3 text-left transition-colors ${activeFilter===f.key?'border-blue-300 bg-blue-50':'border-slate-200 bg-white hover:border-slate-300'}`}>
              <div className="flex items-center justify-between gap-1"><span className="text-[11px] font-medium text-slate-500">{f.label}</span><f.icon className="h-3.5 w-3.5 text-slate-400"/></div>
              <div className="mt-1 text-lg font-semibold text-slate-700">{f.value}</div>
            </button>)}
          </div>
        </section>

        <Card className="overflow-hidden rounded-xl border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold text-slate-900">Vehículos en stock</h2><p className="mt-1 text-xs text-slate-500">Mostrando {filtered.length} de {vehicles.length} unidades</p></div>
            <div className="relative w-full sm:max-w-[520px]"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#0066b3]"/><Input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Buscar vehículo, VIN, VIN7, matrícula, cliente o color…" className="h-14 rounded-xl border-2 border-blue-200 bg-blue-50/40 pl-12 text-base shadow-sm focus-visible:border-[#0066b3]"/></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50/80"><tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{([['vehicle','Vehículo'],['motor','Motor'],['color','Color'],['logistic','Tipo logístico'],['location','Ubicación física'],['client','Cliente / propietario'],['days','Días']] as const).map(([key,label])=><th key={key} className={key==='days'?'px-4 py-3 text-right':'px-4 py-3'}><button className="inline-flex items-center gap-1 hover:text-[#0066b3]" onClick={()=>{if(sortKey===key)setSortDirection(d=>d==='asc'?'desc':'asc');else{setSortKey(key);setSortDirection('asc')}}}>{label}<span className="text-[11px]">{sortKey===key?(sortDirection==='asc'?'↑':'↓'):'↕'}</span></button></th>)}<th className="px-5 py-3"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/> Cargando vehículos…</td></tr> :
                filtered.length===0 ? <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-400">No hay vehículos que coincidan con la búsqueda.</td></tr> :
                sortedFiltered.map(car=>{
                  const color=getVehicleColor(car);
                  const parsed=car.fechaEntrada?parseISO(car.fechaEntrada):null;
                  const days=parsed&&isValid(parsed)?Math.max(0,differenceInDays(new Date(),parsed)):null;
                  return <tr key={car.id} onClick={()=>router.push(`/showroom?s=${encodeURIComponent(car.vin7||car.vin||"")}&returnTo=%2Fstock`)} className="cursor-pointer transition-colors hover:bg-slate-50/80">
                    <td className="px-5 py-4"><div className="text-sm font-semibold text-slate-800">{car.modelo||'Modelo sin definir'}</div><div className="mt-1 font-mono text-[10px] text-slate-400">{car.vin7||car.vin||'Sin bastidor'}{car.matricula? ` · ${car.matricula}`:''}</div></td>
                    <td className="px-4 py-4 text-sm text-slate-600">{(car.motor && car.motor.trim() !== "—" ? car.motor : suggestedMotor(car.modelo||""))||'—'}</td>
                    <td className="px-4 py-4"><div className="flex items-center gap-2 text-sm text-slate-600"><span className="h-3 w-3 shrink-0 rounded-full border border-slate-300 shadow-sm" style={{backgroundColor:color?.hex||'#e5e7eb'}}/><span>{color ? <><span className="font-medium">{color.name}</span>{!color.code.startsWith("GEN-") && <span className="ml-1.5 text-[10px] text-slate-400">({color.code})</span>}</> : car.colorExterior||'—'}</span></div></td>
                    <td className="px-4 py-4"><Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">{isCededVehicle(car) ? (isStockLocatorVehicle(car) ? "Cedido · Stock Locator" : "Cedido") : getLogisticCategory(car)}</Badge></td>
                    <td className="px-4 py-4">{isPhysicalExhibitionLocation(car.ubicacion) ? <Badge className="rounded-full border-0 bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-[#00549a]">Exposición · {car.ubicacion}</Badge> : isCededVehicle(car) ? <Badge className="rounded-full border-0 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">{isStockLocatorVehicle(car) ? "Cedido · Stock Locator" : "Cedido"}</Badge> : isCustomerVehicle(car) ? <Badge className="rounded-full border-0 bg-violet-50 px-2.5 py-1 text-[10px] font-medium text-violet-700">{["Entreplanta","Terraza","Zona de entrega"].includes(String(car.ubicacion || "")) ? car.ubicacion : "Ubicación pendiente"}</Badge> : <Badge className={`rounded-full border-0 px-2.5 py-1 text-[10px] font-medium ${car.ubicacion?.startsWith('P')?'bg-blue-50 text-[#00549a]':'bg-slate-100 text-slate-600'}`}>{car.ubicacion?.startsWith('P')?`Exposición · ${car.ubicacion}`:(car.ubicacion||'Sin ubicación')}</Badge>}{(String(car.tipoLogistico||'').toLowerCase().includes('demo')||car.ubicacion==='Demo en uso'||String(car.estado||'').toLowerCase().includes('demo'))&&<div className="mt-1 space-y-0.5 text-[10px] text-slate-500"><div>Ubicación actual: {car.demoUbicacionActual||'Sin indicar'}</div><div>Lo conduce: {car.demoAsignadoA||'Sin asignar'}</div></div>}</td>
                    <td className="px-4 py-4 text-xs text-slate-600">{isDemoVehicle(car) ? (car.demoAsignadoA || '—') : isCustomerVehicle(car) && !isLegacyStockExhibition(car) ? <><div className="font-semibold text-slate-800">{car.entidadRenting || car.clienteLogistica || car.destinoLogistico || car.propietario || 'Cliente sin identificar'}</div>{car.propietario && <div className="mt-1 text-[10px] text-slate-400">Propietario: {car.propietario}</div>}</> : '—'}</td>
                    <td className="px-4 py-4 text-right text-sm tabular-nums text-slate-600">{days===null?'—':days}</td>
                    <td className="px-5 py-4 text-right"><ArrowUpRight className="ml-auto h-4 w-4 text-slate-400"/></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
