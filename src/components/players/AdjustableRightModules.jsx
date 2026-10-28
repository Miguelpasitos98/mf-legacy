import React,{useRef,useState} from "react";
import {Check,Copy,Grip,MoveDiagonal,RotateCcw,SlidersHorizontal} from "lucide-react";

const IMAGE="https://media.base44.com/images/public/6a88359fd43f2af862874b12/b4d97cd52_modulos_derecha_mf_legacy_recortados.png";
const STORAGE_KEY="mf-legacy-right-modules-layout-v1";
const DEFAULT={left:990,bottom:262,width:430};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const readSaved=()=>{
 try{
  const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
  if(v&&["left","bottom","width"].every(k=>Number.isFinite(v[k])))return v;
 }catch{}
 return DEFAULT;
};
export default function AdjustableRightModules(){
 const [layout,setLayout]=useState(readSaved);
 const [editing,setEditing]=useState(false);
 const [message,setMessage]=useState("");
 const action=useRef(null);
 const start=(e,mode)=>{
  if(e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  action.current={mode,x:e.clientX,y:e.clientY,initial:layout};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const move=e=>{
  if(!action.current)return;
  const {mode,x,y,initial}=action.current;
  const dx=e.clientX-x,dy=e.clientY-y;
  setLayout(mode==="resize"?{...initial,width:clamp(Math.round(initial.width+dx),220,720)}:{
   ...initial,left:clamp(Math.round(initial.left+dx),-600,1650),
   bottom:clamp(Math.round(initial.bottom-dy),20,1000)
  });
 };
 const save=()=>{
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(layout));setEditing(false);setMessage("Módulos guardados en este navegador.");}
  catch{setMessage("No se pudieron guardar las medidas.");}
 };
 const copy=async()=>{
  const t=`Módulos derecha: izquierda ${layout.left}px · altura ${layout.bottom}px · ancho ${layout.width}px`;
  try{await navigator.clipboard.writeText(t);setMessage("Medidas copiadas. Pégamelas en el chat para fijarlas.");}
  catch{setMessage(t);}
 };
 return <div className="pointer-events-none absolute hidden lg:block" style={{left:layout.left,bottom:layout.bottom,width:layout.width,zIndex:editing?96:4}}>
   <img src={IMAGE} alt="Diseño de módulos derechos, con pestañas Last Game y Next Game y paneles en blanco" className="block h-auto w-full"/>
   {editing&&<>
     <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-dashed border-blue-600 bg-blue-500/5"/>
     <div onPointerDown={e=>start(e,"move")} onPointerMove={move} onPointerUp={()=>{action.current=null;}} onPointerCancel={()=>{action.current=null;}}
       className="pointer-events-auto absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-1/2 touch-none cursor-grab items-center gap-1 rounded-full bg-blue-900 px-3 py-1.5 text-xs font-bold text-white shadow-lg"><Grip size={14}/> Arrastrar</div>
     <div onPointerDown={e=>start(e,"resize")} onPointerMove={move} onPointerUp={()=>{action.current=null;}} onPointerCancel={()=>{action.current=null;}}
       title="Arrastra para ampliar o reducir" className="pointer-events-auto absolute -bottom-2 -right-2 z-20 flex h-9 w-9 touch-none cursor-nwse-resize items-center justify-center rounded-lg bg-blue-900 text-white shadow-lg"><MoveDiagonal size={18}/></div>
   </>}
   <div className="pointer-events-auto absolute left-0 top-0 z-30 flex -translate-y-full flex-wrap items-center gap-1 pb-1">
     <button type="button" onClick={()=>{setEditing(v=>!v);setMessage("");}} className="flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-800 shadow"><SlidersHorizontal size={12}/>{editing?"Cerrar":"Ajustar módulos"}</button>
     {editing&&<>
       <button type="button" onClick={save} className="flex items-center gap-1 rounded bg-blue-900 px-2 py-1 text-[10px] text-white"><Check size={12}/> Guardar</button>
       <button type="button" onClick={copy} className="flex items-center gap-1 rounded bg-white/95 px-2 py-1 text-[10px] text-slate-800"><Copy size={12}/> Copiar medidas</button>
       <button type="button" onClick={()=>{setLayout(DEFAULT);setMessage("Posición original restaurada; pulsa Guardar.");}} className="rounded bg-white/95 px-2 py-1 text-slate-800"><RotateCcw size={12}/></button>
       <span className="rounded bg-white/95 px-1 text-[10px] text-slate-700">X {layout.left} · Y {layout.bottom} · {layout.width}px</span>
     </>}
   </div>
   {message&&<div role="status" className="pointer-events-none absolute left-0 top-full z-30 rounded bg-white px-2 py-1 text-[10px] text-slate-700 shadow">{message}</div>}
 </div>;
}
