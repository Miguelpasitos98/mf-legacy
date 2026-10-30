import React,{useState,useMemo} from "react";
import {createPortal} from "react-dom";
import {Download,Upload,X,AlertTriangle} from "lucide-react";
import {base44} from "@/api/base44Client";
import {VALUATION_CSV_HEADER} from "@/utils/valuationPrompt";
import {normalizeHistoricalPosition} from "@/utils/historicalPositions";

const normalize=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
const seasonText=v=>{const t=String(v??"").trim();const m=t.match(/^(\d{4})[/-](\d{2}|\d{4})$/);return m?m[1]+"/"+(m[2].length===2?m[1].slice(0,2)+m[2]:m[2]):t;};
const number=v=>{if(v===null||v===undefined||String(v).trim()==="")return null;const t=String(v).trim().replace(/€/g,"").replace(/\s/g,"").replace(/\.(?=\d{3}(?:\D|$))/g,"").replace(",","." );const n=Number(t);return Number.isFinite(n)?n:null;};
const unpack=r=>Array.isArray(r)?r:r?.items||r?.data||r?.entities||[];
const present=v=>v!==null&&v!==undefined&&v!=="";
const keyOf=(id,season)=>String(id)+"|"+seasonText(season);
function csv(text){
 const lines=[];let row=[],cell="",quoted=false;const raw=String(text).replace(/^\uFEFF/,"");
 const first=raw.split(/\r?\n/,1)[0]||"";const d=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?";":",";
 for(let i=0;i<raw.length;i++){const c=raw[i];if(c==='"'){if(quoted&&raw[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
 else if(!quoted&&c===d){row.push(cell);cell="";}
 else if(!quoted&&(c==="\r"||c==="\n")){if(c==="\r"&&raw[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x.trim()))lines.push(row);row=[];cell="";}
 else cell+=c;}
 if(quoted)throw Error("CSV con comillas sin cerrar.");
 row.push(cell);if(row.some(x=>x.trim()))lines.push(row);
 if(lines.length<2)throw Error("El CSV debe tener cabecera y datos.");
 const header=lines.shift().map(normalize);
 return lines.map(values=>Object.fromEntries(header.map((h,i)=>[h,values[i]??""])));
}
const field=(row,names)=>{for(const name of names){if(Object.prototype.hasOwnProperty.call(row,normalize(name)))return row[normalize(name)];}return "";};
const quoted=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
const download=(text,name,type="text/csv;charset=utf-8")=>{const blob=new Blob(["\uFEFF",text],{type});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
export default function HistoricalValuationTool({onClose,onImported}){
 const [records,setRecords]=useState([]);
 const [loaded,setLoaded]=useState(false),[fetching,setFetching]=useState(false),[loadError,setLoadError]=useState("");
 const [complete,setComplete]=useState(false),[isAdmin,setIsAdmin]=useState(false);
 const [inputName,setInputName]=useState(""),[items,setItems]=useState([]),[parseError,setParseError]=useState("");
 const [overwrite,setOverwrite]=useState(false),[authorized,setAuthorized]=useState(false);
 const [progress,setProgress]=useState(null),[busy,setBusy]=useState(false);
 const loadAll=async()=>{
  setFetching(true);setLoadError("");setLoaded(false);setComplete(false);setItems([]);setProgress(null);
  try{
   const me=await base44.auth.me();setIsAdmin(me?.role==="admin");
   let result=[],cursor=null,allDone=false;
   for(let i=0;i<100;i++){
    const reply=await base44.entities.PlayerSeasonStats.list({limit:500,...(cursor?{cursor}:{})});
    const page=unpack(reply);result=result.concat(page);
    const next=reply?.next_cursor||reply?.nextCursor||null;
    if(!next||next===cursor||page.length===0){allDone=true;break;}cursor=next;
   }
   setRecords(result);setComplete(allDone);setLoaded(true);
   if(!allDone)setLoadError("Cobertura incompleta: hay más de 50.000 historiales. No se permite exportar ni importar hasta cargar todas las páginas.");
  }catch(e){setLoadError("No se pudieron cargar los historiales: "+e.message);}
  finally{setFetching(false);}
 };
 const unique=useMemo(()=>{
  const m=new Map();
  for(const r of records){if(!r.player_id||!r.season)continue;const k=keyOf(r.player_id,r.season);if(!m.has(k))m.set(k,{id:String(r.player_id),name:r.player_name||"Jugador sin nombre",season:seasonText(r.season),records:[]});m.get(k).records.push(r);}
  return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name,"es")||b.season.localeCompare(a.season));
 },[records]);
 const nameIndex=useMemo(()=>{const map=new Map();for(const r of unique){const n=normalize(r.name);if(!map.has(n))map.set(n,new Set());map.get(n).add(r.id);}return map;},[unique]);
 const prepared=useMemo(()=>{
  const group=new Map(unique.map(r=>[keyOf(r.id,r.season),r]));
  return items.map((x,i)=>{
   const who=normalize(x.name);
   const ids=x.id?[x.id]:[...(nameIndex.get(who)||[])];
   const matches=ids.length===1?group.get(keyOf(ids[0],x.season)):null;
   if(ids.length>1)return {...x,index:i+2,state:"ambiguous",reason:"Nombre duplicado en Base44; se necesita un identificador."};
   if(!matches)return {...x,index:i+2,state:"missing",reason:"No existe una combinación jugador-temporada confirmada."};
   const hasOverall=x.overall!==null,hasValue=x.value!==null,hasPosition=!!x.position;
   const positionDiff=r=>hasPosition&&normalizeHistoricalPosition(r.fifa_fc_position)!==x.position;
   const valueConflict=matches.records.some(r=>(hasOverall&&present(r.fifa_fc_overall)&&Number(r.fifa_fc_overall)!==x.overall)||(hasValue&&present(r.transfermarkt_value_eur)&&Number(r.transfermarkt_value_eur)!==x.value)||(positionDiff(r)&&present(r.fifa_fc_position)));
   const anyChange=matches.records.some(r=>(hasOverall&&(!present(r.fifa_fc_overall)||Number(r.fifa_fc_overall)!==x.overall))||(hasValue&&(!present(r.transfermarkt_value_eur)||Number(r.transfermarkt_value_eur)!==x.value))||positionDiff(r));
   return {...x,index:i+2,state:valueConflict&&!overwrite?"conflict":anyChange?"ready":"same",reason:valueConflict&&!overwrite?"Ya hay valores distintos; no se sobrescriben sin autorización.":"",matches};
  });
 },[items,unique,nameIndex,overwrite]);
 const summary=useMemo(()=>({ready:prepared.filter(x=>x.state==="ready"),same:prepared.filter(x=>x.state==="same").length,blocked:prepared.filter(x=>!["ready","same"].includes(x.state))}),[prepared]);
 const exportList=()=>{
  if(!complete||!unique.length)return;
  const seen=new Set();
  const rows=unique.filter(r=>{const k=normalize(r.name)+"|"+r.season;if(seen.has(k))return false;seen.add(k);return true;});
  const body=rows.map(r=>[r.name,r.season,"","","","","",""].map(quoted).join(";")).join("\r\n");
  download(VALUATION_CSV_HEADER+"\r\n"+body,"MF_LEGACY_Temporadas_Valoraciones.csv");
 };
 const fileSelected=async(event)=>{
  const file=event.target.files?.[0];event.target.value="";if(!file)return;
  setParseError("");setItems([]);setAuthorized(false);setProgress(null);setInputName(file.name);
  try{
   if(file.size>5*1024*1024)throw Error("El archivo supera 5 MB.");
   let rawRows;
   if(/\.json$/i.test(file.name)){const obj=JSON.parse(await file.text());rawRows=Array.isArray(obj)?obj:obj?.records;}
   else rawRows=csv(await file.text());
   if(!Array.isArray(rawRows)||!rawRows.length||rawRows.length>10000)throw Error("Se necesitan entre 1 y 10.000 filas.");
   const parsed=[],errors=[],seen=new Set();
   for(let i=0;i<rawRows.length;i++){
    const r=Object.fromEntries(Object.entries(rawRows[i]).map(([k,v])=>[normalize(k),v]));
    const name=String(field(r,["Jugador","player","name"])).trim(),season=seasonText(field(r,["Temporada","season"]));
    const overall=number(field(r,["FIFA/FC Overall","FIFA FC Overall","Overall","fifa_fc_overall"]));
    const value=number(field(r,["Transfermarkt (€)","Transfermarkt","transfermarkt_value_eur","market_value_eur"]));
    const id=String(field(r,["base44_player_id","player_id"])).trim();
    const edition=String(field(r,["Edición","edition","fifa_fc_edition"])).trim();
    const position=normalizeHistoricalPosition(field(r,["Posicion FIFA","posicion_fifa","fifa_fc_position","position"]));
    const status=String(field(r,["Estado","status","verification_status"])).trim();
    const source=String(field(r,["Fuente","source","sources"])).trim();
    const date=String(field(r,["Fecha","market_value_date","date"])).trim();
    if(!name||!season||(!present(overall)&&!present(value))){errors.push("Fila "+(i+2)+": faltan jugador, temporada o las dos valoraciones.");continue;}
    if(overall!==null&&(!Number.isInteger(overall)||overall<1||overall>99)){errors.push("Fila "+(i+2)+": Overall fuera de 1–99.");continue;}
    if(value!==null&&value<0){errors.push("Fila "+(i+2)+": valor negativo.");continue;}
    const k=(id||normalize(name))+"|"+season;if(seen.has(k)){errors.push("Fila "+(i+2)+": jugador y temporada repetidos.");continue;}seen.add(k);
    parsed.push({id,name,season,overall,value,position,edition,status,source,date});
   }
   if(errors.length)throw Error(errors.slice(0,5).join(" ")+" ("+errors.length+" incidencias)");
   setItems(parsed);
  }catch(e){setParseError(e.message);}
 };
 const apply=async()=>{
  if(!authorized||!isAdmin||busy||!complete||summary.blocked.length)return;
  setBusy(true);setProgress({done:0,total:summary.ready.reduce((n,x)=>n+x.matches.records.length,0),success:0,errors:[]});
  let done=0,success=0;const errors=[];
  for(const item of summary.ready){
   for(const r of item.matches.records){
    const patch={};if(item.overall!==null&&(!present(r.fifa_fc_overall)||overwrite))patch.fifa_fc_overall=item.overall;
    if(item.value!==null&&(!present(r.transfermarkt_value_eur)||overwrite))patch.transfermarkt_value_eur=item.value;
    if(item.position&&(!present(r.fifa_fc_position)||overwrite))patch.fifa_fc_position=item.position;
    if(Object.keys(patch).length){
     patch.historical_valuation_source=item.source||"Revisión MF Legacy";
     patch.historical_valuation_status=item.status||"Pendiente de verificar";
     if(item.edition)patch.historical_valuation_edition=item.edition;
     if(item.date)patch.historical_valuation_date=item.date;
     try{await base44.entities.PlayerSeasonStats.update(r.id,patch);success++;}
     catch(e){errors.push(item.name+" "+item.season+" "+r.competition+": "+e.message);}
    }
    done++;setProgress({done,total:summary.ready.reduce((n,x)=>n+x.matches.records.length,0),success,errors:[...errors]});
   }
  }
  setBusy(false);setAuthorized(false);
  if(!errors.length){setItems([]);await loadAll();onImported?.();}
 };
 return createPortal(<div className="mf-modal-overlay fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-3" role="dialog" aria-modal="true" aria-label="Valoraciones históricas">
 <div className="mf-modal-panel flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
 <div className="flex items-center justify-between bg-[#0d243b] px-5 py-4 text-white"><div><h2 className="text-lg font-black">Valoraciones históricas · FIFA/FC + Transfermarkt</h2><p className="text-xs text-blue-200">Una fila por jugador y temporada. Los valores se aplican a todas las competiciones del mismo año.</p></div><button onClick={onClose} disabled={busy} aria-label="Cerrar"><X/></button></div>
 <div className="space-y-5 overflow-y-auto p-5">
 <div className="flex flex-wrap items-center gap-3"><button onClick={loadAll} disabled={fetching||busy} className="rounded-lg bg-[#003399] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{fetching?"Cargando…":loaded?"Recargar temporadas":"1. Cargar todas las temporadas"}</button>{loaded&&<span className="text-xs text-slate-600">{unique.length} pares jugador-temporada · {records.length} registros de competición</span>}{loadError&&<p className="text-xs text-amber-800">{loadError}</p>}</div>
 <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black">2. Exportar tabla para ChatGPT</h3><p className="text-xs text-slate-500">CSV con Jugador y Temporada (y las columnas que hay que rellenar), sin competiciones duplicadas.</p></div><button onClick={exportList} disabled={!complete||!unique.length||busy} className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-xs font-bold text-[#003399] disabled:opacity-40"><Download size={16}/> Exportar CSV</button></div></div>
 <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-black">3. Importar tabla completada</h3><p className="mt-1 text-xs text-slate-600">Columnas mínimas: <strong>Jugador;Temporada;FIFA/FC Overall;Transfermarkt (€)</strong>. Se admiten columnas opcionales de <strong>Posicion FIFA</strong>, fuente, edición, fecha y estado. Sin datos numéricos no se inventan resultados.</p><label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 p-4 text-sm font-bold text-[#003399]"><Upload size={17}/>{inputName||"Seleccionar CSV o JSON completado"}<input type="file" accept=".csv,.json" className="sr-only" onChange={fileSelected} disabled={!complete||busy}/></label>
 {parseError&&<p className="mt-2 text-sm text-rose-700">{parseError}</p>}
 {!!items.length&&<><p className="mt-3 text-xs font-semibold">Listos: {summary.ready.length} temporadas · Ya coinciden: {summary.same} · Pendientes: {summary.blocked.length} · Competiciones a actualizar: {summary.ready.reduce((n,x)=>n+x.matches.records.length,0)}</p>
 <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-100"><tr>{["Jugador","Temporada","Overall","Posicion FIFA","Transfermarkt (€)","Competiciones","Estado"].map(x=><th key={x} className="p-2 text-left">{x}</th>)}</tr></thead><tbody>{prepared.map(x=><tr key={x.index} className="border-t"><td className="p-2">{x.name}</td><td className="p-2">{x.season}</td><td className="p-2">{x.overall??"—"}</td><td className="p-2 font-bold text-slate-700">{x.position||"—"}</td><td className="p-2">{x.value??"—"}</td><td className="p-2">{x.matches?.records.length??0}</td><td className={"p-2 "+(x.state==="ready"?"text-emerald-700":x.state==="same"?"text-slate-500":"text-amber-800")}>{x.state}{x.reason?" · "+x.reason:""}</td></tr>)}</tbody></table></div>
 <label className="mt-3 flex items-start gap-2 text-xs"><input type="checkbox" checked={overwrite} onChange={e=>{setOverwrite(e.target.checked);setAuthorized(false);}}/> Permitir reemplazar exclusivamente Overall, posición FIFA y valor Transfermarkt históricos existentes cuando sean distintos.</label>
 {summary.blocked.length>0&&<p className="mt-2 flex items-center gap-1 text-xs text-amber-800"><AlertTriangle size={15}/> Resuelve todas las filas bloqueadas antes de importar.</p>}
 <label className="mt-3 flex items-start gap-2 text-xs font-bold"><input type="checkbox" checked={authorized} onChange={e=>setAuthorized(e.target.checked)}/> Confirmo que he revisado las temporadas, cifras y fuentes. Autorizo aplicar las valoraciones a todas sus competiciones.</label>
 <button disabled={!authorized||!isAdmin||busy||summary.blocked.length>0||!summary.ready.length} onClick={apply} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy?"Importando…":"Aplicar a todas las competiciones"}</button>
 </>}
 {progress&&<p className="mt-3 text-xs font-bold">{progress.done}/{progress.total} registros tratados · {progress.success} actualizados · {progress.errors.length} errores{progress.errors.length?" · "+progress.errors.slice(0,3).join(" | "):""}</p>}
 </div>
 <p className="text-xs text-slate-500">La fecha y la edición aportadas en el CSV se conservan como metadatos. No se sustituye Market Value de FotMob, Rating CraftedFC, nota FotMob, CA/PA ni estadísticas de partidos. Se requiere permiso de administrador.</p>
 </div></div></div>,document.body);
}