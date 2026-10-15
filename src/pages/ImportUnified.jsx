import React, {useEffect, useMemo, useState} from "react";
import {base44} from "@/api/base44Client";
import {AlertTriangle, CheckCircle2, CloudUpload, Database, FileJson, ShieldCheck, Loader2, Download, RefreshCw} from "lucide-react";
import {parseUnifiedBatch, rowsFromResponse} from "@/utils/unifiedImport";
import {assessHistoricalEnrichment} from "@/utils/statsEnrichment";

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
  const [allTeams,setAllTeams] = useState([]);
  const [allPlayers,setAllPlayers] = useState([]);
  const [creatingPlayer,setCreatingPlayer] = useState(false);
  const [suggestedPlayerId,setSuggestedPlayerId] = useState("");
  const [identityNotice,setIdentityNotice] = useState("");
  const [fileName,setFileName] = useState("");
  const [batch,setBatch] = useState(null);
  const [fileErrors,setFileErrors] = useState([]);
  const [importWarnings,setImportWarnings] = useState([]);
  const [error,setError] = useState("");
  const [allowUnlinked,setAllowUnlinked] = useState(false);
  const [updateExisting,setUpdateExisting] = useState(false);
  const [enrichExisting,setEnrichExisting] = useState(false);
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
        const [rawLinks,rawTeams,rawPlayers]=await Promise.all([
          base44.entities.PlayerFotmobLink.list({limit:500}),
          base44.entities.Team.list({limit:500}),
          base44.entities.Player.list({limit:500})
        ]);
        if(!live)return;
        setLinks(new Map(rowsFromResponse(rawLinks).filter(x=>x.fotmob_player_id&&x.player_id&&(/manual_confirmada|confirmada|verified|manual|confirmed/i.test(x.verification||""))).map(x=>[String(x.fotmob_player_id),String(x.player_id)])));
        setAllTeams(rowsFromResponse(rawTeams));setAllPlayers(rowsFromResponse(rawPlayers));
        setTeamLinks(new Map(rowsFromResponse(rawTeams).filter(x=>Number(x.fotmob_id)>0&&x.id).map(x=>[String(x.fotmob_id),String(x.id)])));
      } catch(e){if(live){setError("No se pudieron consultar las vinculaciones de Base44: "+e.message);setIsAdmin(false);}}
    })();
    return ()=>{live=false;};
  },[]);

  useEffect(()=>{setPlan(null);setAuthorized(false);setReport(null);},[batch,allowUnlinked,updateExisting,enrichExisting,links,teamLinks]);

  const identity=useMemo(()=>{
    const row=batch?.records?.find(r=>r.kind==="player");
    if(!row)return null;
    const pid=String(row.fotmob_id||"");
    if(!pid || links.has(pid))return null;
    const sameName=allPlayers.filter(p=>String(p.name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase()===String(row.name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase());
    return {pid,name:row.name,role:row.archetype,existing:sameName};
  },[batch,links,allPlayers]);
  const normalizeTeamName = value => String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"").toLowerCase();
  const resolveTeam = row => {
    if(row.kind!=="season")return "";
    const tid=String(row.fotmob_team_id||"");
    // Exact FotMob team ID has highest precedence. Do NOT link by ID zero.
    if(tid && tid!=="0" && teamLinks.has(tid))return teamLinks.get(tid);
    if(!row.team_name)return "";
    const candidates=allTeams.filter(t=>normalizeTeamName(t.name)===normalizeTeamName(row.team_name));
    // Name-only fallback is safe only with one local team and no conflicting FotMob ID.
    const safe=candidates.filter(t=>!t.fotmob_id || !tid || tid==="0" || String(t.fotmob_id)===tid);
    return safe.length===1 && candidates.length===1?String(safe[0].id):"";
  };
  const addIdentity=async()=>{
    if(!identity||isAdmin!==true||creatingPlayer)return;
    setCreatingPlayer(true);setError("");setIdentityNotice("");
    try{
      const pid=identity.pid;
      const latest=rowsFromResponse(await base44.entities.PlayerFotmobLink.filter({fotmob_player_id:pid},{limit:5}));
      if(latest.length){
        if(latest.length>1)throw Error("Hay varios vínculos para este ID; requiere revisión manual.");
        setLinks(old=>new Map(old).set(pid,String(latest[0].player_id)));
        setIdentityNotice("Vínculo existente recuperado. Vuelve a verificar la importación.");
        return;
      }
      let playerId=suggestedPlayerId;
      const latestPlayers=rowsFromResponse(await base44.entities.Player.list({limit:500}));
      if(latestPlayers.length)setAllPlayers(latestPlayers);
      if(playerId && !latestPlayers.some(p=>String(p.id)===playerId))throw Error("El jugador seleccionado ya no existe.");
      const matches=latestPlayers.filter(p=>String(p.name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase()===String(identity.name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase());
      if(!playerId){
        if(matches.length>0)throw Error("Existe un jugador con el mismo nombre: vuelve a seleccionar su ficha antes de crear otra. Si el intento anterior guardó al jugador, vincúlalo ahora.");
        if(!identity.name?.trim())throw Error("El JSON no trae el nombre del jugador.");
        if(!window.confirm("Crear ficha mínima de "+identity.name+" desde FotMob "+pid+" sin UID ni atributos FM26, y vincularla?"))return;
        const positions={ST:"DC",W:"EI",CAM:"CAM",CM:"CM",DM:"CDM",WB:"LD",FB:"LD",CB:"DFC",GK:"GK"};
        if(!positions[identity.role])throw Error("Arquetipo no identificado. Confirma la posición antes de crear una ficha.");
        const payload={name:identity.name,position:positions[identity.role],
          description:"Ficha mínima procedente de FotMob. Pendiente de fusionar/validar con FM26; no contiene atributos del juego."};
        const created=await base44.entities.Player.create(payload);
        playerId=String(created?.id||created?.data?.id||"");
        if(!playerId)throw Error("Player creado sin respuesta de ID. Busca la ficha antes de volver a intentarlo.");
        setAllPlayers(old=>[...old,{...payload,id:playerId}]);
      }else if(!window.confirm("Vincular FotMob "+pid+" con el jugador existente seleccionado, sin alterar su ficha FM26?"))return;
      // If creation of the link fails, keep player for retry; never create a second one.
      await base44.entities.PlayerFotmobLink.create({fotmob_player_id:pid,player_id:playerId,
        player_name:identity.name,verification:"manual_confirmada",
        note:"Alta/verificación del importador externo; FM26 sin modificaciones"});
      setLinks(old=>new Map(old).set(pid,playerId));
      setPlan(null);setAuthorized(false);setReport(null);
      setIdentityNotice("Jugador vinculado correctamente. Pulsa «Verificar duplicados» para importar los historiales.");
      setSuggestedPlayerId("");
    }catch(e){setError("No se completó la vinculación: "+e.message);}
    finally{setCreatingPlayer(false);}
  };

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
    const files=Array.from(evt.target.files||[]); evt.target.value="";
    if(!files.length)return;
    setFileName(files.length===1?files[0].name:files.length+" archivos JSON");setBatch(null);
    setFileErrors([]);setImportWarnings([]);setError("");setProgress({done:0,total:0});
    if(files.length>20||files.reduce((sum,f)=>sum+f.size,0)>30*1024*1024){
      setError("Selecciona como máximo 20 archivos y 30 MB en total por operación, para evitar bloquear Chrome.");return;
    }
    try{
      const records=[],errors=[],warnings=[],seen=new Set();
      for(const file of files){
        const input=JSON.parse((await file.text()).replace(/^\uFEFF/,""));
        const result=parseUnifiedBatch(input);
        const pending=Array.isArray(input.pending_team_review)?input.pending_team_review.length:0;
        if(pending)warnings.push(`${file.name}: ${pending} historiales con equipo sin confirmar permanecen fuera de la importación. Revísalos en el JSON original.`);
        if(input.validated_for_direct_bulk_import===false)warnings.push(`${file.name}: el exportador ha marcado este lote como pendiente de validación. Revisa especialmente las parejas club-temporada antes de aplicar cambios.`);
        if(Array.isArray(input.summary?.conflicts_kept)&&input.summary.conflicts_kept.length)warnings.push(`${file.name}: ${input.summary.conflicts_kept.length} diferencias de fuente conservadas para revisión, sin sobrescribir automáticamente.`);
        for(const problem of result.errors)errors.push(file.name+": "+problem);
        for(const row of result.records){
          const key=row.external_key||row.external_record_id;
          if(seen.has(key))errors.push(file.name+": registro duplicado entre archivos ("+key+")");
          else{seen.add(key);records.push(row);}
        }
      }
      setBatch({records});setFileErrors(errors);setImportWarnings(warnings);
      if(!errors.length&&files.length===1&&isAdmin===true){
        setBusy(true);
        setError("");
        try{
          await autoImport({records},files[0].name);
        }catch(autoError){
          setError("Importación automática pendiente: "+(autoError?.message||autoError)+". Puedes revisar los datos manualmente.");
        }finally{setBusy(false);}
      }
    }catch(e){setError(e.message);}
  };

  const makePlan = async (sourceRows=prepared, automatic=false) => {
    if(!sourceRows.length||(!automatic&&fileErrors.length)||isAdmin!==true)return;
    setBusy(true);setError("");setReport(null);
    try{
      const existing=new Map();
      for(const kind of ["player","team","league","season"]){
        const selected=sourceRows.filter(x=>x.kind===kind);
        if(!selected.length)continue;
        const keys=selected.map(x=>kind==="season"?x.external_record_id:x.external_key);
        const entity = kind==="season" ? "PlayerSeasonStats" : "ExternalFootballSnapshot";
        const field = kind==="season" ? "external_record_id" : "external_key";
        for(let i=0;i<keys.length;i+=150){
          const portion=keys.slice(i,i+150);
          const found=await base44.entities[entity].filter({[field]:{$in:portion}},{limit:200});
          for(const item of rowsFromResponse(found))existing.set(kind+":"+(item[field]||""),item);
        }
      }
      const next=sourceRows.map(x=>{
        const key=x.kind==="season"?x.external_record_id:x.external_key;
        const old=existing.get(x.kind+":"+key);
        if(!x.linkedId && (x.kind==="season"||!allowUnlinked)) {
          return {...x,action:"sin_vinculo",existingId:old?.id||null};
        }
        if(old && x.kind==="season" && enrichExisting){
          const analysis=assessHistoricalEnrichment(old,x,x.linkedId);
          return {...x,action:!analysis.ok?"revisar":analysis.added?"enriquecer":"existente",
            existingId:old?.id||null,newMetricsCount:analysis.added,
            conflicts:analysis.conflicts,reviewNotes:analysis.errors};
        }
        return {...x,action:old?(updateExisting&&x.kind!=="season"?"actualizar":"existente"):"crear",existingId:old?.id||null};
      });
      if(automatic)return next;
      setPlan(next);
    }catch(e){setError("No se pudo verificar la existencia previa; no se guardará nada. "+e.message);}
    finally{setBusy(false);}
  };

  const importBatch=async(sourcePlan=plan, automatic=false)=>{
    if(!sourcePlan||(!automatic&&!authorized)||isAdmin!==true||(!automatic&&busy))return;
    // Never run a stale plan after a player link has changed.
    if(!automatic&&sourcePlan.some(r=>(r.kind==="season"||r.kind==="player") && r.linkedId!==(links.get(r.kind==="season"?r.player_fotmob_id:r.fotmob_id)||""))){
      setError("Las vinculaciones cambiaron desde la verificación. Pulsa «Verificar duplicados y preparar importación» para recalcular antes de guardar.");
      setPlan(null);setAuthorized(false);return;
    }
    const queue=sourcePlan.filter(r=>automatic?r.action==="crear":["crear","enriquecer"].includes(r.action));
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
          team_id:row.resolvedTeamId||resolveTeam(row),
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
        if(first.action==="enriquecer"){
          // Re-read the current record before writing, protecting manual edits
          // made since the preview. Only the array of additional metrics is updated.
          const matches=rowsFromResponse(await entity.filter(
            {external_record_id:first.external_record_id},{limit:2}
          ));
          if(matches.length!==1 || matches[0].id!==first.existingId)
            throw Error("Registro original modificado o no único. Repetir verificación.");
          const analysis=assessHistoricalEnrichment(matches[0],first,first.linkedId);
          if(!analysis.ok)throw Error(analysis.errors.join(" "));
          if(analysis.added===0)throw Error("Sin estadísticas nuevas; repite la verificación.");
          await entity.update(first.existingId,{metrics:analysis.metrics});
        }else if(first.action==="actualizar"){
          await entity.update(first.existingId,records[0]);
        }else if(records.length>1){
          await entity.bulkCreate(records);
        }else{
          await entity.create(records[0]);
        }
        group.forEach(row=>reportItems.push({key:keyFor(row),status:row.action==="enriquecer"?"enriquecido":row.action==="actualizar"?"actualizado":"creado",added_metrics:row.action==="enriquecer"?row.newMetricsCount:undefined,conflicts_kept:row.conflicts?.length||0}));
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
      enriched:reportItems.filter(r=>r.status==="enriquecido").length,
      errors:reportItems.filter(r=>r.status==="error").length,
      skipped:sourcePlan.length-queue.length,items:reportItems});
    setAuthorized(false);setPlan(null);setBusy(false);
  };

  const autoImport = async (parsed, filenameForRun) => {
    if(isAdmin!==true)throw Error("Necesitas permisos de administrador.");
    const safeRows=parsed.records;
    const playerIds=[...new Set(safeRows.filter(r=>r.kind==="player"||r.kind==="season")
      .map(r=>String(r.kind==="season"?r.player_fotmob_id:r.fotmob_id)).filter(Boolean))];
    if(playerIds.length!==1)throw Error("Este archivo contiene varios jugadores o no identifica uno solo. Usa revisión manual.");
    const pid=playerIds[0];
    const [linkResponse,playersResponse,teamsResponse]=await Promise.all([
      base44.entities.PlayerFotmobLink.filter({fotmob_player_id:pid},{limit:10}),
      base44.entities.Player.list({limit:500}),
      base44.entities.Team.list({limit:500}),
    ]);
    const existingLinks=rowsFromResponse(linkResponse);
    if(existingLinks.length>1)throw Error("Hay varios vínculos de jugador: revisión manual obligatoria.");
    const localPlayers=rowsFromResponse(playersResponse);
    const localTeams=rowsFromResponse(teamsResponse);
    const normalized=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
    let linkedId=existingLinks[0]?.player_id||"";
    if(linkedId&&!localPlayers.some(p=>String(p.id)===String(linkedId)))
      throw Error("El vínculo FotMob apunta a una ficha inexistente; requiere revisión.");
    if(!linkedId){
      const identityRow=safeRows.find(r=>r.kind==="player"&&String(r.fotmob_id)===pid);
      if(!identityRow?.name)throw Error("Falta la identidad del jugador en el JSON.");
      const candidates=localPlayers.filter(p=>normalized(p.name)===normalized(identityRow.name));
      if(candidates.length)throw Error("El jugador ya podría existir ("+identityRow.name+"). Revisa el vínculo antes de crear duplicados.");
      const positions={ST:"DC",W:"EI",CAM:"CAM",CM:"CM",DM:"CDM",CB:"DFC",GK:"GK"};
      const position=positions[identityRow.archetype];
      if(!position)throw Error("La posición no está verificada para crear la ficha automáticamente.");
      // A created Player is durable. Before retrying after a network error,
      // the next attempt checks names and refuses to duplicate.
      const created=await base44.entities.Player.create({
        name:identityRow.name,position,
        description:"Ficha mínima FotMob, sin atributos ni UID de FM26. Identidad externa pendiente de revisión.",
      });
      linkedId=String(created?.id||created?.data?.id||"");
      if(!linkedId)throw Error("Se creó una ficha pero no se confirmó su ID. Revisa PLAYERS antes de reintentar.");
      await base44.entities.PlayerFotmobLink.create({
        fotmob_player_id:pid,player_id:linkedId,player_name:identityRow.name,
        verification:"manual_confirmada",note:"Importación automática con identidad FotMob y comprobación de nombre único",
      });
    }
    const mapped=new Map([[pid,String(linkedId)]]);
    const teamMap=new Map(localTeams.filter(t=>t.fotmob_id&&t.id).map(t=>[String(t.fotmob_id),String(t.id)]));
    const resolved=safeRows.map(row=>{
      const rid=row.kind==="season"?row.player_fotmob_id:row.fotmob_id;
      const id=row.kind==="season"||row.kind==="player"?mapped.get(String(rid)):row.kind==="team"?teamMap.get(String(rid)):"";
      return {...row,linkedId:id||"",linkStatus:id?"confirmed":"unlinked"};
    });
    setLinks(old=>new Map(old).set(pid,String(linkedId)));
    setAllPlayers(localPlayers);
    setAllTeams(localTeams);
    setTeamLinks(teamMap);
    const preparedPlan=await makePlan(resolved,true);
    if(!preparedPlan)return;
    const safePlan=preparedPlan.map(row=>{
      // Never add an unconfirmed player, overwrite manual stats, or
      // silently assume ambiguous club identity.
      if(row.kind!=="season")return row;
      const tid=String(row.fotmob_team_id||"");
      let teamId=tid&&tid!=="0"?teamMap.get(tid):"";
      if(!teamId&&row.team_name){
        const candidates=localTeams.filter(t=>normalized(t.name)===normalized(row.team_name));
        if(candidates.length===1&&(!candidates[0].fotmob_id||String(candidates[0].fotmob_id)===tid))
          teamId=String(candidates[0].id);
      }
      return {...row,resolvedTeamId:teamId||""};
    });
    await importBatch(safePlan,true);
  };

  const toCreate=plan?.filter(r=>r.action==="crear").length||0;
  const toUpdate=plan?.filter(r=>r.action==="actualizar").length||0;
  const toEnrich=plan?.filter(r=>r.action==="enriquecer").length||0;
  const needReview=plan?.filter(r=>r.action==="revisar").length||0;
  const metricsToAdd=plan?.filter(r=>r.action==="enriquecer").reduce((n,r)=>n+(r.newMetricsCount||0),0)||0;
  const skipped=plan?.filter(r=>r.action==="existente").length||0;
  const unmatched=plan?.filter(r=>r.action==="sin_vinculo").length||0;

  return <div className="h-full w-full overflow-y-auto bg-[#f3f5f9] p-6 text-[#152544]">
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <header className="rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="uppercase tracking-[.18em] text-[10px] font-bold text-blue-700">MF LEGACY · STATS · Fuentes externas</p>
          <h1 className="text-2xl font-bold mt-1">Importar FotMob + CraftedFC</h1>
          <p className="text-sm text-slate-600 mt-1">Vista previa antes de guardar. No modifica los atributos FM26 ni las fichas originales.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-blue-50 text-blue-800 px-4 py-2 text-xs font-semibold"><ShieldCheck size={16}/> {isAdmin===true?"Importación solo administrador":isAdmin===null?"Comprobando permisos":"Solo lectura"}</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-5">
          <p className="font-semibold flex items-center gap-2"><CloudUpload size={19}/> 1. Seleccionar lote JSON</p>
          <p className="text-xs text-slate-600 mt-2">Selecciona uno o varios archivos <code>mf_legacy_external_batch_v1</code> derivados de tu JSON único. Hasta 20 archivos y 30 MB por operación.</p>
          <label className="mt-4 block rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/60 px-4 py-6 text-center cursor-pointer hover:bg-blue-50">
            <FileJson className="mx-auto text-blue-600 mb-2" size={27}/>
            <span className="text-sm font-bold text-blue-700">{fileName || "Elegir archivo JSON de importación"}</span>
            <input type="file" multiple accept=".json,application/json" className="sr-only" onChange={handleFile} disabled={busy}/>
          </label>
          <p className="text-xs text-slate-500 mt-2">Tu JSON original de 86 MB permanece como archivo maestro. El conversor crea lotes pequeños para evitar bloqueos del navegador.</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-2">
          <p className="font-semibold flex items-center gap-2"><Database size={19}/> Coincidencias verificadas</p>
          <div className="text-3xl font-bold text-blue-900">{links.size}</div>
          <p className="text-xs text-slate-600">Vínculos FotMob–Player confirmados actualmente en Base44.</p>
          <div className="border-t pt-2 text-sm">{teamLinks.size} clubes con ID FotMob vinculado</div>
          <p className="text-xs text-amber-700">Los jugadores externos se crean solo tras confirmación. Los equipos se enlazan por ID FotMob o por nombre único sin conflicto.</p>
        </div>
      </div>

      {error&&<div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex gap-2"><AlertTriangle size={18}/><span className="text-sm">{error}</span></div>}
      {fileErrors.length>0&&<div className="p-4 rounded-lg bg-amber-50 border border-amber-200"><p className="font-semibold text-amber-900">Errores del archivo ({fileErrors.length}); no se puede importar hasta corregirlos</p>{fileErrors.slice(0,8).map((s,i)=><p className="text-xs mt-1" key={i}>{s}</p>)}</div>}
      {importWarnings.length>0&&<div className="p-4 rounded-lg bg-amber-50 border border-amber-200"><p className="font-semibold text-amber-900 flex gap-2 items-center"><AlertTriangle size={17}/> Avisos del archivo: revisión necesaria antes de importar</p>{importWarnings.map((s,i)=><p className="text-xs text-amber-900 mt-1" key={i}>{s}</p>)}</div>}

      {identity&&<section className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
        <h2 className="font-bold text-blue-950">Vincular jugador · {identity.name} (FotMob {identity.pid})</h2>
        <p className="text-xs text-blue-900">No existe un vínculo confirmado. Puedes utilizar una ficha existente o crear una ficha mínima sin UID, CA/PA ni otros atributos FM26.</p>
        {identity.existing.length>0&&<p className="text-xs font-bold text-amber-800">Hay una coincidencia exacta de nombre: revisa y selecciona el jugador existente. No se creará un duplicado automáticamente.</p>}
        <select className="max-w-full rounded-lg border border-blue-200 bg-white p-2 text-sm" value={suggestedPlayerId} onChange={e=>setSuggestedPlayerId(e.target.value)}>
          <option value="">Crear ficha mínima nueva (solo si no existe)</option>
          {allPlayers.filter(p=>identity.existing.some(x=>x.id===p.id)).map(p=><option key={p.id} value={p.id}>{p.name} · {p.fm26_uid||"Sin FM26 UID"}</option>)}
        </select>
        <button disabled={creatingPlayer||isAdmin!==true} onClick={addIdentity} className="block rounded-lg bg-[#003399] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{creatingPlayer?"Vinculando…":suggestedPlayerId?"Vincular ficha existente":"Crear ficha mínima y vincular"}</button>
      </section>}
      {identityNotice&&<p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{identityNotice}</p>}
      {!!prepared.length && <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <h2 className="font-bold">2. Revisar el contenido</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.keys(kindLabel).map(k=><div className="bg-slate-50 border rounded-lg p-3" key={k}><div className="text-2xl font-bold">{stats[k]}</div><div className="text-xs text-slate-600">{kindLabel[k]}</div></div>)}
        </div>
        <p className="text-xs text-slate-600">Identificados mediante vínculos confirmados: <b>{stats.linked}</b> · Pendientes de vinculación: <b>{stats.unlinked}</b>.</p>
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" className="mt-1" checked={allowUnlinked} onChange={e=>setAllowUnlinked(e.target.checked)}/>
          <span>Guardar también snapshots <b>sin vincular</b>, exclusivamente como referencias externas, nunca dentro de fichas de jugadores. Los historiales sin Player confirmado siempre quedan excluidos.</span></label>
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" className="mt-1" checked={updateExisting} onChange={e=>setUpdateExisting(e.target.checked)}/>
          <span>Actualizar snapshots externos existentes con la nueva captura (no afecta a datos históricos).</span></label>
        <label className="flex gap-2 items-start text-sm rounded-lg border border-blue-200 bg-blue-50 p-3"><input type="checkbox" className="mt-1" checked={enrichExisting} onChange={e=>setEnrichExisting(e.target.checked)}/>
          <span><strong>Enriquecer historiales existentes con estadísticas detalladas.</strong><span className="block text-xs text-slate-600">Añade solo métricas que faltan. Conserva partidos, minutos, nota, equipo, tus ediciones y los valores de métricas que ya existan. Las coberturas distintas quedan bloqueadas para revisión.</span></span></label>
        <div className="overflow-auto max-h-[340px] border rounded-lg">
          <table className="w-full text-xs"><thead className="bg-slate-100 sticky top-0"><tr>{["Tipo","ID externo","Nombre / competición","Vínculo","Acción"].map(x=><th key={x} className="p-3 text-left whitespace-nowrap">{x}</th>)}</tr></thead>
          <tbody>{prepared.slice(0,45).map((r,i)=><tr key={i} className="border-t">
            <td className="p-3">{kindLabel[r.kind]}</td>
            <td className="p-3 font-mono">{r.fotmob_id||r.player_fotmob_id||r.external_key?.split(":").pop()}</td>
            <td className="p-3">{r.name||r.player_name||r.competition}</td>
            <td className="p-3">{r.linkedId?<span className="text-emerald-700">Confirmado</span>:<span className="text-amber-700">Sin confirmar</span>}</td>
            <td className="p-3">{r.kind==="season" && resolveTeam(r) && <span className="mr-2 text-[10px] text-emerald-700">Equipo vinculado</span>}{plan?.[i]?.action||"Pendiente"}{plan?.[i]?.action==="enriquecer"&&<span className="ml-1 text-emerald-700">(+{plan[i].newMetricsCount} métricas)</span>}{plan?.[i]?.action==="revisar"&&<span className="block text-rose-700">{plan[i].reviewNotes?.join("; ")}</span>}</td>
          </tr>)}</tbody></table>
        </div>
        {prepared.length>45&&<p className="text-xs text-slate-500">Mostrando las primeras 45 filas de {prepared.length}.</p>}
        <button type="button" className="px-5 py-2.5 bg-[#003399] text-white rounded-lg font-bold text-sm disabled:opacity-40 flex gap-2 items-center" disabled={busy||isAdmin!==true||fileErrors.length>0} onClick={()=>makePlan()}>
          {busy?<Loader2 size={16} className="animate-spin"/>:<RefreshCw size={16}/>} Verificar duplicados y preparar importación
        </button>
      </section>}

      {plan&&<section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <h2 className="font-bold">3. Confirmar cambios</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          {[[toCreate,"Nuevos"],[toEnrich,"Historiales a enriquecer"],[toUpdate,"Snapshots a actualizar"],[skipped,"Ya existentes"],[unmatched,"Sin vincular"],[needReview,"Revisión obligatoria"]].map(([num,title])=><div key={title} className="p-3 bg-slate-50 rounded-lg"><div className="text-xl font-bold">{number(num)}</div><p className="text-xs">{title}</p></div>)}
        </div>
        <p className="text-sm text-slate-700">Durante la importación de historiales no se sobrescribirá ningún campo de <b>Player, Team, League, FM26 ni CA/PA</b>. Las fichas mínimas solo se crean al confirmarlas expresamente en el paso anterior. Los historiales existentes solo reciben métricas nuevas si autorizas «Enriquecer». Se añadirán <b>{metricsToAdd} métricas</b> a {toEnrich} historiales, sin alterar PJ, minutos ni notas.</p>
        <label className="flex gap-2 items-center text-sm font-semibold"><input type="checkbox" checked={authorized} onChange={e=>setAuthorized(e.target.checked)}/> He revisado la vista previa y autorizo los cambios indicados.</label>
        <button onClick={()=>importBatch()} disabled={!authorized||busy||!(toCreate+toUpdate+toEnrich)} className="px-5 py-2.5 rounded-lg bg-emerald-700 text-white font-bold text-sm disabled:opacity-40">
          {busy?"Importando…":`Aplicar ${toCreate+toUpdate+toEnrich} cambios`}
        </button>
      </section>}

      {busy&&progress.total>0&&<section className="rounded-xl bg-white border border-slate-200 p-4 space-y-2">
        <p className="text-sm font-semibold">Procesando {progress.done} / {progress.total}</p>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-700" style={{width:`${Math.round(progress.done/progress.total*100)}%`}}/></div>
      </section>}
      {report&&<section className="rounded-xl bg-white border border-emerald-300 p-5 space-y-2">
        <p className="font-bold flex items-center gap-2"><CheckCircle2 className="text-emerald-700" size={18}/> Importación terminada</p>
        <p className="text-sm">Creados: {report.created} · Enriquecidos: {report.enriched||0} · Actualizados: {report.updated} · Omitidos: {report.skipped} · Errores: {report.errors}</p>
        <button onClick={()=>download(report,`MF_Legacy_informe_${localDate()}.json`)} className="text-blue-700 text-sm font-bold flex gap-2"><Download size={16}/> Descargar informe de auditoría</button>
      </section>}
      <p className="text-xs text-slate-500">Fuente CraftedFC: snapshot externo independiente. No se convierte su rating global en nota de partido ni se asigna retroactivamente a temporadas FotMob.</p>
    </div>
  </div>;
}
