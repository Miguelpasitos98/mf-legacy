import { createClientFromRequest } from "npm:@base44/sdk";

const reply=(x,status=200)=>Response.json(x,{status,headers:{"Cache-Control":"no-store"}});
const fail=(msg,status=400)=>reply({ok:false,error:msg},status);
const str=(x)=>String(x??"").trim();
const rows=(v)=>Array.isArray(v)?v:v?.items||v?.data||v?.entities||[];
const SOURCES=new Set(["fotmob","understat","fifa","market"]);
const KINDS=new Set(["metric","overall","market_value"]);
const UNITS=new Set(["total","per90","percentage","per_match"]);
const iso=(v)=>/^\d{4}(\/\d{4})?$/.test(str(v));
const secretEqual=(a,b)=>{
  const aa=new TextEncoder().encode(str(a)),bb=new TextEncoder().encode(str(b));
  let diff=aa.length^bb.length;
  for(let i=0;i<Math.max(aa.length,bb.length);i++)diff|=(aa[i]||0)^(bb[i]||0);
  return diff===0;
};
async function digest(value) {
  const result=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(result)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function validate(input,job) {
  if (!input || typeof input!=="object" || Array.isArray(input)) throw Error("Candidato inválido.");
  const source=str(input.source),kind=str(input.kind),season=str(input.season);
  const value=input.value;
  if (!SOURCES.has(source)||!(job.sources||[]).includes(source)) throw Error("Fuente no solicitada.");
  if (!KINDS.has(kind)||!iso(season)) throw Error("Tipo o temporada no válido.");
  const signedMetric=kind==="metric"&&["goals prevented","goles evitados"].includes(str(input.metric_name).toLowerCase());
  if (typeof value!=="number"||!Number.isFinite(value)||(value<0&&!signedMetric)) throw Error("Valor numérico no válido.");
  const comp=str(input.competition),teamId=str(input.fotmob_team_id);
  const teamName=str(input.team_name),name=str(input.metric_name);
  const sourceRecordId=str(input.source_record_id);
  const evidence=str(input.evidence_url),unit=str(input.metric_unit);
  if (sourceRecordId.length>180||name.length>100||comp.length>140||teamName.length>140) throw Error("Texto demasiado largo.");
  if (evidence && (!/^https:\/\//.test(evidence)||evidence.length>800)) throw Error("URL de evidencia incorrecta.");
  if (kind==="metric") {
    if (!["fotmob","understat"].includes(source)||!name||!comp||!teamId||!UNITS.has(unit)) throw Error("Métrica sin identidad completa.");
    if (unit==="percentage"&&value>100) throw Error("Porcentaje fuera de rango.");
  }
  if (kind==="overall") {
    if(source!=="fifa"||!Number.isInteger(value)||value<1||value>99||!str(input.fifa_edition)) throw Error("Overall inválido.");
  }
  if (kind==="market_value") {
    if(source!=="market"||!Number.isInteger(value)||!/^20\d{2}-\d\d-\d\d$/.test(str(input.as_of_date))) throw Error("Valor de mercado sin fecha contrastada.");
  }
  if (input.verification_status==="verified"&&!evidence) throw Error("No se pueden verificar datos sin evidencia.");
  const verification_status = input.verification_status==="verified"?"verified":"unverified";
  if(input.fotmob_tournament_id && !/^\d{1,15}$/.test(str(input.fotmob_tournament_id)))throw Error("ID de competición no válido.");
  if(input.is_national_team!==undefined&&typeof input.is_national_team!=="boolean")throw Error("Ámbito de equipo no válido.");
  return {...(input.fotmob_tournament_id?{fotmob_tournament_id:str(input.fotmob_tournament_id)}:{}),
    ...(typeof input.is_national_team==="boolean"?{is_national_team:input.is_national_team}:{}),
    ...(str(input.derivation)?{derivation:str(input.derivation).slice(0,300)}:{}),
    ...(typeof input.percentile==="number"&&Number.isFinite(input.percentile)&&input.percentile>=0&&input.percentile<=100?{percentile:input.percentile}:{}),
    source,kind,season,competition:comp,fotmob_team_id:teamId,team_name:teamName,
    metric_name:name,metric_unit:unit,value,fifa_edition:str(input.fifa_edition),
    fifa_fc_position:str(input.fifa_fc_position),as_of_date:str(input.as_of_date),
    evidence_url:evidence,source_record_id:sourceRecordId,verification_status,
    ...(input.provenance?{provenance:provenanceRecord(input.provenance)}:{})};
}

export function provenanceRecord(input){
  if(!input||typeof input!=="object"||Array.isArray(input)||JSON.stringify(input).length>4000)throw Error("Procedencia inválida o demasiado grande.");
  const keys=["provider","player_id","archive_url","sha256","revision","revision_date","rating_kind","release_date","mode","identity_rule","scope","archive_cutoff","selection_rule","value_kind","license","archive_version","source_club","rate_kind","retrieved_at"];
  const result=Object.fromEntries(keys.filter(k=>typeof input[k]==="string").map(k=>[k,input[k].slice(0,k.endsWith("url")?800:200)]));
  if(typeof input.provider_minutes==="number"&&Number.isFinite(input.provider_minutes)&&input.provider_minutes>0)result.provider_minutes=input.provider_minutes;
  if(typeof input.provisional==="boolean")result.provisional=input.provisional;
  return result;
}

export default async function(req) {
  if(req.method!=="POST")return fail("Solo POST.",405);
  const configured=str(Deno.env.get("MF_V3_WORKER_TOKEN"));
  if(configured.length<32)return fail("Trabajador aún no configurado.",503);
  if(!secretEqual(req.headers.get("X-MF-Worker-Token"),configured))return fail("Credenciales no válidas.",401);
  const limit=Number(req.headers.get("content-length")||0);
  if(limit>240000)return fail("Solicitud demasiado grande.",413);
  try {
    const text=await req.text();
    if(text.length>240000)return fail("Solicitud demasiado grande.",413);
    const body=JSON.parse(text);
    const client=createClientFromRequest(req);
    const db=client.asServiceRole.entities;
    const action=str(body.action);
    if(action==="claim") {
      if(body.job_id&&!/^[a-f0-9]{24}$/i.test(str(body.job_id)))return fail("ID de trabajo incorrecto.");
      const waiting=body.job_id?[await db.ImportJob.get(str(body.job_id))].filter(j=>j?.status==="queued")
        :rows(await db.ImportJob.filter({status:"queued"},undefined,100))
           .filter(j=>!j.requested_at||Date.parse(j.requested_at)<=Date.now());
      const job=waiting.sort((a,b)=>str(a.requested_at).localeCompare(str(b.requested_at)))[0];
      if(!job)return reply({ok:true,job:null});
      const claimId=crypto.randomUUID(),now=new Date();
      const end=new Date(now.getTime()+10*60*1000).toISOString();
      await db.ImportJob.update(job.id,{status:"running",phase:"Iniciando extracción",progress:1,claim_id:claimId,worker_id:str(body.worker_id).slice(0,80),started_at:now.toISOString(),heartbeat_at:now.toISOString(),lease_expires_at:end});
      const check=await db.ImportJob.get(job.id);
      if(check.claim_id!==claimId||check.status!=="running")return reply({ok:true,job:null});
      const existing_stats=[];
      for(let skip=0;skip<2000;skip+=100){
        const page=rows(await db.PlayerSeasonStats.filter({player_id:check.player_id},"id",100,skip));
        existing_stats.push(...page.map(r=>({season:r.season,competition:r.competition,fotmob_tournament_id:r.fotmob_tournament_id,fotmob_team_id:r.fotmob_team_id})));
        if(page.length<100)return reply({ok:true,job:{id:check.id,claim_id:claimId,player_id:check.player_id,fotmob_player_id:check.fotmob_player_id,player_name:check.player_name,sources:check.sources,retry_pending:check.retry_pending===true,retry_scopes:check.retry_scopes||null,existing_stats}});
      }
      throw Error("Demasiadas filas previas; no se usa una instantánea parcial.");
    }
    if(!/^[a-f0-9]{24}$/i.test(str(body.job_id)))return fail("ID de trabajo incorrecto.");
    const job=await db.ImportJob.get(str(body.job_id));
    if(!job)return fail("Trabajo no encontrado.",404);
    if(action==="review-status"){
      const groups=new Map();
      for(let skip=0;skip<10000;skip+=100){
        const page=rows(await db.ImportCandidate.filter({job_id:job.id},"id",100,skip));
        for(const c of page){const key=[c.source,c.season].join("|");
          if(!groups.has(key))groups.set(key,{source:c.source,season:c.season,pending:0,applied:0,rejected:0});
          const g=groups.get(key);if(["pending","applied","rejected"].includes(c.review_status))g[c.review_status]++;
        }
        if(page.length<100)return reply({ok:true,groups:[...groups.values()],finished:job.status==="completed"});
      }
      return fail("La revisión supera el límite de lectura.",409);
    }
    if(job.status!=="running"||!job.claim_id||job.claim_id!==str(body.claim_id))return fail("Trabajo no adquirido o cancelado.",409);
    if(job.lease_expires_at&&Date.now()>new Date(job.lease_expires_at).getTime())return fail("La concesión del trabajo ha caducado.",409);
    if(action==="heartbeat") {
      const progress=Math.min(95,Math.max(1,Math.trunc(Number(body.progress)||1)));
      const now=new Date(),expires=new Date(now.getTime()+10*60*1000);
      await db.ImportJob.update(job.id,{progress:Math.max(progress,job.progress||0),
        phase:str(body.phase).slice(0,200)||"Procesando",heartbeat_at:now.toISOString(),lease_expires_at:expires.toISOString()});
      return reply({ok:true});
    }
    if(action==="submit") {
      const candidates=body.candidates;
      if(!Array.isArray(candidates)||candidates.length===0||candidates.length>25)return fail("Se permiten entre 1 y 25 candidatos.");
      const normalized=candidates.map(x=>validate(x,job));
      const rowsByKey=new Map();
      for(const item of normalized) {
        const keySource=[job.id,item.source,item.kind,item.season,item.competition,item.fotmob_team_id,item.metric_name,item.metric_unit,item.fifa_edition,item.as_of_date,item.source_record_id].join("|");
        const candidate_key="mfv3:"+job.id+":"+(await digest(keySource));
        if(rowsByKey.has(candidate_key)) {
          if(rowsByKey.get(candidate_key).value!==item.value)throw Error("Lote con valores contradictorios.");
          continue;
        }
        rowsByKey.set(candidate_key,{...item,candidate_key,job_id:job.id,player_id:job.player_id,
          fotmob_player_id:job.fotmob_player_id,review_status:"pending",received_at:new Date().toISOString()});
      }
      const received=rows(await db.ImportCandidate.filter({candidate_key:{$in:[...rowsByKey.keys()]}},undefined,100));
      const originals=new Map();
      for(const old of received) {
        if(originals.has(old.candidate_key))throw Error("Candidatos duplicados almacenados: requiere revisión.");
        originals.set(old.candidate_key,old);
      }
      let created=0,unchanged=0,conflict=0;
      const fresh=[];
      for(const [key,item] of rowsByKey) {
        const existing=originals.get(key);
        if(!existing)fresh.push(item);
        else if(existing.value===item.value)unchanged++;
        else {conflict++;await db.ImportCandidate.update(existing.id,{verification_status:"conflict",review_note:"El proveedor ha enviado cifras contradictorias; no se ha reemplazado el valor."});}
      }
      if(fresh.length) {
        try {
          await db.ImportCandidate.bulkCreate(fresh);
        } catch(e) {
          // A failed network response may hide a successful commit. Re-read
          // identifiers and DO NOT replay unconfirmed bulk writes.
          const check=rows(await db.ImportCandidate.filter({candidate_key:{$in:fresh.map(x=>x.candidate_key)}},undefined,100));
          if(check.length!==fresh.length)throw Error("Lote no confirmado: revisar sin reintentar escrituras ambiguas. "+e.message);
        }
        created=fresh.length;
      }
      await db.ImportJob.update(job.id,{received_candidates:(job.received_candidates||0)+created,
        phase:"Recibidas "+created+" nuevas observaciones; pendientes de validación"});
      return reply({ok:true,created,unchanged,conflict});
    }
    if(action==="finish") {
      const report=body.source_results&&typeof body.source_results==="object"&&!Array.isArray(body.source_results)?body.source_results:{};
      const source_results={};
      for(const s of job.sources||[]) {
        const v=report[s]||{};
        source_results[s]={status:["complete","partial","unavailable","error","skipped"].includes(v.status)?v.status:"error",
          note:str(v.note).slice(0,300),
          counts:Object.fromEntries(Object.entries(v.counts||{}).filter(([k,n])=>/^[a-z_]{1,45}$/.test(k)&&Number.isInteger(n)&&n>=0)),
          diagnostics:(Array.isArray(v.diagnostics)?v.diagnostics:[]).slice(0,200).map(d=>({
            season:str(d.season).slice(0,20),competition:str(d.competition).slice(0,140),
            season_id:str(d.season_id).slice(0,20),tournament_id:str(d.tournament_id).slice(0,20),
            status:str(d.status).slice(0,45),reason:str(d.reason).slice(0,250),
            team_name:str(d.team_name).slice(0,140),fotmob_team_id:str(d.fotmob_team_id).slice(0,20),
            recovered_metrics:Math.max(0,Math.trunc(Number(d.recovered_metrics)||0)),
            candidates:Math.max(0,Math.trunc(Number(d.candidates)||0))
          })),
          network_requests:Math.min(100,Math.max(0,Math.trunc(Number(v.network_requests)||0))),
          successful_requests:Math.min(100,Math.max(0,Math.trunc(Number(v.successful_requests)||0))),
          coverage: v.coverage&&typeof v.coverage==="object"?{
            ...Object.fromEntries(["total","received","pending","unavailable","needs_review","rate_limited"]
                .map(k=>[k,Math.min(1000,Math.max(0,Math.trunc(Number(v.coverage[k])||0)))])),
            profile_stale:v.coverage.profile_stale===true,
            complete:v.coverage.complete===true,
          }:null};
      }
      let counts=0;
      for(let skip=0;skip<10000;skip+=100) {
        const page=rows(await db.ImportCandidate.filter({job_id:job.id},"id",100,skip));
        counts+=page.length;if(page.length<100)break;
      }
      await db.ImportJob.update(job.id,{status:counts?"review":"completed",phase:counts?"Datos recibidos; revisar candidatos":"Sin nuevos datos verificables",progress:100,
        source_results,received_candidates:counts,finished_at:new Date().toISOString(),claim_id:"",lease_expires_at:""});
      // Aplicar automáticamente solo candidatos compatibles con identidad,
      // club y competición contrastados. Los conflictos permanecen pendientes.
      let automatic=null;
      if(counts){
        try{
          const {applyVerifiedHistoricals}=await import("./reviewAuto.js");
          automatic=await applyVerifiedHistoricals(db,{...job,status:"review"});
          await db.ImportJob.update(job.id,{phase:"Automático: "+automatic.applied+" candidatos compatibles incorporados; "+automatic.pending+" pendientes de revisión"});
        }catch(e){console.error("Aplicación automática conservadora pendiente",e);}
      }
      // Avanzar entre temporadas pendientes sin volver a solicitar todo el
      // historial. Un bloque es de hasta ocho consultas; se detiene si FotMob
      // rechaza o limita el acceso, si no hay respuestas útiles o al llegar
      // al límite preventivo de doce bloques por solicitud.
      let next_job_id=null;
      const fotmobReport=report.fotmob||{};
      const outstanding=(fotmobReport.diagnostics||[]).filter(d=>["cache_absent","cache_mismatch","query_failed","candidate_limit"].includes(d.status));
      const stopped=(fotmobReport.diagnostics||[]).some(d=>["rate_limited","access_denied"].includes(d.status));
      const canContinue=(job.sources||[]).includes("fotmob")
        &&Number(job.retry_count||0)<11&&outstanding.length>0
        &&!stopped&&Number(fotmobReport.successful_requests||0)>0;
      if(canContinue) {
        try {
          const key="mfv3:continue:"+job.id;
          const duplicate=rows(await db.ImportJob.filter({job_key:key},undefined,1))[0];
          if(duplicate)next_job_id=duplicate.id;
          else {
            const next=await db.ImportJob.create({
              job_key:key,player_id:job.player_id,player_name:job.player_name,
              fotmob_player_id:job.fotmob_player_id,sources:["fotmob"],status:"queued",progress:0,
              requested_at:new Date(Date.now()+45_000).toISOString(),
              phase:"Cobertura FotMob · siguiente bloque de competiciones pendientes",
              source_results:{fotmob:{status:"pending"}},completed_sources:[],received_candidates:0,
              root_job_id:job.root_job_id||job.id,
              retry_scopes:{fotmob:outstanding.map(d=>({
                season:str(d.season),season_id:str(d.season_id),
                tournament_id:str(d.tournament_id),competition:str(d.competition)
              }))},
              retry_count:Number(job.retry_count||0)+1,retry_pending:true
            });
            next_job_id=next.id;
          }
        }catch(e){console.error("No se pudo encolar el siguiente bloque FotMob",e);}
      }
      return reply({ok:true,status:counts?"review":"completed",candidates:counts,
        automatic,next_job_id,coverage:source_results.fotmob?.coverage||null});
    }
    if(action==="fail") {
      await db.ImportJob.update(job.id,{status:"failed",phase:"Error de extracción",last_error:str(body.error).slice(0,350),finished_at:new Date().toISOString(),claim_id:"",lease_expires_at:""});
      return reply({ok:true,status:"failed"});
    }
    return fail("Acción desconocida.");
  } catch(e){console.error("import-worker",e);return fail(e?.message||"Error interno.",500);}
}
