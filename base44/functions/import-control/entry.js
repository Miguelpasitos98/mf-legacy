import { createClientFromRequest } from "npm:@base44/sdk";

const SOURCE_SET = new Set(["fotmob", "understat", "fifa", "market"]);
const RUNNING = new Set(["queued", "running"]);
const str = (value) => String(value ?? "").trim();
const reply = (body, status = 200) => Response.json(body, {status, headers: {"Cache-Control": "no-store"}});
const bad = (message, code = 400) => reply({ok:false,error:message},code);
const rows = (value) => Array.isArray(value) ? value : value?.items || value?.data || value?.entities || [];
const normal = (v) => str(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export function pendingSources(job){
 return (job.sources||[]).filter(source=>{
  const r=job.source_results?.[source]||{};
  const diagnostics=r.diagnostics||[];
  return r.status==="error"||r.status==="pending"||r.status==="partial"&&!diagnostics.length||
    r.status==="unavailable"&&(!diagnostics.length||!diagnostics.every(d=>d.status==="fuera_cobertura"))||
    diagnostics.some(d=>["consulta_pendiente","error_temporal","cache_absent","cache_mismatch","candidate_limit","query_failed","provider_paused","rate_limited"].includes(d.status));
 });
}
export function pendingScopes(job){
 const states=new Set(["consulta_pendiente","error_temporal","cache_absent","cache_mismatch","candidate_limit","query_failed","provider_paused","rate_limited"]);
 return Object.fromEntries(pendingSources(job).map(source=>{
  const diagnostics=job.source_results?.[source]?.diagnostics||[];
  const unresolved=diagnostics.filter(d=>states.has(d.status));
  return [source,unresolved.length&&unresolved.every(d=>d.season)?unresolved.map(d=>({season:d.season,season_id:d.season_id||"",tournament_id:d.tournament_id||"",competition:d.competition||""})):null];
 }));
}

async function verifiedLink(db, playerId) {
  const related = rows(await db.PlayerFotmobLink.filter({player_id:playerId},undefined,30));
  const exact = related.filter(row => /^[0-9]{1,15}$/.test(str(row.fotmob_player_id)));
  const unique = [...new Set(exact.map(row=>str(row.fotmob_player_id)))];
  if (unique.length !== 1 || related.length !== exact.length) throw Error("La identidad FotMob no es única para este jugador.");
  const pid = unique[0];
  const backlinks = rows(await db.PlayerFotmobLink.filter({fotmob_player_id:pid},undefined,30));
  if (backlinks.some(row=>str(row.player_id)!==playerId)) throw Error("El ID FotMob está asociado a otro jugador.");
  const allowed = new Set(["verified","confirmed","manual","manual_confirmada","confirmada","automatic_exact_name_unique"]);
  const approved = exact.some(r=>allowed.has(str(r.verification).toLowerCase()));
  if (!approved) throw Error("La vinculación FotMob necesita revisión.");
  return {pid, automatic:exact.every(r=>str(r.verification).toLowerCase()==="automatic_exact_name_unique")};
}

export default async function(req) {
  if (req.method !== "POST") return bad("Solo POST.",405);
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") return bad("Solo administradores.",403);
    const body = await req.json();
    const action = str(body.action || "start");
    const db = base44.asServiceRole.entities;
    if(action === "health")return reply({ok:true,coordinator:"ready",worker_credentials_configured:String(Deno.env.get("MF_V3_WORKER_TOKEN")||"").length>=32});
    if (action==="link") {
      const playerId=str(body.player_id);
      const pid=str(body.fotmob_player_id);
      if(!/^[a-f0-9]{24}$/i.test(playerId) || !/^\d{1,15}$/.test(pid))return bad("IDs de jugador no válidos.");
      if(body.confirmed!==true)return bad("Debes confirmar que has contrastado el ID de FotMob.",409);
      const player=await db.Player.get(playerId);
      if(!player?.id)return bad("Jugador inexistente.",404);
      const related=rows(await db.PlayerFotmobLink.filter({player_id:playerId},undefined,30));
      if(related.length){
        if(related.every(x=>str(x.fotmob_player_id)===pid))return reply({ok:true,already_linked:true,pid});
        return bad("El jugador ya tiene otra vinculación FotMob. No se modifica automáticamente.",409);
      }
      const backlinks=rows(await db.PlayerFotmobLink.filter({fotmob_player_id:pid},undefined,30));
      if(backlinks.some(x=>str(x.player_id)!==playerId))return bad("Este ID FotMob está vinculado a otro jugador.",409);
      await db.PlayerFotmobLink.create({
        player_id:playerId,fotmob_player_id:pid,player_name:player.name,
        verification:"manual",note:"Vinculación explícita confirmada por administrador en Import V3"
      });
      return reply({ok:true,pid});
    }
    if(action==="stage-public") {
      const playerId=str(body.player_id),seasonId=str(body.season_stats_id);
      if(!/^[a-f0-9]{24}$/i.test(playerId)||!/^[a-f0-9]{24}$/i.test(seasonId))return bad("Identificadores no válidos.");
      if(body.confirmed!==true)return bad("Revisa expresamente el dato publicado y su ámbito.",409);
      const [player,season]=await Promise.all([db.Player.get(playerId),db.PlayerSeasonStats.get(seasonId)]);
      if(!player?.id||!season?.id||season.player_id!==playerId)return bad("El registro no corresponde al jugador seleccionado.",409);
      const {pid}=await verifiedLink(db,playerId);
      if(str(season.fotmob_player_id)&&str(season.fotmob_player_id)!==pid)return bad("El ID FotMob del registro no coincide.",409);
      if(!/^\\d{1,15}$/.test(str(season.fotmob_team_id))||!/^\\d{1,15}$/.test(str(season.fotmob_tournament_id))||!str(season.competition)||!/^20\\d{2}\\/20\\d{2}$/.test(str(season.season)))
        return bad("Primero concilia el ID de club, competición y temporada de STATS.",409);
      const metric=str(body.metric_name),unit=str(body.metric_unit);
      if(!["xGOT","Goals Prevented","xG","xA"].includes(metric)||!["total","per90"].includes(unit))return bad("Indicador o unidad no admitida.");
      const value=body.value;
      if(typeof value!=="number"||!Number.isFinite(value)||(value<0&&metric!=="Goals Prevented")||Math.abs(value)>10000)return bad("Valor estadístico no válido.");
      const excerpt=str(body.source_excerpt);
      if(excerpt.length<8||excerpt.length>1200)return bad("Pega una frase breve o celda del dato publicado (máx. 1200 caracteres).");
      const evidence=str(body.evidence_url);
      if(evidence.length>800)return bad("Enlace demasiado largo.");
      let validUrl;
      try {validUrl=new URL(evidence);}catch{return bad("Enlace no válido.");}
      const domain=validUrl.hostname.toLowerCase();
      if(validUrl.protocol!=="https:"||validUrl.username||validUrl.password||
        !["theanalyst.com","statsperform.com","premierleague.com","uefa.com"].some(d=>domain===d||domain.endsWith("."+d)))
        return bad("Solo páginas oficiales HTTPS de Opta Analyst, Stats Perform, Premier League o UEFA.");
      const compact=excerpt.replace(/\\s+/g," ").toLowerCase();
      const check=metric==="Goals Prevented"?/(goals? prevented|goles? evitados|psxg)/:
        metric==="xGOT"?/xgot/:metric==="xA"?/\\bxa\\b/:/\\bxg\\b/;
      if(!check.test(compact))return bad("El fragmento no menciona el indicador indicado.",409);
      const numberText=String(value);
      if(!compact.includes(numberText.toLowerCase())&&!compact.includes(numberText.replace(".",",")))
        return bad("El fragmento no contiene la cifra introducida: revisa la transcripción.",409);
      const active=rows(await db.ImportJob.filter({player_id:playerId},undefined,100))
        .some(j=>RUNNING.has(j.status));
      if(active)return bad("Existe una importación activa; termina ese trabajo antes de crear referencias nuevas.",409);
      const now=new Date().toISOString();
      const job=await db.ImportJob.create({
        job_key:"mfv3:public:"+playerId+":"+crypto.randomUUID(),
        player_id:playerId,player_name:player.name,fotmob_player_id:pid,
        sources:["public_reference"],status:"review",progress:100,
        requested_at:now,finished_at:now,
        phase:"Referencia publicada pendiente de verificación manual",
        source_results:{public_reference:{status:"complete",note:"Dato publicado propuesto por el usuario; no se ha consultado automáticamente el sitio."}},
        completed_sources:["public_reference"],received_candidates:1
      });
      const candidate={
        candidate_key:"mfv3:public:"+job.id+":"+crypto.randomUUID(),
        job_id:job.id,player_id:playerId,fotmob_player_id:pid,
        source:"public_reference",kind:"metric",
        season:season.season,competition:season.competition,
        fotmob_team_id:str(season.fotmob_team_id),fotmob_tournament_id:str(season.fotmob_tournament_id),
        team_name:str(season.team_name),...(typeof season.is_national_team==="boolean"?{is_national_team:season.is_national_team}:{}),
        metric_name:metric,metric_unit:unit,value,
        source_record_id:"public:"+seasonId+":"+metric+":"+unit,
        evidence_url:validUrl.toString(),verification_status:"unverified",review_status:"pending",
        derivation:"Dato publicado introducido y confirmado por usuario; verificar en origen antes de aplicar.",
        received_at:now,
        provenance:{provider:"public_reference",archive_url:validUrl.toString(),scope:"player_team_season_competition",
          identity_rule:"verified_fotmob_link_and_existing_stats_row",rate_kind:unit==="per90"?"published_per90":"published_total"}
      };
      try {await db.ImportCandidate.create(candidate);}
      catch(e){await db.ImportJob.update(job.id,{status:"failed",last_error:"No se pudo crear el candidato; no se modificó STATS."});throw e;}
      return reply({ok:true,job:{id:job.id,status:"review"},candidate_count:1});
    }
    if (action === "start" || action === "retry" || action === "retry-pending" || action === "retry-fotmob" || action === "resume") {
      const playerId = str(body.player_id);
      if (!/^[a-f0-9]{24}$/i.test(playerId)) return bad("ID interno de jugador no válido.");
      const player = await db.Player.get(playerId);
      if (!player?.id) return bad("Jugador no encontrado.",404);
      const {pid,automatic} = await verifiedLink(db,playerId);
      const previous=action!=="start"?await db.ImportJob.get(str(body.job_id)):null;
      if(["retry-pending","retry-fotmob"].includes(action)&&(!previous||previous.player_id!==playerId||RUNNING.has(previous.status)))return bad("El trabajo no permite reintentar fuentes pendientes.",409);
      if(action==="retry-fotmob"&&(!(previous.sources||[]).includes("fotmob")||!pendingSources(previous).includes("fotmob")))return bad("No hay competiciones FotMob recuperables en este trabajo.",409);
      const sources = action==="retry-fotmob"?["fotmob"]:action==="retry-pending"?pendingSources(previous):["retry","resume"].includes(action)
        ? [...new Set(previous?.sources||[])]
        : [...new Set(Array.isArray(body.sources)?body.sources:[])];
      if (sources.length===0 || sources.some(x=>!SOURCE_SET.has(x))) return bad("Fuentes solicitadas no válidas.");
      if (action==="retry"||action==="resume") {
        const old=await db.ImportJob.get(str(body.job_id));
        const expired=old?.status==="running"&&old.lease_expires_at&&old.lease_expires_at<new Date().toISOString();
        if (!old || old.player_id!==playerId || !(["failed","cancelled"].includes(old.status)||action==="resume"&&expired)) return bad("Solo se reanudan trabajos interrumpidos o con concesión caducada.",409);
        if(str(old.fotmob_player_id)!==pid)return bad("La identidad FotMob cambió; este trabajo no puede reanudarse con otra vinculación.",409);
        const other=rows(await db.ImportJob.filter({player_id:playerId},undefined,100)).some(j=>j.id!==old.id&&RUNNING.has(j.status));
        if(other)return bad("Ya existe otra importación activa para este jugador.",409);
        await db.ImportJob.update(old.id,{status:"queued",phase:"Reanudando el trabajo guardado",progress:0,requested_at:new Date().toISOString(),claim_id:"",lease_expires_at:"",last_error:"",retry_count:(old.retry_count||0)+1});
        return reply({ok:true,job:{id:old.id,status:"queued",player_name:old.player_name,fotmob_player_id:pid,resumed:true}});
      }
      const active=rows(await db.ImportJob.filter({player_id:playerId},undefined,100));
      const running=active.find(j=>RUNNING.has(j.status));
      if (running) return bad("Ya existe una importación activa para este jugador.",409);
      const now = new Date().toISOString();
      const job = await db.ImportJob.create({
        job_key:"mfv3:"+playerId+":"+crypto.randomUUID(),
        player_id:playerId,player_name:player.name,
        fotmob_player_id:pid,sources,status:"queued",progress:0,
        requested_at:now,phase:"Pendiente de recoger por el trabajador Python",
        source_results:Object.fromEntries(sources.map(s=>[s,{status:"pending"}])),
        completed_sources:[],received_candidates:0,
        retry_count:action==="retry-fotmob"?0:action!=="start"?(previous?.retry_count||0)+1:0,retry_pending:["retry-pending","retry-fotmob"].includes(action),
        ...(["retry-pending","retry-fotmob"].includes(action)?{retry_scopes:action==="retry-fotmob"?{fotmob:pendingScopes(previous).fotmob}:pendingScopes(previous)}:{})
      });
      return reply({ok:true,job:{id:job.id,status:job.status,player_name:job.player_name,fotmob_player_id:pid}});
    }
    if (action==="release-stale") {
      const job=await db.ImportJob.get(str(body.job_id));
      if(!job)return bad("Trabajo no encontrado.",404);
      if(job.status!=="running"||!job.lease_expires_at||Date.now()<=new Date(job.lease_expires_at).getTime())return bad("El trabajo sigue activo o no tiene vencimiento confirmado.",409);
      await db.ImportJob.update(job.id,{status:"failed",phase:"Trabajador sin respuesta; reintento manual disponible",last_error:"La concesión de procesamiento caducó",finished_at:new Date().toISOString(),claim_id:"",lease_expires_at:""});
      return reply({ok:true,status:"failed"});
    }
    if (action==="cancel") {
      const job=await db.ImportJob.get(str(body.job_id));
      if (!job) return bad("Trabajo no encontrado.",404);
      if (!["queued","running"].includes(job.status)) return bad("No se puede cancelar este trabajo.",409);
      const next=await db.ImportJob.update(job.id,{status:"cancelled",phase:"Cancelado por administrador",finished_at:new Date().toISOString()});
      return reply({ok:true,id:next.id,status:"cancelled"});
    }
    return bad("Acción desconocida.");
  } catch(e) {console.error("import-control error",e);return bad(e?.message || "Error interno.",500);}
}
