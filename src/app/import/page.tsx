'use client';

import { useMemo, useState } from "react";
import { collection, getDocs, writeBatch, doc, query, orderBy, limit } from "firebase/firestore";
import { useFirestore, useCollection } from "@/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClipboardPaste, FileSpreadsheet, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Row = { transporte:string; fecha:string; llegada:string; vin:string; matricula:string; comision:string; vendedor:string; cliente:string; modelo:string; color:string };
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
function parseRows(raw:string):Row[] {
 const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length<2)return [];
 const split=(line:string)=>line.includes("\t")?line.split("\t"):line.split(/\s{2,}/);
 const headers=split(lines[0]).map(norm);
 const find=(...keys:string[])=>headers.findIndex(h=>keys.some(k=>h===k||h.includes(k)));
 const ix={transporte:find("TRANS"),fecha:find("FECHARECEPCION","FECHA"),llegada:find("LLEGADA"),vin:find("CHASIS","BASTIDOR","VIN"),matricula:find("MATRIC"),comision:find("COMISION"),vendedor:find("VEN","VENDEDOR"),cliente:find("CLIENTE","DESTINO"),modelo:find("MODELO"),color:find("COLOR")};
 if(ix.vin<0||ix.modelo<0)return [];
 return lines.slice(1).map(line=>{const cells=split(line);const get=(k:keyof typeof ix)=>ix[k]>=0?(cells[ix[k]]||"").trim():"";return {transporte:get("transporte"),fecha:get("fecha"),llegada:get("llegada"),vin:get("vin").replace(/\s/g,"").toUpperCase(),matricula:get("matricula"),comision:get("comision"),vendedor:get("vendedor"),cliente:get("cliente"),modelo:get("modelo"),color:get("color")};}).filter(r=>r.vin&&r.modelo);
}
export default function ImportLogisticsPage(){
 const db=useFirestore(); const {toast}=useToast(); const [raw,setRaw]=useState(""); const [busy,setBusy]=useState(false);
 const historyQuery=useMemo(()=>query(collection(db,"importacionesLogistica"),orderBy("fecha","desc"),limit(10)),[db]);\n const {data:historyRaw}=useCollection(historyQuery); const history=(historyRaw||[]) as any[];
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
   const batch=writeBatch(db);
   let created=0,updated=0;
   const now=new Date().toISOString();
   const imported: string[]=[];
   for(const r of rows){
    const match=existing.find(v=>{
      const currentVin=String(v.vin||"").replace(/\s/g,"").toUpperCase();
      const currentShort=String(v.vin7||"").replace(/\s/g,"").toUpperCase() || (currentVin.length===7?currentVin:"");
      return r.vin.length===17 ? currentVin===r.vin : currentShort===r.vin.slice(-7);
    });
    const fields:any={vin7:r.vin.slice(-7),modelo:r.modelo,matricula:r.matricula||"",colorExterior:r.color||"",destinoLogistico:r.cliente||"",clienteLogistica:r.cliente||"",tipoLogistico:r.cliente||"Sin clasificar",transporte:r.transporte||"",fechaRecepcionCorreo:r.fecha||"",llegada:r.llegada||"",comision:r.comision||"",vendedorLogistica:r.vendedor||"",origenImportacion:"Correo logística BMW",updatedAt:now};
    Object.keys(fields).forEach(k=>{if(fields[k]==="")delete fields[k]});
    if(match){
      // Nunca sustituir un VIN completo por los siete caracteres del correo.
      if(!match.vin || String(match.vin).length===7) fields.vin=r.vin;
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
   toast({title:"Importación completada",description:`${created} vehículos nuevos y ${updated} actualizados. Importación registrada en el historial.`});setRaw("");
  }catch(e){toast({variant:"destructive",title:"Error al importar",description:"No se ha podido completar la importación. Revisa el stock antes de repetirla."});}
  finally{setBusy(false);}
 };
