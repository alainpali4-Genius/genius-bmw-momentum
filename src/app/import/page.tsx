'use client';

import { useMemo, useState } from "react";
import { collection, getDocs, writeBatch, doc, query, orderBy, limit } from "firebase/firestore";
import { useFirestore, useCollection } from "@/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClipboardPaste, FileSpreadsheet, Upload, AlertTriangle, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Row = { transporte:string; fecha:string; llegada:string; vin:string; matricula:string; comision:string; vendedor:string; cliente:string; modelo:string; color:string };
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
function parseRows(raw:string):Row[] {
 const lines=raw.split(/\r?\n/).filter(x=>x.trim());
 if(lines.length<2)return [];
 const split=(line:string)=>line.includes("\t")?line.split("\t"):line.split(/\s{2,}/);
 const headers=split(lines[0]).map(norm);
 const find=(...keys:string[])=>headers.findIndex(h=>keys.some(k=>h===k||h.includes(k)));
 const ix={transporte:find("TRANS"),fecha:find("FECHARECEPCION","FECHA"),llegada:find("LLEGADA"),vin:find("CHASIS","BASTIDOR","VIN"),matricula:find("MATRIC"),comision:find("COMISION"),vendedor:find("VEN","VENDEDOR"),cliente:find("CLIENTE","DESTINO"),modelo:find("MODELO"),color:find("COLOR")};
 if(ix.vin<0||ix.modelo<0)return [];
 return lines.slice(1).map(line=>{
  const cells=split(line);
  const get=(k:keyof typeof ix)=>ix[k]>=0?(cells[ix[k]]||"").trim():"";
  return {transporte:get("transporte"),fecha:get("fecha"),llegada:get("llegada"),vin:get("vin").replace(/\s/g,"").toUpperCase(),matricula:get("matricula"),comision:get("comision"),vendedor:get("vendedor"),cliente:get("cliente"),modelo:get("modelo"),color:get("color")};
 }).filter(r=>r.vin&&r.modelo);
}
export default function ImportLogisticsPage(){
 const db=useFirestore(); const {toast}=useToast(); const [raw,setRaw]=useState(""); const [busy,setBusy]=useState(false);
 const historyQuery=useMemo(()=>query(collection(db,"importacionesLogistica"),orderBy("fecha","desc"),limit(10)),[db]);
 const {data:historyRaw}=useCollection(historyQuery); const history=(historyRaw||[]) as any[];
 const parsedRows=useMemo(()=>parseRows(raw),[raw]);
 const rows=useMemo(()=>Array.from(new Map(parsedRows.map(r=>[r.vin,r])).values()),[parsedRows]);
 const duplicateRows=parsedRows.length-rows.length;
 const validHeader=rows.length>0;
 const importRows=async()=>{
  if(!rows.length){toast({variant:"destructive",title:"No se han detectado vehículos",description:"Copia la tabla completa, incluidos los encabezados."});return;}
  setBusy(true);
  try{
   const snap=await getDocs(collection(db,"vehiculos"));
   const existing=snap.docs.map(d=>({id:d.id,...d.data()} as any));
   const batch=writeBatch(db); let created=0,updated=0;
   const now=new Date().toISOString(); const imported:string[]=[];
   for(const r of rows){
    const match=existing.find(v=>{
     const full=String(v.vin||"").replace(/\s/g,"").toUpperCase();
     const short=String(v.vin7||"").replace(/\s/g,"").toUpperCase()||(full.length===7?full:"");
     return r.vin.length===17?full===r.vin:short===r.vin.slice(-7);
    });
    const marca=/^MINI\b/i.test(r.modelo.trim())?"MINI":"BMW";
    const colorNorm=r.color.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const colorAliases:Array<[RegExp,string]>=[
     [/black sapphire/i,"475"],[/brooklyn grey/i,"C4P"],[/fire red/i,"C68"],[/skyscraper grey/i,"C4W"],
     [/dravit grey/i,"C36"],[/arctic race blue/i,"C4R"],[/portimao blue/i,"C31"],[/alpine white/i,"300"],
     [/carbon black/i,"416"],[/sophisto grey/i,"A90"],[/black uni/i,"668"],[/mineral white/i,"A96"],
     [/san remo green/i,"C6K"],[/isle of man green/i,"C6M"],[/vegas red/i,"C77"]
    ];
    const colorCode=colorAliases.find(([pattern])=>pattern.test(r.color))?.[1]||"";
    const fechaMatch=r.fecha.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
    const fechaEntrada=fechaMatch?`${fechaMatch[3].length===2?"20"+fechaMatch[3]:fechaMatch[3]}-${fechaMatch[2]}-${fechaMatch[1]}`:"";
    const clienteOriginal=r.cliente||"";
    const categoriaComercial=/^STOCK\s*EXPOSICION$/i.test(clienteOriginal.trim())?"Stock Expo":/^DEMO$/i.test(clienteOriginal.trim())?"Demo":/^ENTREGA\s+EXTERNA/i.test(clienteOriginal.trim())?"Entrega Cliente":clienteOriginal?"Asignación cliente/renting":"Sin clasificar";
    const entidadRenting=/\b(ALPHABET|SANTANDER|BBVA|AYVENS|ARVAL)\b/i.exec(clienteOriginal)?.[1]||"";
    const fields:any={vin7:r.vin.slice(-7),marca,modelo:r.modelo,matricula:r.matricula||"",colorExterior:r.color||"",colorCorreo:r.color||"",colorCodigo:colorCode||null,colorBMW:colorCode||null,destinoLogistico:clienteOriginal,clienteLogistica:clienteOriginal,categoriaComercial,tipoLogistico:categoriaComercial,entidadRenting,transporte:r.transporte||"",fechaRecepcionCorreo:r.fecha||"",fechaEntrada,llegada:r.llegada||"",comision:r.comision||"",vendedorLogistica:r.vendedor||"",responsable:r.vendedor||"",origenImportacion:"Correo logística BMW",updatedAt:now};
    Object.keys(fields).forEach(k=>{if(fields[k]==="")delete fields[k]});
    if(match){
     if(!match.vin||String(match.vin).length===7)fields.vin=r.vin;
     batch.update(doc(db,"vehiculos",match.id),fields);updated++;
    }else{
     const newRef=doc(collection(db,"vehiculos"));
     batch.set(newRef,{...fields,vin:r.vin,estado:"Disponible",ubicacion:"Pendiente de ubicación",createdAt:now});created++;
    }
    imported.push(r.vin);
   }
   const historyRef=doc(collection(db,"importacionesLogistica"));
   batch.set(historyRef,{fecha:now,origen:"Correo logística BMW",total:rows.length,creados:created,actualizados:updated,duplicadosEnCorreo:duplicateRows,bastidores:imported,estado:"Completada"});
   await batch.commit();
   toast({title:"Importación completada",description:`${created} vehículos nuevos y ${updated} actualizados.`});setRaw("");
  }catch(e){toast({variant:"destructive",title:"Error al importar",description:"No se ha podido completar la importación. Revisa el stock antes de repetirla."});}
  finally{setBusy(false);}
 };
 return <div className="h-full overflow-y-auto bg-slate-50"><div className="mx-auto max-w-[1200px] space-y-6 px-5 py-7 md:px-8 md:py-9">
  <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0066b3]">Logística · Momentum Navarra</p><h1 className="text-3xl font-semibold tracking-tight text-slate-900">Importar correo BMW</h1><p className="mt-1 text-sm text-slate-500">Pega la tabla del correo de logística para incorporar o actualizar vehículos.</p></div>
  <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm"><CardContent className="space-y-4 p-5 md:p-6">
   <div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#0066b3]"><ClipboardPaste className="h-5 w-5"/></div><div><h2 className="font-semibold text-slate-900">1. Copiar y pegar la tabla</h2><p className="mt-1 text-sm text-slate-500">En Outlook, selecciona la tabla del correo con sus encabezados, copia y pégala aquí.</p></div></div>
   <Textarea value={raw} onChange={e=>setRaw(e.target.value)} rows={9} placeholder={"TRANS.\tFECHA RECEPCIÓN\tLLEGADA\tCHASIS\tMATRÍC.\tCOMISIÓN\tVEN.\tCLIENTE\tMODELO\tCOLOR\nPega aquí las filas del correo…"} className="min-h-[190px] rounded-lg border-slate-200 font-mono text-xs"/>
   <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-slate-500"><FileSpreadsheet className="h-4 w-4"/>{rows.length} vehículos únicos detectados{duplicateRows>0?` · ${duplicateRows} filas repetidas omitidas`:""}</div><Badge variant="outline" className={validHeader?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-amber-200 bg-amber-50 text-amber-700"}>{validHeader?"Tabla reconocida":"Esperando tabla válida"}</Badge></div>
  </CardContent></Card>
  <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm"><CardContent className="space-y-4 p-5 md:p-6">
   <div><h2 className="font-semibold text-slate-900">2. Revisar antes de importar</h2><p className="mt-1 text-sm text-slate-500">Se utiliza el bastidor para reconocer vehículos existentes. CLIENTE se conserva como destino logístico y no modifica la ubicación física ni programa una entrega.</p></div>
   {rows.length>0?<div className="overflow-x-auto rounded-lg border border-slate-100"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400"><tr>{["Bastidor","Matrícula","Modelo","Cliente / destino","Color","Llegada"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((r,i)=><tr key={i}><td className="px-3 py-3 font-mono">{r.vin}</td><td className="px-3 py-3">{r.matricula||"—"}</td><td className="px-3 py-3">{r.modelo}</td><td className="px-3 py-3">{r.cliente||"—"}</td><td className="px-3 py-3">{r.color||"—"}</td><td className="px-3 py-3">{r.llegada||"—"}</td></tr>)}</tbody></table></div>:<div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">La vista previa aparecerá cuando pegues una tabla válida.</div>}
   <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>La importación conserva el VIN completo si ya existe, actualiza el destino sin tocar la ubicación física y registra cada operación.</div>
   <Button disabled={!validHeader||busy} onClick={importRows} className="h-11 rounded-lg bg-[#0066b3] px-5 text-white hover:bg-[#00549a]"><Upload className="mr-2 h-4 w-4"/>{busy?"Importando…":"Confirmar importación"}</Button>
  </CardContent></Card>
  <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm"><CardContent className="space-y-3 p-5 md:p-6">
   <div className="flex items-center gap-2"><History className="h-4 w-4 text-[#0066b3]"/><h2 className="font-semibold text-slate-900">Historial de importaciones</h2></div><p className="text-sm text-slate-500">Últimas 10 cargas realizadas desde correo de logística.</p>
   {history.length? <div className="divide-y divide-slate-100">{history.map((item:any)=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium text-slate-800">{item.origen||"Correo logística BMW"}</p><p className="text-xs text-slate-400">{item.fecha?new Date(item.fecha).toLocaleString("es-ES"):"Fecha no disponible"}</p></div><div className="flex flex-wrap gap-2 text-xs"><Badge variant="outline">{item.total||0} filas</Badge><Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{item.creados||0} nuevos</Badge><Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">{item.actualizados||0} actualizados</Badge></div></div>)}</div>:<p className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">Todavía no hay importaciones registradas en este historial.</p>}
  </CardContent></Card>
 </div></div>;
}
