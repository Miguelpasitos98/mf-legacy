import React,{useRef,useState} from "react";

// Editor temporal. Las medidas solo quedan en memoria hasta copiarlas y fijarlas en código.
export default function LayoutEditor({name,initial,children,aspectRatio,zIndex=30}){
 const [layout,setLayout]=useState(()=>({...initial}));
 const [editing,setEditing]=useState(false);
 const pointer=useRef(null);
 const start=(event,mode)=>{
  if(event.pointerType==="mouse"&&event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  pointer.current={id:event.pointerId,mode,x:event.clientX,y:event.clientY,layout:{...layout}};
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const calculate=event=>{
  const p=pointer.current;if(!p||p.id!==event.pointerId)return null;
  const dx=event.clientX-p.x,dy=event.clientY-p.y;
  if(p.mode==="resize"){
   const width=Math.max(180,Math.round(p.layout.width+dx));
   return {...p.layout,width,...(aspectRatio?{}:{height:Math.max(200,Math.round(p.layout.height+dy))})};
  }
  return {...p.layout,left:Math.round(p.layout.left+dx),...(p.layout.bottom!==undefined?{bottom:Math.round(p.layout.bottom-dy)}:{top:Math.round(p.layout.top+dy)})};
 };
 const move=e=>{const next=calculate(e);if(next)setLayout(next);};
 const end=e=>{const next=calculate(e);if(next)setLayout(next);pointer.current=null;};
 const copy=async()=>{
  const result=JSON.stringify({module:name,...layout});
  try{await navigator.clipboard.writeText(result);setCopied(true);}catch{window.prompt("Copia estas coordenadas:",result);}
 };
 const [copied,setCopied]=useState(false);
 return <div className="pointer-events-none absolute hidden lg:block" style={{...layout,zIndex}}>
   {children}
   <div className="pointer-events-auto absolute right-0 top-0 z-50">
     <button type="button" onClick={()=>{setEditing(v=>!v);setCopied(false);}} className="rounded bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-700 shadow">{editing?"Terminar ajuste":"Ajustar "+name}</button>
   </div>
   {editing&&<>
    <div className="pointer-events-auto absolute inset-x-0 top-8 bottom-8 z-40 cursor-move rounded border-2 border-dashed border-blue-500/50 bg-blue-400/10" style={{touchAction:"none"}} title="Mover" onPointerDown={e=>start(e,"move")} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/>
    <div className="pointer-events-auto absolute bottom-0 right-0 z-50 flex h-8 w-8 cursor-nwse-resize items-end justify-end rounded bg-white p-1 text-blue-700 shadow" style={{touchAction:"none"}} title="Cambiar tamaño" onPointerDown={e=>start(e,"resize")} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>↘</div>
    <div className="pointer-events-auto absolute bottom-0 left-0 z-50 flex items-center gap-1 rounded bg-white/95 p-1 shadow">
     <button type="button" onClick={copy} className="rounded bg-blue-700 px-2 py-1 text-[10px] font-bold text-white">{copied?"Copiado":"Copiar coordenadas"}</button>
     <span className="text-[9px] text-slate-600">{layout.left}, {layout.bottom??layout.top} · {layout.width}×{layout.height??"auto"}</span>
    </div>
   </>}
 </div>;
}
