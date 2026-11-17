'use client';

import { useMemo, useState } from "react";
import { collection, getDocs, writeBatch, doc, query, orderBy, limit } from "firebase/firestore";
import { useFirestore, useCollection } from "@/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClipboardPaste, FileSpreadsheet, Upload, AlertTriangle, History, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { suggestedMotor, findBmwColorByName } from "@/lib/vehicle-constants";

type Row = { transporte:string; fecha:string; llegada:string; vin:string; matricula:string; comision:string; vendedor:string; cliente:string; modelo:string; color:string };
type ExistingVehicle = { id:string; vin?:string; vin7?:string; [key:string]:any };
type Resolution = { row:Row; match?:ExistingVehicle; issue?:string };
const normalizeVin=(value:unknown)=>String(value||"").replace(/[^A-Z0-9]/gi,"").toUpperCase();
const suffix7=(value:unknown)=>{const v=normalizeVin(value);return v.length>=7?v.slice(-7):v;};
const validVin=(vin:string)=>vin.length===7 || (vin.length===17 && !/[IOQ]/.test(vin));

function parseRows(raw:string):Row[] {
 const lines=raw.split(/\r?\n/).filter(x=>x.trim());
 if(lines.length<2)return [];
 const split=(line:string)=>line.includes("\t")?line.split("\t"):line.split(/\s{2,}/);
 const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
 const headers=split(lines[0]).map(norm);
 const find=(...keys:string[])=>headers.findIndex(h=>keys.some(k=>h===k||h.includes(k)));
 const ix={transporte:find("TRANS"),fecha:find("FECHARECEPCION","FECHA"),llegada:find("LLEGADA"),vin:find("CHASIS","BASTIDOR","VIN"),matricula:find("MATRIC"),comision:find("COMISION"),vendedor:find("VENDEDOR","VEN"),cliente:find("CLIENTE","DESTINO"),modelo:find("MODELO"),color:find("COLOR")};
 if(ix.vin<0||ix.modelo<0)return [];
 return lines.slice(1).map(line=>{
  const cells=split(line);
  const get=(k:keyof typeof ix)=>ix[k]>=0?(cells[ix[k]]||"").trim():"";
  return {transporte:get("transporte"),fecha:get("fecha"),llegada:get("llegada"),vin:normalizeVin(get("vin")),matricula:get("matricula"),comision:get("comision"),vendedor:get("vendedor"),cliente:get("cliente"),modelo:get("modelo"),color:get("color")};
 }).filter(r=>r.vin&&r.modelo);
}

// A repeated full VIN is a duplicate. A VIN7 row and a full VIN row can be
// collapsed only when there is exactly one full VIN for that suffix.
function consolidateRows(input:Row[]) {
 const fullBySuffix=new Map<string,Set<string>>();
 input.filter(r=>r.vin.length===17).forEach(r=>{
  const suffix=suffix7(r.vin); if(!fullBySuffix.has(suffix))fullBySuffix.set(suffix,new Set());
  fullBySuffix.get(suffix)!.add(r.vin);
 });
 const unique=new Map<string,Row>(); let duplicates=0; const issues:string[]=[];
 for(const row of input){
  if(!validVin(row.vin)){issues.push(`Bastidor no válido: ${row.vin}`);continue;}
  const suffix=suffix7(row.vin); const fulls=fullBySuffix.get(suffix)||new Set<string>();
  if(row.vin.length===7 && fulls.size>1){issues.push(`El VIN7 ${suffix} corresponde a varios bastidores completos en el correo.`);continue;}
  const key=row.vin.length===17?row.vin:(fulls.size===1?[...fulls][0]:`VIN7-${suffix}`);
  if(unique.has(key)){duplicates++;continue;}
  unique.set(key,row);
 }
 return {rows:[...unique.values()],duplicates,issues};
}

