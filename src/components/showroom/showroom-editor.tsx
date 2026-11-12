"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlignCenter, Grid3X3, Minus, Plus, Redo2, RotateCcw, RotateCw, Save, Undo2, X } from "lucide-react";

type Plaza = { id: string; label?: string; x: number; y: number; width: number; height: number; rotation: number; zone: string; color?: string };
type Props = {
  vehicles: any[];
  movingVehicleId: string | null;
  onPlaceVehicle: (vehicleId: string, plazaId: string) => void;
  onSelectVehicle: (vehicleId: string) => void;
  onCancelMove: () => void;
};

const DEFAULTS: Plaza[] = [
  ...["P1","P2","P3","P4"].map((id,i)=>({id,label:id,x:70+i*330,y:80,width:250,height:150,rotation:0,zone:"Exposición"})),
  ...["P5","P6","P7","P8"].map((id,i)=>({id,label:id,x:70+i*330,y:270,width:250,height:150,rotation:0,zone:"Exposición"})),
  ...["P9","P10","P11","P12"].map((id,i)=>({id,label:id,x:70+i*330,y:650,width:250,height:150,rotation:0,zone:"Exposición"})),
  {id:"P15",label:"P15 · M",x:70,y:850,width:250,height:150,rotation:0,zone:"Plataforma M",color:"#fee2e2"},
  {id:"P14",label:"P14",x:400,y:850,width:250,height:150,rotation:0,zone:"Plataforma estándar",color:"#e2e8f0"},
  {id:"P13",label:"P13 · i",x:1390,y:850,width:250,height:150,rotation:0,zone:"Plataforma BMW i",color:"#dbeafe"}
];

const clone = (items: Plaza[]) => items.map(p=>({...p}));

