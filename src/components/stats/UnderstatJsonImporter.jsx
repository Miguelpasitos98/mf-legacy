import React,{useMemo,useState} from "react";
import {base44} from "@/api/base44Client";
import {applyManualStatChanges} from "@/utils/manualStats";
import {metricName} from "@/utils/compositeEngine";

const txt=v=>String(v??"").trim();
const key=v=>txt(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
const valueOf=(row,name)=>(row.metrics||[]).find(m=>metricName(m.name)===metricName(name))?.value;
const rate=v=>{
 if(v===null||v===undefined||v==="")return null;
 const n=Number(String(v).replace(",","."));
 if(!Number.isFinite(n)||n<0||n>100)return NaN;
 return n;
};
const unpack=v=>Array.isArray(v)?v:v?.items||v?.data||[];
const empty=v=>v===null||v===undefined||v==="";
const LEAGUES=/^(la ?liga|laliga|premier league|ligue ?1|bundesliga|serie ?a|eredivisie|primeira liga|liga portugal|championship|major league soccer|mls|liga nos|liga bbva|super lig|superliga|liga mx|liga 1|primera division|1\. liga|brasileirao)/i;
const CUPS=/(champions|europa|conference|copa|cup|pokal|coupe|ta[cç]a|supercopa|super cup|supercup|world cup|mundial|uefa|club world)/i;
const isDomestic=r=>{
 const name=txt(r.competition);
 // Some historical provider records are prefixed with country or season,
 // rather than starting with "LaLiga" as the older matcher assumed.
 return !CUPS.test(name)&&(LEAGUES.test(name)||/(?:^|[^a-z])(laliga|la liga|premier league|ligue 1|bundesliga|serie a|eredivisie|primeira liga|liga portugal)(?:[^a-z]|$)/i.test(name));
};
const isSafeCandidate=r=>!CUPS.test(txt(r.competition));
const metricEmpty=(row,name)=>empty(valueOf(row,name));
const existingRate=(row,name)=>valueOf(row,name+" season /90")??valueOf(row,name+" /90");

export default function UnderstatJsonImporter({player,fotmobPlayerId,stats=[],onSaved,onBusyChange}){
 const [raw,setRaw]=useState("");
 const [rows,setRows]=useState([]);
 const [chosen,setChosen]=useState(new Set());
 const [competitionOverrides,setCompetitionOverrides]=useState({});
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const playerId=txt(player?.id||stats.find(r=>r.player_id)?.player_id);
 const matching=useMemo(()=>stats.filter(r=>r.id&&txt(r.player_id)===playerId),[stats,playerId]);
 const analyze=(overrides=competitionOverrides)=>{
  setRows([]);setChosen(new Set());setError("");setMessage("");
  try{
   const data=JSON.parse(raw);
   if(data.schema!=="mf_legacy_understat_per90_import_v1")throw Error("Esquema no compatible con Understat /90.");
   const given=txt(data.player?.fotmob_id),expected=txt(fotmobPlayerId);
   if(!expected)throw Error("La ficha del jugador no tiene ID FotMob verificado. Vincúlalo antes de importar.");
   if(given&&given!==expected)throw Error("El ID FotMob del JSON no coincide con el jugador abierto.");
   if(!given&&key(data.player?.name)!==key(player?.name||stats.find(r=>r.player_name)?.player_name))throw Error("Sin ID FotMob en el JSON, el nombre debe coincidir con el jugador abierto.");
   if(!playerId)throw Error("El jugador no tiene ID de Base44.");
   if(!Array.isArray(data.records)||!data.records.length||data.records.length>500)throw Error("El JSON debe contener entre 1 y 500 registros.");
   const seen=new Set();
   const out=data.records.map((item,i)=>{
    const season=txt(item.season),team=txt(item.team);
    const id=key(season)+"|"+key(team);
    const issues=[];
    if(!/^\d{4}\/\d{4}$/.test(season)||Number(season.slice(5))!==Number(season.slice(0,4))+1)issues.push("Temporada inválida.");
    if(!team)issues.push("Falta equipo.");
    if(seen.has(id))issues.push("Equipo y temporada duplicados en el JSON.");
    seen.add(id);
    const chain=rate(item.xg_chain_p90),buildup=rate(item.xg_buildup_p90);
    const xg=rate(item.xg_total??item.xg),xa=rate(item.xa_total??item.xa);
    if(Number.isNaN(xg)||Number.isNaN(xa))issues.push("xG o xA total inválidos.");

    if(Number.isNaN(chain)||Number.isNaN(buildup)||(chain===null&&buildup===null&&xg===null&&xa===null))issues.push("Se requiere alguna estadística válida.");
    if(chain!==null&&buildup!==null&&buildup>chain)issues.push("xG Buildup /90 supera xG Chain /90.");
    const candidates=matching.filter(r=>r.season===season&&key(r.team_name)===key(team));
    const groups=new Map();
    candidates.forEach(r=>groups.set(txt(r.team_id||r.fotmob_team_id||r.team_name),1));
    if(!candidates.length)issues.push("No existe una competición del equipo y temporada en MF Legacy.");
    if(groups.size>1)issues.push("Identidad de equipo ambigua; corrige la vinculación.");

    // Understat's standard player season table is domestic-league scoped.
    // Never attach it to an arbitrary first competition such as Champions.
    const declared=txt(item.competition);
    // Only domestic leagues are eligible. Explicit JSON competition may disambiguate
    // league names, but never redirect an Understat rate to a cup.
    const domestic=candidates.filter(isDomestic);
    // Alias spelling in the imported JSON must not hide an otherwise unique
    // national-league record already present in the database.
    const exactDomestic=declared?domestic.filter(r=>key(r.competition)===key(declared)):domestic;
    const safeCandidates=candidates.filter(isSafeCandidate);
    const declaredSafe=declared&&!CUPS.test(declared);
    const explicitMatches=declaredSafe?safeCandidates.filter(r=>key(r.competition)===key(declared)):[];
    const eligible=exactDomestic.length?exactDomestic:domestic.length?domestic:explicitMatches.length?explicitMatches:safeCandidates;
    const selectedId=txt(overrides[i]);
    // Explicit manual choices are allowed only from non-cup competitions.
    const selected=eligible.find(r=>txt(r.id)===selectedId);
    const auto=domestic.length===1?domestic[0]:null;
    const anchor=selected||auto;
    if(!anchor&&candidates.length)issues.push(
      eligible.length
        ?"Selecciona expresamente la competición de liga nacional de esta temporada. Las copas están excluidas."
        : "No hay una liga nacional disponible en MF Legacy para este equipo y temporada. Competiciones encontradas: "+candidates.map(r=>txt(r.competition)||"(sin nombre)").join(", ")+". Añade primero el registro de liga nacional.");
    const options=eligible.map(r=>({id:txt(r.id),label:txt(r.competition)+" · "+txt(r.team_name)+" · "+txt(r.id).slice(-8)}));
    const offered=[
      ["xG",xg],["xA",xa],
      ["xG Chain /90",chain],["xG Buildup /90",buildup]
    ].filter(([,v])=>v!==null&&!Number.isNaN(v));
    const existingName=(name)=>name.endsWith(" /90")?name.replace(" /90",""):name;
    const isEmpty=(name)=>anchor&&(name.endsWith(" /90")
      ? empty(existingRate(anchor,existingName(name)))&&empty(valueOf(anchor,existingName(name)))
      : metricEmpty(anchor,name));
    const metrics=offered.filter(([name])=>isEmpty(name)).map(([name,value])=>({
      name,value,sourceNote:"Understat · liga nacional · "+team+" · "+season+" · solo vacíos"
    }));
    const diffs=metrics;
    const same=diffs.length===0;
    return {id:i,season,team,anchor,options,metrics,diffs,issues,status:issues.length?"error":same?"same":"new"};
   });
   setRows(out);setChosen(new Set(out.filter(r=>r.status==="new").map(r=>r.id)));
   setMessage("Vista previa generada. Solo los datos nuevos están seleccionados; marca las actualizaciones explícitamente.");
  }catch(err){setError(err.message||"JSON inválido.");}
 };
 const save=async()=>{
  const targets=rows.filter(r=>chosen.has(r.id)&&["new","update"].includes(r.status));
  if(!targets.length||busy)return;
  setBusy(true);onBusyChange?.(true);setError("");setMessage("");
  let count=0,skipped=0;
  try{
   for(const r of targets){
    // Fetch and validate a fresh, exact snapshot before modifying any data.
    const fetched=unpack(await base44.entities.PlayerSeasonStats.filter({player_id:playerId,season:r.season,competition:r.anchor.competition},{limit:25}));
    const exact=fetched.find(x=>txt(x.id)===txt(r.anchor.id));
    if(!exact||txt(exact.player_id)!==playerId||txt(exact.season)!==r.season||txt(exact.team_name)!==txt(r.anchor.team_name))
     throw Error("El registro "+r.season+" · "+r.team+" cambió o no se encontró. Vuelve a analizar.");
    // Re-evaluate each field against fresh server data. Existing fields are
    // skipped individually, rather than stopping the entire batch.
    const updates=r.metrics.filter(m=>{
     const base=m.name.endsWith(" /90")?m.name.replace(" /90",""):m.name;
     const missing=m.name.endsWith(" /90")
       ?empty(existingRate(exact,base))&&empty(valueOf(exact,base))
       :metricEmpty(exact,m.name);
     if(!missing)skipped++;
     return missing;
    });
    if(updates.length){
     const {update}=applyManualStatChanges(exact,updates);
     await base44.entities.PlayerSeasonStats.update(exact.id,update);
     count++;
    }
   }
   setMessage(count+" registros actualizados · "+skipped+" campos existentes omitidos sin sobrescribir. Vuelve a analizar para comprobar valores actuales.");
   setRows([]);setChosen(new Set());onSaved?.({refresh:true});
  }catch(err){setError("Se guardaron "+count+" registros, y se omitieron "+skipped+" campos existentes antes de detenerse. "+(err.message||"Error")+". Vuelve a analizar antes de reintentar.");setRows([]);setChosen(new Set());if(count)onSaved?.({refresh:true});}
  finally{setBusy(false);onBusyChange?.(false);}
 };
 return <div className="space-y-4">
  <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">Importa xG, xA, xG Chain /90 y xG Buildup /90 exclusivamente a la liga nacional. Solo rellena campos vacíos; jamás sobrescribe valores existentes ni copia datos a Champions u otras copas. Si falta identificar la liga, el registro se bloquea.</p>
  <label className="block text-xs font-bold text-slate-700">Pegar JSON Understat
   <textarea value={raw} onChange={e=>{setRaw(e.target.value);setRows([]);setChosen(new Set());setCompetitionOverrides({});setError("");}} spellCheck={false} disabled={busy} placeholder={'{"schema":"mf_legacy_understat_per90_import_v1","player":{"fotmob_id":"701154"},"records":[{"season":"2023/2024","team":"Paris Saint-Germain","xg_chain_p90":1.15,"xg_buildup_p90":0.40}]}'}
    className="mt-2 h-52 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-800"/>
  </label>
  <div className="flex gap-2"><button type="button" disabled={!raw.trim()||busy} onClick={()=>analyze()} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Analizar JSON</button><button type="button" disabled={busy} onClick={()=>{setRaw("");setRows([]);setChosen(new Set());setCompetitionOverrides({});setError("");setMessage("");}} className="rounded-lg border px-4 py-2 text-xs">Limpiar</button></div>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
  {message&&<p role="status" className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">{message}</p>}
  {!!rows.length&&<><p className="text-xs text-slate-600">{rows.length} filas · {rows.filter(r=>r.status==="error").length} errores. Los existentes no se modifican sin marcarlos.</p>
   <div className="mb-2 flex flex-wrap gap-2"><button type="button" disabled={busy||!rows.some(r=>r.status==="new"||r.status==="update")} onClick={()=>setChosen(new Set(rows.filter(r=>r.status==="new"||r.status==="update").map(r=>r.id)))} className="rounded border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-800 disabled:opacity-40">Seleccionar todos los válidos</button><button type="button" disabled={busy||!chosen.size} onClick={()=>setChosen(new Set())} className="rounded border px-3 py-1.5 text-xs font-bold disabled:opacity-40">Deseleccionar todos</button></div>
   <div className="max-h-72 overflow-auto rounded-lg border">{rows.map(r=><label key={r.id} className="flex items-start gap-2 border-b p-3 text-xs last:border-0">
    <input type="checkbox" disabled={busy||!["new","update"].includes(r.status)} checked={chosen.has(r.id)} onChange={e=>setChosen(prev=>{const s=new Set(prev);if(e.target.checked)s.add(r.id);else s.delete(r.id);return s;})}/>
    <span className="flex-1"><strong>{r.season} · {r.team}</strong><span className="ml-2 text-slate-500">{r.status==="new"?"Nuevo":r.status==="update"?"Actualizar":r.status==="same"?"Sin cambios":"Error"}</span>
    <span className="block text-slate-600">{r.metrics.length} campos vacíos para completar · xG: {r.metrics.find(m=>m.name==="xG")?.value??"—"} · xA: {r.metrics.find(m=>m.name==="xA")?.value??"—"} · Chain /90: {r.metrics.find(m=>m.name.startsWith("xG Chain"))?.value??"—"} · Buildup /90: {r.metrics.find(m=>m.name.startsWith("xG Buildup"))?.value??"—"}</span>
    {r.options.length>0&&(!r.anchor||r.options.length>1)&&<span className="mt-2 block"><span className="block font-semibold text-slate-700">Registro de liga nacional</span><select aria-label={"Seleccionar liga "+r.season+" "+r.team} value={competitionOverrides[r.id]||r.anchor?.id||""} disabled={busy} onChange={e=>{const next={...competitionOverrides,[r.id]:e.target.value};setCompetitionOverrides(next);analyze(next);}} className="mt-1 w-full rounded border border-slate-300 bg-white p-2"><option value="">Selecciona el registro exacto</option>{r.options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></span>}
    {r.issues.map((t,i)=><span key={i} className="block text-red-700">{t}</span>)}</span>
   </label>)}</div>
   <button type="button" disabled={busy||!chosen.size} onClick={save} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy?"Guardando…":"Guardar "+chosen.size+" registros"}</button>
  </>}
 </div>;
}
