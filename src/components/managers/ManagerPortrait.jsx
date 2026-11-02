import React, {useEffect,useState} from "react";
export default function ManagerPortrait({manager,size="md"}){
 const [broken,setBroken]=useState(false);
 const url=String(manager?.photo_url||"").trim();
 useEffect(()=>setBroken(false),[url]);
 const dimensions=size==="lg"?"h-20 w-20":"h-11 w-11";
 const initial=String(manager?.display_name||manager?.name||"DT").slice(0,2).toUpperCase();
 return <div className={`${dimensions} shrink-0 rounded-xl overflow-hidden bg-slate-800 text-white flex items-center justify-center font-extrabold`}>
  {url&&!broken?<img src={url} alt={manager?.name||"Entrenador"} loading="lazy" onError={()=>setBroken(true)} className="w-full h-full object-cover"/>:<span>{initial}</span>}
 </div>;
}