function resolveRows(rows:Row[], existing:ExistingVehicle[]):Resolution[] {
 return rows.map(row=>{
  const fullMatches= row.vin.length===17 ? existing.filter(v=>normalizeVin(v.vin)===row.vin) : [];
  if(fullMatches.length>1)return {row,issue:"Hay varios registros con este VIN completo. Revisión manual necesaria."};
  if(fullMatches.length===1)return {row,match:fullMatches[0]};
  const suffix=suffix7(row.vin);
  const suffixMatches=existing.filter(v=>{
   const full=normalizeVin(v.vin);
   const short=normalizeVin(v.vin7)||suffix7(full);
   return short===suffix || (full.length===7 && full===suffix);
  });
  if(suffixMatches.length>1)return {row,issue:`VIN7 ${suffix} coincide con ${suffixMatches.length} registros. No se modificará ninguno.`};
  if(suffixMatches.length===1)return {row,match:suffixMatches[0]};
  return {row};
 }
}

export default function ImportLogisticsPage(){
 const db=useFirestore(); const {toast}=useToast(); const [raw,setRaw]=useState(""); const [busy,setBusy]=useState(false);
 const [resolutions,setResolutions]=useState<Resolution[]|null>(null);
 const historyQuery=useMemo(()=>query(collection(db,"importacionesLogistica"),orderBy("fecha","desc"),limit(10)),[db]);
 const {data:historyRaw}=useCollection(historyQuery); const history=(historyRaw||[]) as any[];
 const parsedRows=useMemo(()=>parseRows(raw),[raw]);
 const consolidated=useMemo(()=>consolidateRows(parsedRows),[parsedRows]);
 const rows=consolidated.rows;
 const duplicateRows=consolidated.duplicates;
 const invalidRows=consolidated.issues;
 const validHeader=rows.length>0 && invalidRows.length===0;
 const inspectRows=async()=>{
  if(!validHeader){toast({variant:"destructive",title:"Revisa la tabla",description:"Hay bastidores no válidos o filas que no se pueden identificar de forma segura."});return;}
  setBusy(true);
  try{
   const snap=await getDocs(collection(db,"vehiculos"));
   const existing=snap.docs.map(d=>({id:d.id,...d.data()} as ExistingVehicle));
   const resolved=resolveRows(rows,existing);
   setResolutions(resolved);
   const conflicts=resolved.filter(x=>x.issue).length;
   toast({title:"Comprobación completada",description:conflicts?(`${conflicts} coincidencias ambiguas requieren revisión; no se importarán.`):"Los bastidores se han contrastado con todo el inventario."});
  }catch(e){toast({variant:"destructive",title:"No se pudo comprobar el inventario",description:"No se ha importado nada. Comprueba la conexión y vuelve a intentarlo."});}
  finally{setBusy(false);}
 };
 const importRows=async()=>{
  if(!resolutions || resolutions.length===0){toast({variant:"destructive",title:"Falta la comprobación",description:"Pulsa primero «Comprobar coincidencias»."});return;}
  const conflicts=resolutions.filter(x=>x.issue);
  if(conflicts.length){toast({variant:"destructive",title:"Importación bloqueada",description:"Resuelve las coincidencias ambiguas antes de importar. No se ha modificado ningún vehículo."});return;}
  if(rows.length>450){toast({variant:"destructive",title:"Importación demasiado grande",description:"Divide la carga en bloques de 450 vehículos como máximo para mantener el lote dentro de los límites de Firestore."});return;}
  setBusy(true);
  try{
   // Releer justo antes de escribir: la vista previa puede haber quedado obsoleta.
   const snap=await getDocs(collection(db,"vehiculos"));
   const latest=snap.docs.map(d=>({id:d.id,...d.data()} as ExistingVehicle));
   const fresh=resolveRows(rows,latest);
   if(fresh.some(x=>x.issue)){
    setResolutions(fresh);
    toast({variant:"destructive",title:"El inventario ha cambiado",description:"Se han detectado nuevas coincidencias. Revisa el resultado antes de volver a importar."});
    return;
   }
   const batch=writeBatch(db); let created=0,updated=0;
   const now=new Date().toISOString(); const imported:string[]=[];
   for(const item of fresh){
    const r=item.row; const match=item.match;
    const marca=/^MINI\b/i.test(r.modelo.trim())?"MINI":"BMW";
    const motor=suggestedMotor(r.modelo);
    const detectedColor=findBmwColorByName(r.color);
    const colorCode=detectedColor?.code || "";
    const clienteOriginal=r.cliente||"";
    const categoriaComercial=/^STOCK\s*EXPOSICION$/i.test(clienteOriginal.trim())?"Stock Expo":/^DEMO$/i.test(clienteOriginal.trim())?"Demo":/^ENTREGA\s+EXTERNA/i.test(clienteOriginal.trim())?"Entrega Cliente":clienteOriginal?"Asignación cliente/renting":"Sin clasificar";
    const inferredState=categoriaComercial==="Stock Expo"?"Stock":categoriaComercial==="Demo"?"Demo":categoriaComercial==="Sin clasificar"?"Disponible":"Cliente";
    const fechaEntrada=String(match?.fechaEntrada || now.slice(0,10));
    const entidadRenting=/\b(ALPHABET|SANTANDER|BBVA|AYVENS|ARVAL|LEASEPLAN|ATHLON)\b/i.exec(clienteOriginal)?.[1]||"";
    const fields:any={vin7:suffix7(r.vin),marca,modelo:r.modelo,...(motor?{motor}:{}),matricula:r.matricula||"",colorExterior:r.color||"",colorCorreo:r.color||"",colorCodigo:colorCode||null,colorBMW:colorCode||null,destinoLogistico:clienteOriginal,clienteLogistica:clienteOriginal,categoriaComercial,tipoLogistico:categoriaComercial,entidadRenting,transporte:r.transporte||"",fechaRecepcionCorreo:r.fecha||"",fechaEntrada,llegada:r.llegada||"",comision:r.comision||"",vendedorLogistica:r.vendedor||"",responsable:r.vendedor||"",origenImportacion:"Correo logística BMW",updatedAt:now};
    Object.keys(fields).forEach(k=>{if(fields[k]==="")delete fields[k]});
    if(match){
     // Conserva estados y ubicaciones gestionados manualmente (demo, cliente,
     // cedido, entregado, entreplanta, etc.). Solo completa un estado vacío.
     const patch:any={...fields};
     if(!match.vin || normalizeVin(match.vin).length===7)patch.vin=r.vin;
     if(!match.estado)patch.estado=inferredState;
     if(!match.ubicacion)patch.ubicacion=inferredState==="Cliente"?"No disponible":"Pendiente de ubicación";
     batch.update(doc(db,"vehiculos",match.id),patch);updated++;
    }else{
     // ID determinista: repetir la misma importación no crea otro documento.
     // Si primero llegó solo VIN7 y luego el VIN completo, el buscador por
     // sufijo encuentra y completa el registro existente.
     const stableKey=r.vin.length===17?r.vin:`VIN7_${suffix7(r.vin)}`;
     const newRef=doc(db,"vehiculos",`IMPORT_${stableKey}`);
     batch.set(newRef,{...fields,vin:r.vin,estado:inferredState,ubicacion:inferredState==="Cliente"?"No disponible":"Pendiente de ubicación",createdAt:now},{merge:true});
     created++;
    }
    imported.push(r.vin);
   }
   const historyRef=doc(collection(db,"importacionesLogistica"));
   batch.set(historyRef,{fecha:now,origen:"Correo logística BMW",total:rows.length,creados:created,actualizados:updated,duplicadosEnCorreo:duplicateRows,bastidores:imported,estado:"Completada",conflictos:0});
   await batch.commit();
   toast({title:"Importación completada",description:`${created} vehículos nuevos y ${updated} actualizados. ${duplicateRows} filas repetidas omitidas.`});
   setRaw("");setResolutions(null);
  }catch(e){toast({variant:"destructive",title:"Error al importar",description:"No se ha confirmado la importación. Comprueba el inventario antes de repetirla."});}
  finally{setBusy(false);}
 };
 const counts=useMemo(()=>({new:resolutions?.filter(x=>!x.match&&!x.issue).length||0,updated:resolutions?.filter(x=>!!x.match&&!x.issue).length||0,conflicts:resolutions?.filter(x=>!!x.issue).length||0}),[resolutions]);
 return <div className="h-full overflow-y-auto bg-slate-50"><div className="mx-auto max-w-[1200px] space-y-6 px-5 py-7 md:px-8 md:py-9">
  <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0066b3]">Logística · Momentum Navarra</p><h1 className="text-3xl font-semibold tracking-tight text-slate-900">Importar correo BMW</h1><p className="mt-1 text-sm text-slate-500">Pega la tabla de Outlook, comprueba las coincidencias y después confirma la importación.</p></div>
  <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm"><CardContent className="space-y-4 p-5 md:p-6">
   <div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#0066b3]"><ClipboardPaste className="h-5 w-5"/></div><div><h2 className="font-semibold text-slate-900">1. Copiar y pegar la tabla</h2><p className="mt-1 text-sm text-slate-500">En Outlook, selecciona la tabla completa con encabezados y pégala aquí.</p></div></div>
   <Textarea value={raw} onChange={e=>{setRaw(e.target.value);setResolutions(null);}} rows={9} placeholder={"TRANS.\tFECHA RECEPCIÓN\tLLEGADA\tCHASIS\tMATRÍC.\tCOMISIÓN\tVEN.\tCLIENTE\tMODELO\tCOLOR\nPega aquí las filas del correo…"} className="min-h-[190px] rounded-lg border-slate-200 font-mono text-xs"/>
   <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-slate-500"><FileSpreadsheet className="h-4 w-4"/>{rows.length} bastidores candidatos únicos{duplicateRows>0?` · ${duplicateRows} repetidos omitidos`:""}</div><Badge variant="outline" className={validHeader?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-amber-200 bg-amber-50 text-amber-700"}>{validHeader?"Tabla reconocida":"Esperando tabla válida"}</Badge></div>
   {invalidRows.length>0&&<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"><strong>Filas que requieren corrección</strong>{invalidRows.map((x,i)=><p key={i} className="mt-1">{x}</p>)}</div>}
  </CardContent></Card>
  <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm"><CardContent className="space-y-4 p-5 md:p-6">
   <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#0066b3]"/><h2 className="font-semibold text-slate-900">2. Comprobar coincidencias con el stock</h2></div>
   <p className="text-sm text-slate-500">Se prioriza el VIN completo. Si no existe, se contrasta el VIN7. Si un VIN7 apunta a varios vehículos, la importación se bloquea para evitar modificar el coche equivocado.</p>
   <Button disabled={!validHeader||busy} onClick={inspectRows} variant="outline" className="h-10"> {busy?"Comprobando…":"Comprobar coincidencias"} </Button>
   {resolutions&&<><div className="flex flex-wrap gap-2 text-xs"><Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{counts.new} nuevos</Badge><Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">{counts.updated} ya existentes</Badge><Badge variant="outline" className={counts.conflicts?"border-red-300 text-red-700":"border-slate-200"}>{counts.conflicts} conflictos</Badge></div>
    <div className="max-h-[320px] overflow-auto rounded-lg border border-slate-100"><table className="w-full min-w-[720px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400"><tr>{["Bastidor","Modelo","Cliente / destino","Resultado"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{resolutions.map((item,i)=><tr key={i}><td className="px-3 py-3 font-mono">{item.row.vin}</td><td className="px-3 py-3">{item.row.modelo}</td><td className="px-3 py-3">{item.row.cliente||"—"}</td><td className="px-3 py-3">{item.issue?<span className="font-medium text-red-700">{item.issue}</span>:item.match?<span className="font-medium text-blue-700">Actualizar registro existente · {item.match.modelo||item.match.id}</span>:<span className="font-medium text-emerald-700">Crear nuevo vehículo</span>}</td></tr>)}</tbody></table></div>
   </>}
   <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>Los registros existentes conservan su estado y ubicación manuales. La fecha de entrada se mantiene si ya estaba registrada; los vehículos nuevos reciben la fecha del día de alta. No importes grandes históricos hasta revisar los primeros resultados.</div>
   <Button disabled={!resolutions||busy||counts.conflicts>0} onClick={importRows} className="h-11 rounded-lg bg-[#0066b3] px-5 text-white hover:bg-[#00549a]"><Upload className="mr-2 h-4 w-4"/>{busy?"Importando…":"Confirmar importación"}</Button>
  </CardContent></Card>
  <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm"><CardContent className="space-y-3 p-5 md:p-6">
   <div className="flex items-center gap-2"><History className="h-4 w-4 text-[#0066b3]"/><h2 className="font-semibold text-slate-900">Historial de importaciones</h2></div><p className="text-sm text-slate-500">Últimas 10 cargas realizadas desde correo de logística.</p>
   {history.length?<div className="divide-y divide-slate-100">{history.map((item:any)=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium text-slate-800">{item.origen||"Correo logística BMW"}</p><p className="text-xs text-slate-400">{item.fecha?new Date(item.fecha).toLocaleString("es-ES"):"Fecha no disponible"}</p></div><div className="flex flex-wrap gap-2 text-xs"><Badge variant="outline">{item.total||0} filas</Badge><Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{item.creados||0} nuevos</Badge><Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">{item.actualizados||0} actualizados</Badge></div></div>)}</div>:<p className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">Todavía no hay importaciones registradas en este historial.</p>}
  </CardContent></Card>
 </div></div>;
}
