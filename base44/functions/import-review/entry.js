import {createClientFromRequest} from "npm:@base44/sdk";
const str=x=>String(x??"").trim();
const rows=x=>Array.isArray(x)?x:x?.items||x?.data||x?.entities||[];
const reply=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const bad=(error,status=400)=>reply({ok:false,error},status);
const norm=x=>str(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const metricId=x=>{
  const key=norm(x);
  return ["total clearances","clearances","despejes"].includes(key)?"clearances":key;
};
const empty=x=>x===undefined||x===null||x==="";
function withinSeason(season,date) {
  if(!/^\d{4}(-\d{2}-\d{2})$/.test(date))return false;
  const match=/^(\d{4})(?:\/(\d{4}))?$/.exec(season);
  if(!match)return false;
  const start=match[2]?match[1]+"-07-01":match[1]+"-01-01";
  const end=match[2]?match[2]+"-06-30":match[1]+"-12-31";
  return date>=start&&date<=end;
}
async function conclude(db,job) {
  const pending=rows(await db.ImportCandidate.filter({job_id:job.id,review_status:"pending"},undefined,1));
  if(!pending.length)await db.ImportJob.update(job.id,{status:"completed",phase:"Candidatos revisados",progress:100});
}
export default async function(req) {
  if(req.method!=="POST")return bad("Solo POST.",405);
  try {
    const sdk=createClientFromRequest(req);
    const user=await sdk.auth.me();
    if(!user || user.role!=="admin")return bad("Solo administradores.",403);
    const data=await req.json();
    const action=str(data.action),candidateId=str(data.candidate_id);
    if(!/^[a-f0-9]{24}$/i.test(candidateId))return bad("ID de candidato no válido.");
    const db=sdk.asServiceRole.entities;
    const item=await db.ImportCandidate.get(candidateId);
    if(!item)return bad("Candidato no encontrado.",404);
    const job=await db.ImportJob.get(item.job_id);
    if(!job||job.player_id!==item.player_id||job.fotmob_player_id!==item.fotmob_player_id)return bad("Identidad del candidato incompatible.",409);
    if(item.review_status==="applied"||item.review_status==="rejected")return reply({ok:true,status:item.review_status,unchanged:true});
    if(item.review_status!=="pending"||job.status!=="review")return bad("Este candidato no está disponible para revisión.",409);
    if(action==="reject") {
      await db.ImportCandidate.update(item.id,{review_status:"rejected",review_note:str(data.note).slice(0,250)||"Descartado por administrador"});
      await conclude(db,job);
      return reply({ok:true,status:"rejected"});
    }
    if(action!=="approve")return bad("Acción desconocida.");
    if(item.verification_status!=="verified"||!str(item.evidence_url).startsWith("https://"))return bad("No se pueden aplicar valores sin evidencia verificada.",409);
    const player=await db.Player.get(item.player_id);
    if(!player)return bad("El jugador ya no existe.",409);
    if(item.kind==="metric") {
      if(!str(item.fotmob_team_id)||!str(item.competition))return bad("Faltan identificadores de competición/equipo.",409);
      const matches=rows(await db.PlayerSeasonStats.filter({player_id:item.player_id,season:item.season,competition:item.competition},undefined,30))
        .filter(r=>str(r.fotmob_team_id)===str(item.fotmob_team_id));
      if(matches.length!==1)return bad("No existe una única competición y club vinculados en STATS; revisar manualmente.",409);
      const target=matches[0],metrics=Array.isArray(target.metrics)?[...target.metrics]:[];
      const idx=metrics.findIndex(m=>metricId(m.name)===metricId(item.metric_name));
      const key=item.metric_unit==="per90"?"per90":"value";
      if(idx>=0) {
        const old=metrics[idx];
        if(!empty(old[key])) {
          if(Number(old[key])!==item.value)return bad("Existe un valor distinto. No se sobrescribe.",409);
        } else {
          metrics[idx]={...old,[key]:item.value,source:item.source,verification_status:"verified"};
          await db.PlayerSeasonStats.update(target.id,{metrics});
        }
      } else {
        metrics.push({name:item.metric_name,[key]:item.value,source:item.source,verification_status:"verified"});
        await db.PlayerSeasonStats.update(target.id,{metrics});
      }
    } else if(item.kind==="overall"||item.kind==="market_value") {
      if(item.kind==="market_value"&&!withinSeason(item.season,str(item.as_of_date)))return bad("La fecha no corresponde a la temporada; revisión manual requerida.",409);
      const existing=rows(await db.PlayerHistoricalValuation.filter({player_id:item.player_id,season:item.season},undefined,10));
      if(existing.length>1)return bad("Hay varias valoraciones para la misma temporada.",409);
      const isOverall=item.kind==="overall";
      const field=isOverall?"fifa_fc_overall":"transfermarkt_value_eur";
      const old=existing[0]||null;
      if(old&&!empty(old[field])&&Number(old[field])!==item.value)return bad("Ya existe una valoración diferente; no se sobrescribe.",409);
      if(isOverall&&old&&old.fifa_edition&&old.fifa_edition!==item.fifa_edition)return bad("La edición FIFA/FC no coincide.",409);
      const patch=isOverall?{fifa_fc_overall:item.value,fifa_edition:item.fifa_edition,fifa_source_url:item.evidence_url,
        ...(item.fifa_fc_position&&!old?.fifa_fc_position?{fifa_fc_position:item.fifa_fc_position}:{})}
        :{transfermarkt_value_eur:item.value,market_value_as_of:item.as_of_date,transfermarkt_source_url:item.evidence_url};
      if(!old)await db.PlayerHistoricalValuation.create({player_id:item.player_id,fotmob_player_id:item.fotmob_player_id,season:item.season,
        verification_status:"verified",...patch});
      else if(empty(old[field]))await db.PlayerHistoricalValuation.update(old.id,patch);
    } else return bad("Tipo no admitido.",409);
    await db.ImportCandidate.update(item.id,{review_status:"applied",review_note:"Aprobado por administrador, sin sustituir valores existentes"});
    await conclude(db,job);
    return reply({ok:true,status:"applied"});
  } catch(e){console.error("import-review",e);return bad(e?.message||"Error interno.",500);}
}
