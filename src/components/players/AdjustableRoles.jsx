import React,{useRef,useState} from "react";
import {Check,Copy,Grip,MoveDiagonal,RotateCcw,SlidersHorizontal} from "lucide-react";
import RoleFieldConcept from "./RoleFieldConcept";

const STORAGE_KEY="mf-legacy-role-layout-v1";
const DEFAULT={left:-154,bottom:258,width:517};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const stored=()=>{
 try{
  const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
  if(v&&Number.isFinite(v.left)&&Number.isFinite(v.bottom)&&Number.isFinite(v.width))
   return {left:v.left,bottom:v.bottom,width:v.width};
 }catch{}
 return DEFAULT;
};
export default function AdjustableRoles({ratings}){
 const [layout,setLayout]=useState(stored);
 const [editing,setEditing]=useState(false);
 const [message,setMessage]=useState("");
 const ref=useRef(null);
 const action=useRef(null);
 const start=(event,mode)=>{
  if(event.button!==0)return;
  event.preventDefault();
  event.stopPropagation();
  action.current={mode,x:event.clientX,y:event.clientY,initial:layout};
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const move=event=>{
  if(!action.current)return;
  const {mode,x,y,initial}=action.current;
  const dx=event.clientX-x,dy=event.clientY-y;
  setLayout(mode==="resize"?{...initial,width:clamp(Math.round(initial.width+dx),220,720)}:{
   ...initial,left:clamp(Math.round(initial.left+dx),-600,900),
   bottom:clamp(Math.round(initial.bottom-dy),20,850)
  });
 };
 const finish=()=>{action.current=null;};
 const save=()=>{
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(layout));setEditing(false);setMessage("Posición guardada en este navegador.");}
  catch{setMessage("No se pudo guardar en el navegador.");}
 };
 const copy=async()=>{
  const value=`Roles: izquierda ${layout.left}px · altura ${layout.bottom}px · ancho ${layout.width}px`;
  try{await navigator.clipboard.writeText(value);setMessage("Medidas copiadas. Envíamelas por el chat para fijarlas en el diseño.");}
  catch{setMessage(value);}
 };
 const reset=()=>{setLayout(DEFAULT);setMessage("Medidas originales restauradas. Pulsa Guardar para confirmarlas.");};
 return <div ref={ref} className="pointer-events-auto absolute hidden lg:block" style={{left:layout.left,bottom:layout.bottom,width:layout.width,zIndex:editing?95:1}}>
   {editing&&<div className="absolute inset-0 z-10 rounded-xl border-2 border-dashed border-blue-600/70 bg-blue-500/5" aria-hidden="true"/>}
   <div className="relative"><RoleFieldConcept ratings={ratings}/></div>
   {editing&&<>
     <div onPointerDown={e=>start(e,"move")} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}
       className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-1/2 touch-none cursor-grab items-center gap-1 rounded-full bg-blue-900 px-3 py-1.5 text-xs font-bold text-white shadow-lg active:cursor-grabbing">
       <Grip size={14}/> Arrastrar
     </div>
     <div onPointerDown={e=>start(e,"resize")} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}
       title="Arrastra para ampliar o reducir" className="absolute -bottom-2 -right-2 z-20 flex h-9 w-9 touch-none cursor-nwse-resize items-center justify-center rounded-lg bg-blue-900 text-white shadow-lg"><MoveDiagonal size={19}/></div>
   </>}
   <div className="absolute -right-1 top-0 z-30 flex translate-x-full flex-col items-start gap-1 pl-2">
     <button type="button" onClick={()=>{setEditing(v=>!v);setMessage("");}} title="Mover y cambiar tamaño de Roles" className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-800 shadow"><SlidersHorizontal size={12}/>{editing?"Cerrar":"Ajustar"}</button>
     {editing&&<div className="flex flex-col gap-1 rounded-lg bg-white/95 p-1.5 text-[10px] shadow-lg">
       <span className="whitespace-nowrap font-semibold text-slate-700">X {layout.left} · Y {layout.bottom} · {layout.width}px</span>
       <button type="button" onClick={save} className="flex items-center gap-1 rounded bg-blue-900 px-2 py-1 text-white"><Check size={12}/> Guardar</button>
       <button type="button" onClick={copy} className="flex items-center gap-1 rounded px-2 py-1 text-slate-800"><Copy size={12}/> Copiar medidas</button>
       <button type="button" onClick={reset} className="flex items-center gap-1 rounded px-2 py-1 text-slate-800"><RotateCcw size={12}/> Restablecer</button>
     </div>}
   </div>
   {message&&<div role="status" className="absolute left-0 top-full z-30 mt-1 max-w-[340px] rounded bg-white/95 px-2 py-1 text-[10px] text-slate-700 shadow">{message}</div>}
 </div>;
}
