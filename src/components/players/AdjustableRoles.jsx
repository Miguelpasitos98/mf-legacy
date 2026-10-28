import React, {useRef,useState} from "react";
import RoleFieldConcept from "./RoleFieldConcept";

// Posición y tamaño compartidos por todas las fichas, guardados en este navegador.
const KEY="mf-legacy-roles-layout-v1";
const DEFAULT={left:-154,bottom:258,width:517};
const load=()=>{try{const stored=JSON.parse(window.localStorage.getItem(KEY)||"null");return stored&&["left","bottom","width"].every(k=>Number.isFinite(stored[k]))?stored:DEFAULT;}catch{return DEFAULT;}};
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export default function AdjustableRoles({ratings}){
 const [layout,setLayout]=useState(load);
 const [editing,setEditing]=useState(false);
 const gesture=useRef(null);
 const begin=(e,mode)=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  gesture.current={id:e.pointerId,mode,x:e.clientX,y:e.clientY,initial:layout};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const move=e=>{
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  setLayout(g.mode==="resize"?{...g.initial,width:clamp(g.initial.width+dx,280,850)}:
    {...g.initial,left:g.initial.left+dx,bottom:g.initial.bottom-dy});
 };
 const finish=e=>{
  if(!gesture.current||gesture.current.id!==e.pointerId)return;
  const g=gesture.current;gesture.current=null;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  const next=g.mode==="resize"?{...g.initial,width:clamp(g.initial.width+dx,280,850)}:
    {...g.initial,left:g.initial.left+dx,bottom:g.initial.bottom-dy};
  setLayout(next);
  try{window.localStorage.setItem(KEY,JSON.stringify(next));}catch{}
 };
 const reset=()=>{setLayout(DEFAULT);try{window.localStorage.removeItem(KEY);}catch{}};
 return <div className="pointer-events-none absolute hidden lg:block" style={{...layout,zIndex:24}}>
  <RoleFieldConcept ratings={ratings}/>
  <div className="pointer-events-auto absolute right-1 top-1 z-40">
   <button type="button" onClick={()=>setEditing(v=>!v)} className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-600 shadow-sm" aria-pressed={editing}>{editing?"Terminar ajuste":"Ajustar campo"}</button>
  </div>
  {editing&&<>
   <div onPointerDown={e=>begin(e,"move")} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} className="pointer-events-auto absolute inset-x-0 top-9 bottom-8 z-30 cursor-move rounded-lg border-2 border-dashed border-blue-500/70 bg-blue-500/5" style={{touchAction:"none"}} title="Arrastra para mover el módulo"/>
   <div onPointerDown={e=>begin(e,"resize")} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} className="pointer-events-auto absolute bottom-0 right-0 z-40 flex h-9 w-9 cursor-ew-resize items-end justify-end rounded-md bg-white p-2 text-blue-700 shadow" style={{touchAction:"none"}} title="Arrastra para cambiar el tamaño">↘</div>
   <button type="button" onClick={reset} className="pointer-events-auto absolute bottom-0 left-0 z-40 rounded-md bg-white px-2 py-1 text-[10px] shadow">Restablecer</button>
  </>}
 </div>;
}
