import { createClientFromRequest } from "npm:@base44/sdk";

const allowed = new Set(["fotmob", "understat", "fifa", "market"]);
const rows = x => Array.isArray(x) ? x : x?.items || x?.entities || x?.data || [];
const str = x => String(x ?? "").trim();
const bad = (error, status = 400) => Response.json({ok:false,error},{status});
const norm = s => str(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const league = s => {
  const v = norm(s);
  return ({
    "epl":"premier league","english premier league":"premier league",
    "la liga":"laliga","laliga ea sports":"laliga","laliga":"laliga",
    "bundesliga":"bundesliga","1 bundesliga":"bundesliga",
    "serie a":"serie a","ligue 1":"ligue 1",
  })[v] || v;
};
const numeric = x => typeof x==="number" && Number.isFinite(x) && x>=0;
async function sha(x) {
  const d = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(x));
  return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function stage(row,existing,source,player,jobId) {
  const result=[];
  const ms = Array.isArray(row.metrics) ? row.metrics : [];
  for (const metric of ms) {
    const name=str(metric.name);
    if(!name || name.length>100 || /^(percentile|rank)$/i.test(name))continue;
    const old = (existing.metrics||[]).find(m=>norm(m.name)===norm(name));
    for (const [field,unit] of [["value","total"],["per90","per90"]]) {
      const value=metric[field];
      if(!numeric(value) || old && old[field]!==undefined && old[field]!==null) continue;
      // Percentage values must remain percentages.
      const metric_unit=field==="value" && /%|percentage/i.test(name) ? "percentage" : unit;
      if(metric_unit==="percentage" && value>100)continue;
      const origin=str(row.source_record_id || row.record_key);
      result.push({
        source,kind:"metric",season:row.season,competition:existing.competition,
        fotmob_team_id:str(existing.fotmob_team_id),team_name:existing.team_name,
        metric_name:name,metric_unit,value,
        source_record_id:origin+":"+norm(name)+":"+unit,
        evidence_url:source==="fotmob"?"https://www.fotmob.com/players/"+player.fotmob_id:"",
        verification_status:"unverified",review_status:"pending",
        player_id:player.id,fotmob_player_id:player.fotmob_id,job_id:jobId,
        received_at:new Date().toISOString(),
      });
    }
  }
  return result;
}
export default async function(req) {
  if(req.method!=="POST")return bad("Solo POST",405);
  try {
    const api=createClientFromRequest(req);
    const user=await api.auth.me();
    if(!user || user.role!=="admin")return bad("Solo administradores",403);
    const body=await req.json();
    const id=str(body.player_id);
    if(!/^[a-f0-9]{24}$/i.test(id))return bad("Selecciona un jugador existente");
    const sources=[...new Set(Array.isArray(body.sources)?body.sources:[])];
    if(!sources.length||sources.some(s=>!allowed.has(s)))return bad("Fuentes incorrectas");
    const db=api.asServiceRole.entities;
    const player=await db.Player.get(id);
    if(!player)return bad("No existe el jugador",404);
    const links=rows(await db.PlayerFotmobLink.filter({player_id:id},undefined,40));
    const ids=[...new Set(links.map(r=>str(r.fotmob_player_id)).filter(x=>/^\d+$/.test(x)))];
    if(ids.length!==1||links.some(l=>str(l.fotmob_player_id)!==ids[0]))return bad("ID FotMob ausente o ambiguo",409);
    const backlinks=rows(await db.PlayerFotmobLink.filter({fotmob_player_id:ids[0]},undefined,40));
    if(backlinks.some(l=>str(l.player_id)!==id))return bad("ID FotMob asociado a más de un jugador",409);
    const eligible=new Set(["automatic_exact_name_unique","verified","confirmed","manual"]);
    if(!links.some(l=>eligible.has(str(l.verification).toLowerCase())))return bad("Vinculación sin confirmar",409);
    const pid=ids[0];
    const stats=rows(await db.PlayerSeasonStats.filter({player_id:id},undefined,200));
    const sourcesRows=rows(await db.PlayerProviderRecord.filter({fotmob_player_id:pid},undefined,200));
    const permittedKinds={"fotmob_season":"fotmob","understat_summary":"understat"};
    const selected=sourcesRows.filter(r=>permittedKinds[r.record_kind]&&sources.includes(permittedKinds[r.record_kind]));
    // Idempotence: key excludes job, so re-running a cache scan doesn't duplicate candidates.
    const all=[];
    const summary=Object.fromEntries(sources.map(s=>[s,{status:"unavailable",note:"Sin datos reutilizables o fuente no conectada"}]));
    const now=new Date().toISOString();
    const job=await db.ImportJob.create({
      job_key:"mfv3:cache:"+id+":"+crypto.randomUUID(),player_id:id,player_name:player.name,
      fotmob_player_id:pid,sources,status:"running",phase:"Revisando fuentes ya almacenadas",progress:20,
      requested_at:now,started_at:now,source_results:summary,
      worker_version:"base44-cache-v1",completed_sources:[],received_candidates:0
    });
    let skipped=0;
    try {
      for(const r of selected) {
        const same=stats.filter(s=>s.season===r.season
          && league(s.competition)===league(r.competition)
          && str(s.fotmob_team_id)
          && (str(r.fotmob_team_id)?str(r.fotmob_team_id)===str(s.fotmob_team_id)
                                 :norm(s.team_name)===norm(r.team_name)));
        if(same.length!==1){skipped++;continue;}
        const source=permittedKinds[r.record_kind];
        const proposed=stage(r,same[0],source,{id,fotmob_id:pid},job.id);
        all.push(...proposed);
        summary[source]={status:"complete",note:"Fuente almacenada revisada. Métricas faltantes: "+all.filter(p=>p.source===source).length};
      }
      let created=0,existingCount=0;
      const uniques=new Map();
      for(const r of all) {
        const hash=await sha([id,r.source,r.season,r.competition,r.fotmob_team_id,
            r.metric_name,r.metric_unit,r.source_record_id].join("|"));
        const key="mfv3:cache:"+hash;
        if(!uniques.has(key))uniques.set(key,{...r,candidate_key:key});
      }
      // Limit work per request, so Base44 isn't flooded with large historical datasets.
      const proposals=[...uniques.values()].slice(0,60);
      const keys=proposals.map(x=>x.candidate_key);
      let known=new Set();
      for(let i=0;i<keys.length;i+=20) {
        const prior=rows(await db.ImportCandidate.filter({candidate_key:{$in:keys.slice(i,i+20)}},undefined,50));
        prior.forEach(r=>known.add(r.candidate_key));
      }
      const fresh=proposals.filter(r=>!known.has(r.candidate_key));
      existingCount=proposals.length-fresh.length;
      for(let i=0;i<fresh.length;i+=10) {
        // Only staging: no mutations to existing STATS or historic valuations.
        await db.ImportCandidate.bulkCreate(fresh.slice(i,i+10));
        created+=Math.min(10,fresh.length-i);
      }
      await db.ImportJob.update(job.id,{
        status:created?"review":"completed",progress:100,finished_at:new Date().toISOString(),
        phase:created?"Candidatos de caché listos para revisión":"No hay nuevas métricas para aplicar",
        source_results:summary,received_candidates:created,
        last_error:skipped?skipped+" registros no conciliados (equipo/temporada/competición)":""});
      return Response.json({ok:true,job_id:job.id,created,already_staged:existingCount,
        unmatched:skipped,remaining_possible:Math.max(0,uniques.size-60),source_results:summary});
    } catch(error) {
      await db.ImportJob.update(job.id,{status:"failed",last_error:str(error.message).slice(0,250),
        phase:"Fallo al revisar las fuentes almacenadas",finished_at:new Date().toISOString()});
      throw error;
    }
  } catch(error) {
    console.error("import-cache",error);
    return bad(error?.message||"Error interno",500);
  }
}