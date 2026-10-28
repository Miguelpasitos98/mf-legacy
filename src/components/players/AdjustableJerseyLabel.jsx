import React,{useRef,useState} from "react";

// Editor temporal independiente: arrastrar, cambiar tamaño y copiar coordenadas.
// Se mide respecto al viewport para conservar exactamente el resultado copiado.
export default function AdjustableJerseyLabel({name,initial,children,minWidth=45}){
 const [layout,setLayout]=useState(initial);
 const [editing,setEditing]=useState(false);
 const [copied,setCopied]=useState(false);
 const pointer=useRef(null);
 const start=(e,mode)=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  pointer.current={id:e.pointerId,mode,x:e.clientX,y:e.clientY,layout:{...layout}};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const calculate=e=>{
  const p=pointer.current;if(!p||p.id!==e.pointerId)return null;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;
  if(p.mode==="resize")return {...p.layout,width:Math.max(minWidth,Math.round(p.layout.width+dx))};
  return {...p.layout,left:Math.round(p.layout.left+dx),top:Math.round(p.layout.top+dy)};
 };
 const move=e=>{const next=calculate(e);if(next){setLayout(next);setCopied(false);}};
 const end=e=>{const next=calculate(e);if(next)setLayout(next);pointer.current=null;};
 const copy=()=>{
  const value=JSON.stringify({module:name,...layout});
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(()=>setCopied(true)).catch(()=>window.prompt("Copia las coordenadas:",value));
  else window.prompt("Copia las coordenadas:",value);
 };
 return <div className="pointer-events-none fixed z-[90] hidden lg:block select-none" style={{left:layout.left,top:layout.top,width:layout.width}}>
  <div className="relative w-full">{typeof children==="function"?children(layout):children}</div>
  <button type="button" className="pointer-events-auto absolute -top-8 left-0 z-[92] whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-blue-900 shadow" onClick={()=>setEditing(v=>!v)}>{editing?"Terminar ajuste":"Ajustar "+name}</button>
  {editing&&<>
   <div className="pointer-events-auto absolute inset-0 z-[91] cursor-move rounded border-2 border-dashed border-blue-500 bg-blue-400/10" title="Arrastrar para mover" style={{touchAction:"none"}} onPointerDown={e=>start(e,"move")} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/>
   <div className="pointer-events-auto absolute -bottom-4 -right-4 z-[93] flex h-11 w-11 cursor-nwse-resize items-center justify-center rounded-lg border-2 border-blue-700 bg-white text-xl font-black text-blue-800 shadow-lg" title="Arrastrar para agrandar o reducir" style={{touchAction:"none"}} onPointerDown={e=>start(e,"resize")} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>↘</div>
   <div className="pointer-events-auto absolute -bottom-14 left-0 z-[93] flex items-center gap-2 whitespace-nowrap rounded-lg bg-white p-1 shadow-lg">
    <button type="button" onClick={copy} className="rounded bg-blue-700 px-2 py-1 text-[11px] font-bold text-white">{copied?"Copiado":"Copiar coordenadas"}</button>
    <span className="text-[10px] text-slate-600">{layout.left}, {layout.top} · {layout.width}px</span>
   </div>
  </>}
 </div>;
}
