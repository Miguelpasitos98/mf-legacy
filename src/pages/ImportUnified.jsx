import React, {useEffect, useMemo, useState} from "react";
import {base44} from "@/api/base44Client";
import {AlertTriangle, CheckCircle2, CloudUpload, Database, FileJson, ShieldCheck, Loader2, Download, RefreshCw} from "lucide-react";
import {parseUnifiedBatch, rowsFromResponse, UNIFIED_BATCH_SCHEMA} from "@/utils/unifiedImport";

const localDate = () => new Date().toISOString().slice(0, 10);
const number = v => (v == null ? "—" : Number(v).toLocaleString("es-ES"));
const sleep = () => new Promise(resolve => setTimeout(resolve, 0));
const kindLabel = {player:"Jugadores", team:"Clubes", league:"Ligas", season:"Historiales"};
const download = (payload, name) => {
  const file = new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(file), anchor = document.createElement("a");
  anchor.href=url;anchor.download=name;anchor.click();
  URL.revokeObjectURL(url);
};

export default function ImportUnified() {
  const [isAdmin,setIsAdmin] = useState(null);
  const [links,setLinks] = useState(new Map());
  const [teamLinks,setTeamLinks] = useState(new Map());
  const [fileName,setFileName] = useState("");
  const [batch,setBatch] = useState(null);
  const [fileErrors,setFileErrors] = useState([]);
  const [error,setError] = useState("");
  const [allowUnlinked,setAllowUnlinked] = useState(false);
  const [updateExisting,setUpdateExisting] = useState(false);
  const [authorized,setAuthorized] = useState(false);
  const [busy,setBusy] = useState(false);
  const [plan,setPlan] = useState(null);
  const [progress,setProgress] = useState({done:0,total:0});
  const [report,setReport] = useState(null);

  useEffect(()=>{
    let live=true;
    (async ()=>{
      try {
        const user=await base44.auth.me();
        if(!live)return;
        setIsAdmin(user?.role==="admin");
        const [rawLinks,rawTeams]=await Promise.all([
          base44.entities.PlayerFotmobLink.list(),
          base44.entities.Team.list()
        ]);
        if(!live)return;
        setLinks(new Map(rowsFromResponse(rawLinks).filter(x=>x.fotmob_player_id&&x.player_id&&(/manual_confirmada|confirmada|verified|manual|confirmed/i.test(x.verification||""))).map(x=>[String(x.fotmob_player_id),String(x.player_id)])));
        setTeamLinks(new Map(rowsFromResponse(rawTeams).filter(x=>Number(x.fotmob_id)>0&&x.id).map(x=>[String(x.fotmob_id),String(x.id)])));
      } catch(e){if(live){setError("No se pudieron consultar las vinculaciones de Base44: "+e.message);setIsAdmin(false);}}
    })();
    return ()=>{live=false;};
  },[]);

  useEffect(()=>{setPlan(null);setAuthorized(false);setReport(null);},[batch,allowUnlinked,updateExisting]);

  const prepared=useMemo(()=>{
    if(!batch)return [];
    return batch.records.map(row=>{
      const pid = row.kind==="season" ? row.player_fotmob_id : row.fotmob_id;
      const link = row.kind==="player"||row.kind==="season"
        ? links.get(pid) : row.kind==="team" ? teamLinks.get(pid) : "";
      return {...row, linkedId:link||"",linkStatus:link?"confirmed":"unlinked"};
    });
  },[batch,links,teamLinks]);

  const stats=useMemo(()=>{
    const result={player:0,team:0,league:0,season:0,linked:0,unlinked:0};
    prepared.forEach(r=>{result[r.kind]++;result[r.linkStatus]++;});
    return result;
  },[prepared]);

  const handleFile = async evt => {
    const file=evt.target.files?.[0]; evt.target.value="";
    if(!file)return;
    setFileName(file.name);setBatch(null);setFileErrors([]);setError("");setProgress({done:0,total:0});
    if(file.size>12*1024*1024){setError("Este JSON supera 12 MB. Utiliza los lotes de importación (máximo 200 registros) para que el navegador no se bloquee.");return;}
    try {
      const value=JSON.parse((await file.text()).replace(/^\uFEFF/,""));
      const result=parseUnifiedBatch(value);
      setBatch(result);setFileErrors(result.errors);
    }catch(e){setError(e.message);}
  };

  const makePlan = async () => {
    if(!prepared.length||fileErrors.length||isAdmin!==true)return;
    setBusy(true);setError("");setReport(null);
    try{
      const existing=new Map();
      for(const kind of ["player","team","league","season"]){
        const selected=prepared.filter(x=>x.kind===kind);
        if(!selected.length)continue;
        const keys=selected.map(x=>kind==="season"?x.external_record_id:x.external_key);
        const entity = kind==="season" ? "PlayerSeasonStats" : "ExternalFootballSnapshot";
        const field = kind==="season" ? "external_record_id" : "external_key";
        const found=await base44.entities[entity].filter({[field]:{$in:keys}},{limit:500});
        for(const item of rowsFromResponse(found))existing.set(kind+":"+(item[field]||""),item);
      }
      const next=prepared.map(x=>{
        const key=x.kind==="season"?x.external_record_id:x.external_key;
        const old=existing.get(x.kind+":"+key);
        return {...x,action:(!x.linkedId&&(x.kind==="season"||!allowUnlinked))?"sin_vinculo":old?(updateExisting&&x.kind!=="season"?"actualizar":"existente"):"crear",existingId:old?.id||null};
      });
      setPlan(next);
    }catch(e){setError("No se pudo verificar la existencia previa; no se guardará nada. "+e.message);}
    finally{setBusy(false);}
  };

  const importBatch=async()=>{
    if(!plan||!authorized||isAdmin!==true||busy)return;
    const queue=plan.filter(r=>r.action==="crear"||r.action==="actualizar");
    setBusy(true);setError("");setProgress({done:0,total:queue.length});
    const reportItems=[];
    const entityFor = r => r.kind==="season"?"PlayerSeasonStats":"ExternalFootballSnapshot";
    const keyFor = r => r.external_key||r.external_record_id;
    const recordFor = row => {
      if(row.kind==="season"){
        if(!row.linkedId)throw Error("No se permite historial sin Player confirmado.");
        const data={
          external_record_id:row.external_record_id,player_id:row.linkedId,
          fotmob_player_id:row.player_fotmob_id,player_name:row.player_name,
          fotmob_team_id:row.fotmob_team_id,team_name:row.team_name,
          team_id:teamLinks.get(row.fotmob_team_id)||"",
          season:row.season,competition:row.competition,
          appearances:row.appearances,minutes:row.minutes,rating:row.rating,
          market_value:row.market_value,market_date:row.market_date,metrics:row.metrics,
          source:row.source,verification_status:row.verification_status,
          review_status:"pending",import_batch:fileName,updated_from_file:localDate()
        };
        if(row.team_matches!=null)data.team_matches=row.team_matches;
        return data;
      }
      const data={
        external_key:row.external_key,kind:row.kind,source:"CraftedFC",
        fotmob_id:row.fotmob_id||"",base44_entity_id:row.linkedId||"",
        name:row.name||"",snapshot_date:row.snapshot_date||"",
        rating:row.rating,rank:row.rank,raw_score:row.raw_score,
        archetype:row.archetype||"",team_strength:row.team_strength,
        league_strength:row.league_strength,payload:row.payload,
        link_status:row.linkStatus,import_batch:fileName
      };
      Object.keys(data).forEach(k=>data[k]===undefined&&delete data[k]);
      return data;
    };
    for(let pos=0;pos<queue.length;){
      const first=queue[pos];
      let group=[first];
      // Base44 supports bulkCreate. Small groups reduce requests without risking huge transactions.
      if(first.action==="crear"){
        while(group.length<25 && pos+group.length<queue.length &&
          queue[pos+group.length].action==="crear" &&
          entityFor(queue[pos+group.length])===entityFor(first)){
          group.push(queue[pos+group.length]);
        }
      }
      try{
        const entity=base44.entities[entityFor(first)];
        const records=group.map(recordFor);
        if(first.action==="actualizar"){
          await entity.update(first.existingId,records[0]);
        }else if(records.length>1){
          await entity.bulkCreate(records);
        }else{
          await entity.create(records[0]);
        }
        group.forEach(row=>reportItems.push({key:keyFor(row),status:row.action==="actualizar"?"actualizado":"creado"}));
      }catch(e){
        // Never retry an uncertain bulk failure automatically: it could already be partially committed.
        group.forEach(row=>reportItems.push({key:keyFor(row),status:"error",reason:String(e?.message||e)+(group.length>1?" · Verificar existencia antes de reintentar este lote.":"")}));
      }
      pos+=group.length;
      setProgress({done:pos,total:queue.length});
      await sleep();
    }
    setReport({file:fileName,importedAt:new Date().toISOString(),total:queue.length,
      created:reportItems.filter(r=>r.status==="creado").length,
      updated:reportItems.filter(r=>r.status==="actualizado").length,
      errors:reportItems.filter(r=>r.status==="error").length,
      skipped:plan.length-queue.length,items:reportItems});
    setAuthorized(false);setPlan(null);setBusy(false);
  };

  const toCreate=plan?.filter(r=>r.action==="crear").length||0;
  const toUpdate=plan?.filter(r=>r.action==="actualizar").length||0;
  const skipped=plan?.filter(r=>r.action==="existente").length||0;
  const unmatched=plan?.filter(r=>r.action==="sin_vinculo").length||0;

  return <div className="h-full w-full overflow-y-auto bg-[#f3f5f9] p-6 text-[#152544]">
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <header className="rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="uppercase tracking-[.18em] text-[10px] font-bold text-blue-700">MF LEGACY · Fuentes externas</p>
          <h1 className="text-2xl font-bold mt-1">Importar FotMob + CraftedFC</h1>
          <p className="text-sm text-slate-600 mt-1">Vista previa antes de guardar. No modifica los atributos FM26 ni las fichas originales.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-blue-50 text-blue-800 px-4 py-2 text-xs font-semibold"><ShieldCheck size={16}/> {isAdmin===true?"Importación solo administrador":isAdmin===null?"Comprobando permisos":"Solo lectura"}</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-5">
          <p className="font-semibold flex items-center gap-2"><CloudUpload size={19}/> 1. Seleccionar lote JSON</p>
          <p className="text-xs text-slate-600 mt-2">Selecciona uno de los archivos <code>mf_legacy_external_batch_v1</code> generados a partir de tu JSON único. Máximo 200 filas por lote y 12 MB por archivo.</p>
          <label className="mt-4 block rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/60 px-4 py-6 text-center cursor-pointer hover:bg-blue-50">
            <FileJson className="mx-auto text-blue-600 mb-2" size={27}/>
            <span className="text-sm font-bold text-blue-700">{fileName || "Elegir archivo JSON de importación"}</span>
            <input type="file" accept=".json,application/json" className="sr-only" onChange={handleFile} disabled={busy}/>
          </label>
          <p className="text-xs text-slate-500 mt-2">Tu JSON original de 86 MB permanece como archivo maestro. El conversor crea lotes pequeños para evitar bloqueos del navegador.</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-2">
          <p className="font-semibold flex items-center gap-2"><Database size={19}/> Coincidencias verificadas</p>
          <div className="text-3xl font-bold text-blue-900">{links.size}</div>
          <p className="text-xs text-slate-600">Vínculos FotMob–Player confirmados actualmente en Base44.</p>
          <div className="border-t pt-2 text-sm">{teamLinks.size} clubes con ID FotMob vinculado</div>
          <p className="text-xs text-amber-700">No se enlaza a nadie por coincidencia de nombre, ni se crean jugadores automáticamente.</p>
        </div>
      </div>

      {error&&<div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex gap-2"><AlertTriangle size={18}/><span className="text-sm">{error}</span></div>}
      {fileErrors.length>0&&<div className="p-4 rounded-lg bg-amber-50 border border-amber-200"><p className="font-semibold text-amber-900">Errores del archivo ({fileErrors.length}); no se puede importar hasta corregirlos</p>{fileErrors.slice(0,8).map((s,i)=><p className="text-xs mt-1" key={i}>{s}</p>)}</div>}

      {!!prepared.length && <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <h2 className="font-bold">2. Revisar el contenido</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.keys(kindLabel).map(k=><div className="bg-slate-50 border rounded-lg p-3" key={k}><div className="text-2xl font-bold">{stats[k]}</div><div className="text-xs text-slate-600">{kindLabel[k]}</div></div>)}
        </div>
        <p className="text-xs text-slate-600">Identificados mediante vínculos confirmados: <b>{stats.linked}</b> · Pendientes de vinculación: <b>{stats.unlinked}</b>.</p>
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" className="mt-1" checked={allowUnlinked} onChange={e=>setAllowUnlinked(e.target.checked)}/>
          <span>Guardar también snapshots <b>sin vincular</b>, exclusivamente como referencias externas, nunca dentro de fichas de jugadores. Los historiales sin Player confirmado siempre quedan excluidos.</span></label>
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" className="mt-1" checked={updateExisting} onChange={e=>setUpdateExisting(e.target.checked)}/>
          <span>Actualizar snapshots externos existentes con la nueva captura (nunca sobrescribir estadísticas históricas ya importadas).</span></label>
        <div className="overflow-auto max-h-[340px] border rounded-lg">
          <table className="w-full text-xs"><thead className="bg-slate-100 sticky top-0"><tr>{["Tipo","ID externo","Nombre / competición","Vínculo","Acción"].map(x=><th key={x} className="p-3 text-left whitespace-nowrap">{x}</th>)}</tr></thead>
          <tbody>{prepared.slice(0,45).map((r,i)=><tr key={i} className="border-t">
            <td className="p-3">{kindLabel[r.kind]}</td>
            <td className="p-3 font-mono">{r.fotmob_id||r.player_fotmob_id||r.external_key?.split(":").pop()}</td>
            <td className="p-3">{r.name||r.player_name||r.competition}</td>
            <td className="p-3">{r.linkedId?<span className="text-emerald-700">Confirmado</span>:<span className="text-amber-700">Sin confirmar</span>}</td>
            <td className="p-3">{plan?.[i]?.action||"Pendiente"}</td>
          </tr>)}</tbody></table>
        </div>
        {prepared.length>45&&<p className="text-xs text-slate-500">Mostrando las primeras 45 filas de {prepared.length}.</p>}
        <button type="button" className="px-5 py-2.5 bg-[#003399] text-white rounded-lg font-bold text-sm disabled:opacity-40 flex gap-2 items-center" disabled={busy||isAdmin!==true||fileErrors.length>0} onClick={makePlan}>
          {busy?<Loader2 size={16} className="animate-spin"/>:<RefreshCw size={16}/>} Verificar duplicados y preparar importación
        </button>
      </section>}

      {plan&&<section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <h2 className="font-bold">3. Confirmar cambios</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          {[[toCreate,"Nuevos"],[toUpdate,"Actualizaciones"],[skipped,"Ya existentes"],[unmatched,"Sin vincular, excluidos"]].map(([num,title])=><div key={title} className="p-3 bg-slate-50 rounded-lg"><div className="text-xl font-bold">{number(num)}</div><p className="text-xs">{title}</p></div>)}
        </div>
        <p className="text-sm text-slate-700">No se escribirá ningún campo de <b>Player, Team, League, FM26 ni CA/PA</b>. Los nuevos registros de historial solo se crean si el ID del jugador está confirmado.</p>
        <label className="flex gap-2 items-center text-sm font-semibold"><input type="checkbox" checked={authorized} onChange={e=>setAuthorized(e.target.checked)}/> He revisado la vista previa y autorizo los cambios indicados.</label>
        <button onClick={importBatch} disabled={!authorized||busy||!(toCreate+toUpdate)} className="px-5 py-2.5 rounded-lg bg-emerald-700 text-white font-bold text-sm disabled:opacity-40">
          {busy?"Importando…":`Importar ${toCreate+toUpdate} registros`}
        </button>
      </section>}

      {busy&&progress.total>0&&<section className="rounded-xl bg-white border border-slate-200 p-4 space-y-2">
        <p className="text-sm font-semibold">Procesando {progress.done} / {progress.total}</p>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-700" style={{width:`${Math.round(progress.done/progress.total*100)}%`}}/></div>
      </section>}
      {report&&<section className="rounded-xl bg-white border border-emerald-300 p-5 space-y-2">
        <p className="font-bold flex items-center gap-2"><CheckCircle2 className="text-emerald-700" size={18}/> Importación terminada</p>
        <p className="text-sm">Creados: {report.created} · Actualizados: {report.updated} · Omitidos: {report.skipped} · Errores: {report.errors}</p>
        <button onClick={()=>download(report,`MF_Legacy_informe_${localDate()}.json`)} className="text-blue-700 text-sm font-bold flex gap-2"><Download size={16}/> Descargar informe de auditoría</button>
      </section>}
      <p className="text-xs text-slate-500">Fuente CraftedFC: snapshot externo independiente. No se convierte su rating global en nota de partido ni se asigna retroactivamente a temporadas FotMob.</p>
    </div>
  </div>;
}
