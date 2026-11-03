import React,{useEffect,useRef,useState} from "react";
import {Link} from "react-router-dom";
import {ArrowLeft,Database} from "lucide-react";
import {base44} from "@/api/base44Client";
import {summarizeFotmobXgot} from "@/utils/fotmobXgot";

const unpack=x=>Array.isArray(x)?x:x?.items||x?.data||x?.results||[];
const safeId=x=>/^\d{1,12}$/.test(String(x||""))?String(x):null;
const txt=e=>e?.response?.data?.error||e?.message||"No fue posible consultar FotMob";

/**
 * Understat Explorer and verified FotMob xGOT are separate observations.
 * Understat rows never supply xGOT or its denominator. This page is read-only.
 * A registered UnderstatSeasonRate identity is used when unique; otherwise a
 * user-supplied FotMob ID can be queried without persisting a relationship.
 */
export default function UnderstatExplorer(){
 const [frameHeight,setFrameHeight]=useState(1350);
 const iframeRef=useRef(null),sequence=useRef(0),chosen=useRef(null);
 useEffect(()=>{
  const post=(payload)=>{
   iframeRef.current?.contentWindow?.postMessage({type:"mf-legacy-xgot-result",...payload},window.location.origin);
  };
  const fetchStats=async({understatId,playerId,fotmobId,mode})=>{
   const filter=playerId?{player_id:playerId}:{fotmob_player_id:fotmobId};
   const data=unpack(await base44.entities.PlayerSeasonStats.filter(filter,{limit:1000}));
   const ids=[...new Set(data.map(x=>String(x.fotmob_player_id||"")).filter(Boolean))];
   if(!data.length)return {status:"empty",message:"No hay temporadas de FotMob guardadas para esta identidad."};
   if(ids.length!==1||(fotmobId&&ids[0]!==fotmobId))
    return {status:"unlinked",message:"Hay varias identidades FotMob o no coinciden con el ID solicitado."};
   const summary=summarizeFotmobXgot(data,ids[0]);
   if(!summary.seasons.some(x=>x.total!==null||x.entries.some(e=>e.per90!==null)))
    return {status:"empty",message:"Hay temporadas FotMob, pero ninguna contiene xGOT verificable.",fotmobId:ids[0]};
   return {status:"ok",fotmobId:ids[0],mode,seasons:summary.seasons,
    message:mode==="linked"?"Identidad vinculada en MF LEGACY":"Consulta manual por ID FotMob. No se ha creado ninguna vinculación."};
  };
  const handle=async(event)=>{
   if(event.origin!==window.location.origin||event.source!==iframeRef.current?.contentWindow)return;
   const request=event.data||{};
   if(request.type==="mf-legacy-understat-height"){
    const next=Number(request.height);
    if(Number.isFinite(next)&&next>0)setFrameHeight(Math.min(Math.max(next+20,800),18000));
    return;
   }
   if(request.type!=="mf-legacy-understat-select"&&request.type!=="mf-legacy-fotmob-manual")return;
   const understatId=safeId(request.understatId);
   if(!understatId)return;
   if(request.type==="mf-legacy-understat-select")chosen.current=understatId;
   if(chosen.current!==understatId)return;
   const token=++sequence.current;
   post({understatId,status:"loading"});
   try{
    let result;
    if(request.type==="mf-legacy-fotmob-manual"){
     const fid=safeId(request.fotmobId);
     if(!fid){post({understatId,status:"error",message:"Introduce un ID FotMob numérico válido."});return}
     result=await fetchStats({understatId,fotmobId:fid,mode:"manual"});
    }else{
     const links=unpack(await base44.entities.UnderstatSeasonRate.filter({understat_player_id:understatId},{limit:1000}));
     const playerIds=[...new Set(links.map(x=>String(x.player_id||"")).filter(Boolean))];
     const fotmobIds=[...new Set(links.map(x=>String(x.fotmob_player_id||"")).filter(Boolean))];
     if(playerIds.length!==1||fotmobIds.length>1)
      result={status:"unlinked",message:"Este ID Understat aún no tiene una vinculación inequívoca. Puedes consultar el xGOT indicando el ID FotMob confirmado."};
     else result=await fetchStats({understatId,playerId:playerIds[0],fotmobId:fotmobIds[0]||null,mode:"linked"});
    }
    if(token===sequence.current&&chosen.current===understatId)post({understatId,...result});
   }catch(e){
    if(token===sequence.current&&chosen.current===understatId)
     post({understatId,status:"error",message:txt(e)});
   }
  };
  window.addEventListener("message",handle);
  return ()=>{window.removeEventListener("message",handle);sequence.current++};
 },[]);
 return <div className="w-full min-w-0 bg-[#0b1220] pb-5">
   <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 text-xs text-slate-300">
    <div className="flex items-center gap-2"><Database size={15} className="text-teal-300"/>
     <span className="font-semibold tracking-wide">MF LEGACY · Understat histórico + xGOT FotMob</span></div>
    <Link to="/stats" className="inline-flex items-center gap-1 rounded-lg border border-slate-500/50 px-3 py-2 text-slate-200 hover:bg-slate-800">
     <ArrowLeft size={14}/> Volver a Stats
    </Link>
   </div>
   <p className="px-5 pt-2 text-xs text-amber-200">
    Understat es un archivo histórico parcial. El xGOT procede exclusivamente de las temporadas guardadas en FotMob,
    utiliza sus propios minutos y no modifica los datos de STATS.
   </p>
   <iframe ref={iframeRef} title="MF LEGACY — Understat Explorer" src="/understat-explorer.html"
    className="block w-full border-0" style={{height:frameHeight}} loading="eager"/>
 </div>;
}
