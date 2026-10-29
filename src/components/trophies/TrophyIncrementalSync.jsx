import React,{useCallback,useEffect,useRef,useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {AlertCircle,CheckCircle2,Database,RefreshCw,ShieldCheck,Sparkles,Users} from "lucide-react";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {statsSnapshotOptions} from "@/api/recordQueries";
import {flattenStatsPages} from "@/utils/statsRowsCache";
import {planIncrementalTrophyCredits,trophyCreditLogicalKey} from "@/utils/trophyIncrementalSync";

const CREDIT_KEY=["mf-legacy","trophies","credits"];
const TEAM_KEY=["mf-legacy","teams"],PLAYER_KEY=["mf-legacy","players"];
const id=x=>String(x??"").trim();
const MAX_AUTO=40,MAX_MANUAL=200;
const styles="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-[#003399] hover:bg-blue-50 disabled:opacity-40";

export default function TrophyIncrementalSync({honours=[],catalog=[],honoursReady=false,onReview}){
 const qc=useQueryClient();
 const [status,setStatus]=useState("idle"),[report,setReport]=useState(null);
 const [progress,setProgress]=useState(null),[error,setError]=useState("");
 const [showReview,setShowReview]=useState(false);
 const busyRef=useRef(false),started=useRef(false);
 const scan=useCallback(async(auto=false)=>{
  if(busyRef.current||!honoursReady||!catalog.length)return;
  busyRef.current=true;setError("");setProgress(null);setStatus("scanning");
  let done=0;
  try{
   // Intentionally bypass cached stale snapshots. A new Stats import can have
   // completed in another tab/device since the last React Query fetch.
   const [statPages,players,teams,credits]=await Promise.all([
    qc.fetchQuery({...statsSnapshotOptions(),staleTime:0}),
    qc.fetchQuery({...completeRecordQueryOptions(base44.entities.Player,PLAYER_KEY),staleTime:0}),
    qc.fetchQuery({...completeRecordQueryOptions(base44.entities.Team,TEAM_KEY),staleTime:0}),
    qc.fetchQuery({...completeRecordQueryOptions(base44.entities.PlayerTrophyCredit,CREDIT_KEY),staleTime:0})
   ]);
   const stats=flattenStatsPages(statPages);
   const plan=planIncrementalTrophyCredits({honours,stats,credits,players,teams,trophies:catalog});
   const limit=auto?MAX_AUTO:MAX_MANUAL;
   const targets=plan.plans.slice(0,limit);
   setReport({...plan,statsCount:stats.length,processed:0,remaining:plan.plans.length,auto});
   if(!targets.length){setStatus("complete");return;}
   setStatus("writing");
   const existing=new Set(credits.map(c=>trophyCreditLogicalKey(c.team_id,c.season,
    c.trophy_source_id||honours.find(h=>id(h.id)===id(c.trophy_honour_id))?.trophy_source_id,c.player_id)));
   for(const proposed of targets){
    if(existing.has(proposed.key))continue;
    const {key,trophy_name,matches,...payload}=proposed;
    await base44.entities.PlayerTrophyCredit.create(payload);
    existing.add(key);done++;
    if(done%5===0||done===targets.length)setProgress({done,total:targets.length});
   }
   await qc.invalidateQueries({queryKey:CREDIT_KEY});
   setReport({...plan,statsCount:stats.length,processed:done,remaining:Math.max(0,plan.plans.length-done),auto});
   setStatus("complete");
  }catch(e){
   if(done)await qc.invalidateQueries({queryKey:CREDIT_KEY});
   setError((done?"Se guardaron "+done+" candidatos antes del error. ":"")+
    "No se ha completado la detección: "+(e?.message||e)+
    ". No se modifica ningún título ni crédito confirmado.");
   setStatus("error");
  }finally{busyRef.current=false;}
 },[catalog,honours,honoursReady,qc]);
 useEffect(()=>{
  if(started.current||!honoursReady||!catalog.length)return;
  started.current=true;
  void scan(true);
 },[honoursReady,catalog.length,scan]);
 return <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-[#eef4ff] to-white p-4 md:p-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <p className="flex items-center gap-2 text-xs font-black text-[#003399]"><Sparkles size={17}/> Sincronización incremental desde STATS</p>
    <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-600">
     Al abrir Revisar se buscan nuevas participaciones en títulos de clubes verificados.
     Solo se registran <strong>candidatos pendientes</strong>; las confirmaciones, exclusiones y estadísticas anteriores se conservan.
    </p>
   </div>
   <button type="button" disabled={status==="scanning"||status==="writing"||!honoursReady||!catalog.length}
    className={styles} onClick={()=>scan(false)}>
    <RefreshCw size={13} className={"mr-1 inline "+(["scanning","writing"].includes(status)?"animate-spin":"")}/>
    {status==="scanning"?"Leyendo STATS…":status==="writing"?"Creando candidatos…":"Buscar y sincronizar novedades"}
   </button>
  </div>
  {status==="scanning"&&<p role="status" className="mt-3 text-xs text-blue-800">Consultando las estadísticas y adjudicaciones completas; comprobando temporadas y competiciones…</p>}
  {progress&&status==="writing"&&<div className="mt-3">
   <p role="status" className="text-[11px] font-semibold text-[#003399]">Guardados {progress.done} de {progress.total} candidatos en este lote</p>
   <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-[#003399] transition-all" style={{width:progress.total?progress.done/progress.total*100+"%":"0%"}}/></div>
  </div>}
  {status==="error"&&<p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800"><AlertCircle size={13} className="mr-1 inline"/>{error}</p>}
  {status==="complete"&&report&&<div className="mt-3 space-y-2">
   <div role="status" className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-blue-100 bg-white p-3 text-[11px]">
    <span className="flex items-center gap-1.5 font-bold text-emerald-700"><CheckCircle2 size={15}/>{report.processed} nuevos candidatos</span>
    <span className="flex items-center gap-1.5 text-slate-600"><ShieldCheck size={14}/>{report.skipped} ya existentes</span>
    <span className="flex items-center gap-1.5 text-slate-600"><Database size={14}/>{report.statsCount} registros STATS analizados</span>
    <span className="flex items-center gap-1.5 text-slate-600"><Users size={14}/>{report.editions} ediciones oficiales contrastadas</span>
   </div>
   {report.remaining>0&&<p className="text-[11px] font-semibold text-amber-800">
    Quedan {report.remaining} candidatos detectados sin crear en este lote. Pulsa «Buscar y sincronizar novedades» para continuar con los siguientes {MAX_MANUAL}.
   </p>}
   {report.review.length>0&&<div>
    <button type="button" onClick={()=>setShowReview(v=>!v)} className="text-[11px] font-bold text-[#003399] hover:underline">
     {showReview?"Ocultar":"Mostrar"} {report.review.length} ediciones que necesitan más datos
    </button>
    {showReview&&<div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
     {report.review.slice(0,50).map((row,i)=><div key={i} className="border-b border-slate-100 px-2 py-1.5 text-[10px] text-slate-600">
      <strong>{row.trophy_name}</strong> · {row.season} · {row.reason}
     </div>)}
     {report.review.length>50&&<p className="px-2 text-[10px] text-slate-400">Mostrando las primeras 50 ediciones.</p>}
    </div>}
   </div>}
   <p className="text-[10px] text-slate-500">Detección automática al abrir Revisar (máximo {MAX_AUTO} registros por apertura). Sincronización manual por lotes de {MAX_MANUAL}; nunca se adjudican títulos automáticamente.</p>
  </div>}
  {!report&&status==="idle"&&<p className="mt-3 text-[11px] text-slate-500">Preparando la lectura de los datos históricos…</p>}
  {report?.processed>0&&status==="complete"&&<button type="button" className={styles+" mt-3"} onClick={()=>onReview?.()}>
   Ver candidatos en Revisar
  </button>}
 </section>;
}