export default function ShowroomEditor({vehicles,movingVehicleId,onPlaceVehicle,onSelectVehicle,onCancelMove}:Props) {
  const db = useFirestore();
  const [plazas,setPlazas] = useState<Plaza[]>(DEFAULTS);
  const [selected,setSelected] = useState<string|null>(null);
  const [editing,setEditing] = useState(false);
  const [zoom,setZoom] = useState(0.72);
  const [showGrid,setShowGrid] = useState(true);
  const [saved,setSaved] = useState(true);
  const [loading,setLoading] = useState(true);
  const [history,setHistory] = useState<Plaza[][]>([]);
  const [future,setFuture] = useState<Plaza[][]>([]);
  const dragRef = useRef<{id:string;startX:number;startY:number;originX:number;originY:number;before:Plaza[]}|null>(null);
  const selectedPlaza = plazas.find(p=>p.id===selected) || null;

  useEffect(()=>{ let alive=true; (async()=>{ try { const snap=await getDoc(doc(db,"configuracion","showroomLayout")); if(alive && snap.exists() && Array.isArray(snap.data().plazas) && snap.data().plazas.length) setPlazas(snap.data().plazas as Plaza[]); } catch(e){ console.error("No se pudo cargar el plano",e); } finally { if(alive) setLoading(false); } })(); return ()=>{alive=false}; },[db]);

  const commit = useCallback((next:Plaza[])=>{ setHistory(h=>[...h.slice(-39),clone(plazas)]); setFuture([]); setPlazas(next); setSaved(false); },[plazas]);
  const save = async()=>{ try { await setDoc(doc(db,"configuracion","showroomLayout"),{plazas,updatedAt:new Date().toISOString()},{merge:true}); setSaved(true); return true; } catch(e){ console.error(e); alert("No se pudo guardar la distribución. Comprueba la conexión."); return false; } };
  const updateSelected=(patch:Partial<Plaza>)=>{ if(!selected) return; commit(plazas.map(p=>p.id===selected?{...p,...patch}:p)); };
  const undo=()=>{ if(!history.length)return; const previous=history[history.length-1]; setFuture(f=>[clone(plazas),...f]); setPlazas(previous); setHistory(h=>h.slice(0,-1)); setSaved(false); };
  const redo=()=>{ if(!future.length)return; setHistory(h=>[...h,clone(plazas)]); setPlazas(future[0]); setFuture(f=>f.slice(1)); setSaved(false); };
  const addPlaza=()=>{ let n=1; while(plazas.some(p=>p.id===`P${n}`)) n++; const item:Plaza={id:`P${n}`,label:`P${n}`,x:180+(n%5)*55,y:180+Math.floor(n/5)*55,width:230,height:145,rotation:0,zone:"Exposición"}; commit([...plazas,item]); setSelected(item.id); };
  const align=()=>{ const regular=plazas.filter(p=>!["P13","P14","P15"].includes(p.id)).sort((a,b)=>a.y-b.y||a.x-b.x); let index=0; const next=plazas.map(p=>{if(["P13","P14","P15"].includes(p.id))return p;const i=index++;return {...p,x:70+(i%4)*330,y:70+Math.floor(i/4)*190};}); commit(next); };
  const startDrag=(e:React.PointerEvent<HTMLDivElement>,p:Plaza)=>{ if(!editing)return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); dragRef.current={id:p.id,startX:e.clientX,startY:e.clientY,originX:p.x,originY:p.y,before:clone(plazas)}; setSelected(p.id); };
  const moveDrag=(e:React.PointerEvent<HTMLDivElement>)=>{ const d=dragRef.current;if(!d)return; const dx=(e.clientX-d.startX)/zoom,dy=(e.clientY-d.startY)/zoom; setPlazas(old=>old.map(p=>p.id===d.id?{...p,x:Math.max(0,d.originX+dx),y:Math.max(0,d.originY+dy)}:p));setSaved(false); };
  const endDrag=()=>{ if(dragRef.current){setHistory(h=>[...h.slice(-39),dragRef.current!.before]);setFuture([]);dragRef.current=null;} };
  const handleResize=(e:React.PointerEvent<HTMLDivElement>,p:Plaza)=>{ if(!editing)return; e.preventDefault();e.stopPropagation();const sx=e.clientX,sy=e.clientY,sw=p.width,sh=p.height,before=clone(plazas);const onMove=(ev:PointerEvent)=>setPlazas(old=>old.map(v=>v.id===p.id?{...v,width:Math.max(100,sw+(ev.clientX-sx)/zoom),height:Math.max(80,sh+(ev.clientY-sy)/zoom)}:v));const onUp=()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);setHistory(h=>[...h.slice(-39),before]);setFuture([]);setSaved(false);};window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp); };
  const occupied=useMemo(()=>{const m=new Map<string,any>();vehicles.forEach(v=>{if(v.ubicacion)m.set(v.ubicacion,v)});return m;},[vehicles]);

  return <div className="flex h-full min-h-0 flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-black uppercase italic text-slate-800">Plano de exposición</h2><div className="mt-1 flex flex-wrap gap-2 text-xs"><Badge variant="outline">{plazas.length} plazas</Badge><Badge className="bg-emerald-600">{plazas.filter(p=>occupied.has(p.id)).length} ocupadas</Badge><Badge variant="secondary">{plazas.filter(p=>!occupied.has(p.id)).length} libres</Badge></div></div>
      <div className="flex items-center gap-2"><span className="text-xs text-slate-500">{saved?"Guardado":"Cambios sin guardar"}</span><Button onClick={async()=>{if(editing){if(await save())setEditing(false);}else setEditing(true);}} variant={editing?"destructive":"default"}>{editing?"Finalizar edición":"Editar plano"}</Button></div>
    </div>
    {editing&&<div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2 shadow-sm">
      <Button variant="outline" onClick={addPlaza}><Plus className="mr-1 h-4 w-4"/> Nueva plaza</Button>
      <Button variant="outline" onClick={align}><AlignCenter className="mr-1 h-4 w-4"/> Alinear</Button>
      <Button variant="outline" size="icon" onClick={undo} disabled={!history.length}><Undo2 className="h-4 w-4"/></Button>
      <Button variant="outline" size="icon" onClick={redo} disabled={!future.length}><Redo2 className="h-4 w-4"/></Button>
      <Button variant="outline" size="icon" onClick={()=>setShowGrid(v=>!v)}><Grid3X3 className="h-4 w-4"/></Button>
      <span className="text-xs text-slate-500">Arrastra las plazas para moverlas; usa la esquina para cambiar su tamaño.</span>
      <Button className="ml-auto" onClick={save}><Save className="mr-2 h-4 w-4"/> Guardar plano</Button>
    </div>}
    <div className={`grid min-h-0 flex-1 gap-3 ${editing ? "xl:grid-cols-[minmax(0,1fr)_280px]" : "grid-cols-1"}`}>
      <div className="relative h-full min-h-[560px] overflow-auto rounded-xl border border-slate-300 bg-slate-100 shadow-inner">
        <div className="sticky right-3 top-3 z-30 ml-auto flex w-fit gap-1 rounded-lg border bg-white/95 p-1 shadow"><Button size="icon" variant="ghost" onClick={()=>setZoom(z=>Math.max(.35,z-.1))}><Minus className="h-4 w-4"/></Button><span className="flex items-center px-1 text-xs font-bold">{Math.round(zoom*100)}%</span><Button size="icon" variant="ghost" onClick={()=>setZoom(z=>Math.min(1.5,z+.1))}><Plus className="h-4 w-4"/></Button></div>
        <div style={{width:1700*zoom,height:1120*zoom,backgroundImage:showGrid?"radial-gradient(#cbd5e1 1px, transparent 1px)":undefined,backgroundSize:`${20*zoom}px ${20*zoom}px`}}>
          <div className="relative origin-top-left" style={{width:1700,height:1120,transform:`scale(${zoom})`,transformOrigin:"top left"}}>
            <div className="absolute left-10 top-5 rounded bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-500">Momentum Navarra · Exposición</div>
            <div className="absolute left-10 top-[540px] h-[105px] w-[1600px] rounded-lg border-y border-slate-300 bg-slate-200/90 flex items-center justify-center text-xs font-bold uppercase tracking-[.2em] text-slate-500">Pasillo central · atención y circulación</div>
            <div className="absolute bottom-5 left-10 right-10 rounded-lg bg-[#172f50] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white">Entrada showroom · BMW · MINI</div>
            {plazas.map(p=>{const v=occupied.get(p.id);const tint=p.color||(p.id==="P13"?"#dbeafe":p.id==="P15"?"#fee2e2":p.id==="P14"?"#e2e8f0":"#ffffff");return <div key={p.id} onPointerDown={e=>startDrag(e,p)} onPointerMove={moveDrag} onPointerUp={endDrag} onDragOver={e=>{if(!editing)e.preventDefault();}} onDrop={e=>{if(editing)return;e.preventDefault();const vehicleId=e.dataTransfer.getData("vehicleId");if(vehicleId)onPlaceVehicle(vehicleId,p.id);}} onClick={()=>{setSelected(p.id);if(movingVehicleId)onPlaceVehicle(movingVehicleId,p.id);else if(v&&!editing)onSelectVehicle(v.id);}} className={`absolute flex select-none flex-col items-center justify-center rounded-xl border-2 shadow-sm ${selected===p.id?"border-blue-600 ring-2 ring-blue-200":"border-slate-300"} ${editing?"cursor-move":"cursor-pointer"}`} style={{left:p.x,top:p.y,width:p.width,height:p.height,transform:`rotate(${p.rotation}deg)`,background:tint,touchAction:"none"}}>
              <span className="absolute left-2 top-1 text-[10px] font-black text-slate-500">{p.label||p.id}</span>
              {v?<button draggable onDragStart={e=>e.dataTransfer.setData("vehicleId",v.id)} onClick={e=>{e.stopPropagation();if(!editing)onSelectVehicle(v.id);}} className="flex h-[58%] w-[78%] flex-col items-center justify-center rounded-lg border border-black/20 px-2 text-center text-white shadow-lg" style={{background:(v.colorHex||({"300":"#f5f5f5","416":"#111111","475":"#1a1a1a","C31":"#004d8d","C36":"#5d5a55"}[v.colorCodigo||v.colorBMW]||"#777777")),color:(["300","A96"].includes(v.colorCodigo||v.colorBMW)?"#111":"#fff")}}><b className="max-w-full truncate text-[11px] uppercase">{v.modelo}</b><span className="text-xs font-mono font-bold">{v.vin7}</span></button>:<span className="text-xs font-bold text-slate-300">{p.zone==="Exposición"?"LIBRE":p.zone}</span>}
              {editing&&selected===p.id&&<><button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();updateSelected({rotation:(p.rotation+90)%360});}} className="absolute -right-3 -top-3 rounded-full border bg-white p-1 text-slate-700 shadow"><RotateCw className="h-3 w-3"/></button><div onPointerDown={e=>handleResize(e,p)} className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded border-2 border-white bg-blue-600 shadow"/></>}
            </div>})}
          </div>
        </div>
      </div>
      {editing && <aside className="rounded-xl border bg-white p-4 shadow-sm">
        {selectedPlaza?<><div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-slate-800">Plaza seleccionada</h3><button onClick={()=>setSelected(null)}><X className="h-4 w-4"/></button></div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Nombre visible</label><Input value={selectedPlaza.label||selectedPlaza.id} disabled={!editing} onChange={e=>updateSelected({label:e.target.value})} className="mb-3"/>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Zona</label><Select disabled={!editing} value={selectedPlaza.zone} onValueChange={v=>updateSelected({zone:v})}><SelectTrigger className="mb-3"><SelectValue/></SelectTrigger><SelectContent>{["Exposición","Plataforma BMW i","Plataforma estándar","Plataforma M","Atención","Espera","Circulación"].map(z=><SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent></Select>
          <div className="mb-3 grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Ancho</label><Input type="number" disabled={!editing} value={Math.round(selectedPlaza.width)} onChange={e=>updateSelected({width:Math.max(100,Number(e.target.value)||100)})}/></div><div><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Alto</label><Input type="number" disabled={!editing} value={Math.round(selectedPlaza.height)} onChange={e=>updateSelected({height:Math.max(80,Number(e.target.value)||80)})}/></div></div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Rotación</label><div className="mb-4 flex items-center justify-between"><Button disabled={!editing} variant="outline" size="icon" onClick={()=>updateSelected({rotation:(selectedPlaza.rotation+270)%360})}><RotateCcw className="h-4 w-4"/></Button><b>{selectedPlaza.rotation}°</b><Button disabled={!editing} variant="outline" size="icon" onClick={()=>updateSelected({rotation:(selectedPlaza.rotation+90)%360})}><RotateCw className="h-4 w-4"/></Button><Button disabled={!editing} variant="ghost" onClick={()=>updateSelected({rotation:0})}>Reset</Button></div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Color de plataforma</label><Input disabled={!editing} type="color" value={selectedPlaza.color||"#ffffff"} onChange={e=>updateSelected({color:e.target.value})}/>
          {editing&&<Button variant="destructive" className="mt-4 w-full" onClick={()=>{if(confirm(`¿Eliminar la plaza ${selectedPlaza.id} del plano?`)){commit(plazas.filter(p=>p.id!==selectedPlaza.id));setSelected(null);}}}>Eliminar plaza</Button>}
        </>:<div className="py-10 text-center text-sm text-slate-400">Selecciona una plaza para ver sus propiedades y personalizarla.</div>}
        {movingVehicleId&&<div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">Selecciona una plaza para colocar el vehículo. <button onClick={onCancelMove} className="ml-1 underline">Cancelar</button></div>}
        {loading&&<p className="mt-3 text-xs text-slate-400">Cargando distribución guardada…</p>}
      </aside>}
    </div>
  </div>;
}
