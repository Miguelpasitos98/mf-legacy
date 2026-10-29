import React,{useState} from "react";
import {createPortal} from "react-dom";
import {useQuery} from "@tanstack/react-query";
import {Trophy,X,Medal,ShieldCheck} from "lucide-react";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {trophyImageUrl} from "@/utils/trophyCatalog";

const HONOURS_KEY=["mf-legacy","trophies","honours"],TROPHY_KEY=["mf-legacy","trophies","definitions"],CREDITS_KEY=["mf-legacy","trophies","credits"];
const imageKey=["mf-legacy","trophies","image-manifest"];
export default function PalmaresButton({ownerType,ownerId,compact=false,dark=false}){
 const [open,setOpen]=useState(false);
 const enabled=open&&Boolean(ownerId);
 const honoursQuery=useQuery({...completeRecordQueryOptions(base44.entities.TrophyHonour,HONOURS_KEY),enabled,retry:false});
 const definitionsQuery=useQuery({...completeRecordQueryOptions(base44.entities.Trophy,TROPHY_KEY),enabled,retry:false});
 const creditsQuery=useQuery({...completeRecordQueryOptions(base44.entities.PlayerTrophyCredit,CREDITS_KEY),enabled:enabled&&ownerType==="Player",retry:false});
 const imageQuery=useQuery({queryKey:imageKey,enabled,retry:false,queryFn:async()=>{
  const r=await fetch("/trophy-images.json");return r.ok?r.json():null;
 },staleTime:60*60*1000});
 const honours=honoursQuery.data||[];
 const credits=creditsQuery.data||[];
 const myCredits=credits.filter(c=>String(c.player_id)===String(ownerId));
 const honourById=new Map(honours.map(h=>[String(h.id),h]));
 const seen=new Set();
 const owned=ownerType==="Team"?
  honours.filter(h=>h.verified&&h.recipient_type==="Team"&&String(h.recipient_id)===String(ownerId)).map(h=>({h,type:"club"})):
  [
   ...honours.filter(h=>h.verified&&h.recipient_type==="Player"&&String(h.recipient_id)===String(ownerId)).map(h=>({h,type:"individual"})),
   ...myCredits.filter(c=>c.status==="confirmed"&&c.verified===true)
    .map(c=>({h:honourById.get(String(c.trophy_honour_id)),type:"colectivo"}))
    .filter(item=>item.h?.verified===true&&item.h?.recipient_type==="Team")
  ];
 const unique=owned.filter(({h})=>{
  const k=[h.trophy_source_id,h.season,h.recipient_type,h.recipient_id].join("|");
  if(seen.has(k))return false;seen.add(k);return true;
 }).sort((a,b)=>String(b.h.season).localeCompare(String(a.h.season),"es",{numeric:true}));
 const definitions=new Map((definitionsQuery.data||[]).map(t=>[String(t.source_id),t]));
 const pending=ownerType==="Player"?myCredits.filter(c=>c.status==="candidate").length:0;
 const trigger=dark?"border border-white/30 bg-black/10 text-white/85 hover:bg-white/10":
  "text-slate-500 hover:text-[#003399]";
 return <>
  <button type="button" className={compact?
    "inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] transition "+trigger:
    "inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[.13em] transition "+trigger}
   onClick={()=>setOpen(true)} aria-label="Abrir palmarés histórico">
   <Trophy size={compact?14:16}/> PALMARÉS
  </button>
  {open&&typeof document!=="undefined"&&createPortal(
   <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm"
    onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
    <div role="dialog" aria-modal="true" aria-label="Palmarés histórico" className="flex max-h-[88vh] w-full max-w-[780px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
     <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">MF LEGACY · TROPHIES</p>
       <h2 className="mt-0.5 flex items-center gap-2 text-lg font-black text-slate-900"><Trophy size={18} className="text-[#003399]"/> Palmarés histórico</h2></div>
      <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={()=>setOpen(false)} aria-label="Cerrar palmarés"><X size={19}/></button>
     </header>
     <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
      {(honoursQuery.isLoading||definitionsQuery.isLoading||(ownerType==="Player"&&creditsQuery.isLoading))&&<p className="text-xs text-slate-500">Cargando palmarés…</p>}
      {(honoursQuery.isError||definitionsQuery.isError||(ownerType==="Player"&&creditsQuery.isError))&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">No se ha podido cargar el palmarés completo. Comprueba la conexión y las entidades sincronizadas.</p>}
      {!honoursQuery.isLoading&&!unique.length&&<div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
       <Medal className="mx-auto mb-2 text-slate-300" size={30}/>
       <p className="text-sm font-semibold text-slate-600">Sin trofeos confirmados todavía</p>
       <p className="mt-1 text-[11px] text-slate-400">Los títulos se incorporan desde Trophies con evidencia y verificación de elegibilidad.</p>
      </div>}
      {unique.length>0&&(ownerType==="Team"?[["Títulos oficiales",unique]]:[
        ["Títulos colectivos",unique.filter(x=>x.type==="colectivo")],
        ["Premios individuales",unique.filter(x=>x.type==="individual")]
      ]).filter(([,items])=>items.length>0).map(([section,items])=>
       <section key={section}>
        <div className="mb-2 flex items-center justify-between gap-3">
         <h3 className="text-[11px] font-black uppercase tracking-[.12em] text-slate-700">{section}</h3>
         <span className="text-[10px] text-slate-400">{items.length} títulos</span>
        </div>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3">
         {items.map(({h,type})=>{
          const trophy=definitions.get(String(h.trophy_source_id))||{source_id:h.trophy_source_id,name:h.trophy_source_id};
          return <div key={[h.id,type].join(":")} className="w-[165px] shrink-0 snap-start rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3">
           <div className="flex h-24 items-center justify-center">
            <img loading="lazy" src={trophyImageUrl(trophy,imageQuery.data)} alt="" className="max-h-20 max-w-full object-contain"
             onError={e=>{e.currentTarget.style.display="none";e.currentTarget.nextElementSibling?.classList.remove("hidden");}}/>
            <Trophy className="hidden text-slate-300" size={30}/>
           </div>
           <p className="line-clamp-2 min-h-[32px] text-center text-[11px] font-bold text-slate-800">{trophy.name}</p>
           <p className="mt-1 text-center text-xs font-bold tabular-nums text-[#003399]">{h.season}</p>
           <p className="mt-1 text-center text-[10px] text-slate-400">{type==="individual"?"Premio individual":type==="colectivo"?"Título colectivo":"Título del club"}</p>
          </div>;
         })}
        </div>
       </section>
      )}
      {pending>0&&<p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800"><ShieldCheck size={14}/>{pending} adjudicaciones candidatas pendientes de revisión en Trophies (no cuentan como títulos).</p>}
      <p className="text-[10px] text-slate-400">Solo se muestran ediciones verificadas. Los títulos colectivos de jugadores requieren confirmar su elegibilidad.</p>
     </div>
    </div>
   </div>,document.body)}
 </>;
}
