import {createClientFromRequest} from "npm:@base44/sdk";
import {checkOverwrite} from "../import-native/core.js";
const str=x=>String(x??"").trim();
const rows=x=>Array.isArray(x)?x:x?.items||x?.data||x?.entities||[];
const respond=(v,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"no-store"}});
const fail=(error,status=400)=>respond({ok:false,error},status);
const norm=x=>str(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const comp=x=>({"epl":"premier league","english premier league":"premier league","la liga":"laliga","laliga ea sports":"laliga","ligue 1 uber eats":"ligue 1"}[norm(x)]||norm(x));
async function conclude(db,jobId){
 const pending=rows(await db.NativeSeasonCandidate.filter({job_id:jobId,status:"pending"},undefined,1));
 const conflict=rows(await db.NativeSeasonCandidate.filter({job_id:jobId,status:"conflict"},undefined,1));
 if(!pending.length&&!conflict.length)await db.ImportJob.update(jobId,
  {status:"completed",phase:"Temporadas revisadas y aplicadas cuando procedía",progress:100});
}
export default async function(req){
 if(req.method!=="POST")return fail("Solo POST",405);
 try{
  const client=createClientFromRequest(req),user=await client.auth.me();
  if(!user||user.role!=="admin")return fail("Solo administradores",403);
  const input=await req.json(),action=str(input.action),id=str(input.candidate_id);
  if(!/^[a-f0-9]{24}$/i.test(id))return fail("Candidato incorrecto");
  if(!["approve","reject"].includes(action))return fail("Acción desconocida");
  const db=client.asServiceRole.entities,item=await db.NativeSeasonCandidate.get(id);
  if(!item)return fail("Candidato no encontrado",404);
  const job=await db.ImportJob.get(item.job_id);
  if(!job||job.player_id!==item.player_id||job.fotmob_player_id!==item.fotmob_player_id
   ||job.worker_version!=="base44-web-native-v1")return fail("Identidad del trabajo no coincide",409);
  if(item.status==="applied"||item.status==="rejected")return respond({ok:true,status:item.status,unchanged:true});
  if(item.status!=="pending"||job.status!=="review")return fail("Candidato bloqueado o en conflicto",409);
  if(action==="reject"){
   await db.NativeSeasonCandidate.update(id,{status:"rejected",review_note:"Rechazado por administrador"});
   await conclude(db,job.id);
   return respond({ok:true,status:"rejected"});
  }
  if(!str(item.fotmob_team_id)||!/^\d{1,15}$/.test(str(item.fotmob_team_id)))
   return fail("Falta un ID del club verificado; no se puede crear la temporada",409);
  const player=await db.Player.get(item.player_id);
  if(!player)return fail("Jugador inexistente",409);
  const links=rows(await db.PlayerFotmobLink.filter({player_id:item.player_id},undefined,30));
  if(!links.length||!links.every(l=>str(l.fotmob_player_id)===item.fotmob_player_id))
   return fail("ID FotMob desvinculado o contradictorio",409);
  const metricRows=Array.isArray(item.metrics)?item.metrics:[];
  if(!metricRows.length&&item.appearances==null&&item.minutes==null)
   return fail("La temporada no contiene datos",409);
  const existing=rows(await db.PlayerSeasonStats.filter({player_id:item.player_id,season:item.season},undefined,150));
  const clash=existing.filter(r=>{
   const sameComp=comp(r.competition)===comp(item.competition);
   const byTeamID=str(r.fotmob_team_id)&&str(r.fotmob_team_id)===str(item.fotmob_team_id);
   const byName=norm(r.team_name)&&norm(r.team_name)===norm(item.team_name);
   return sameComp&&(byTeamID||byName);
  });
  const baseKey=[item.player_id,item.provider,item.season,item.fotmob_team_id,item.competition,item.source_record_id].join("|");
  const key="native:"+item.candidate_key.replace(/^mfv3:native:/,"");
  if(clash.length){
   // Never overwrite the existing STATS competition, regardless of source.
   if(clash.length===1&&clash[0].external_record_id===key){
    await db.NativeSeasonCandidate.update(id,{status:"applied",review_note:"Este registro ya existía; no se modificó"});
    await conclude(db,job.id);
    return respond({ok:true,status:"applied",unchanged:true});
   }
   return fail("La misma competición y club ya existen en STATS. Revisar discrepancias antes de fusionar.",409);
  }
  const teams=rows(await db.Team.filter({fotmob_id:str(item.fotmob_team_id)},undefined,30))
    .filter(t=>str(t.fotmob_id)===str(item.fotmob_team_id));
  if(teams.length>1)return fail("ID FotMob de equipo duplicado en Base44",409);
  const team=teams[0];
  if(team&&norm(team.name)!==norm(item.team_name))return fail("El equipo de Base44 y la fuente discrepan de nombre: revisar identidad",409);
  const safeMetrics=metricRows.filter(m=>str(m.name)&&
    [m.value,m.per90].some(x=>typeof x==="number"&&Number.isFinite(x)&&x>=0))
    .map(m=>({name:str(m.name),...(typeof m.value==="number"&&Number.isFinite(m.value)?{value:m.value}:{}),
      ...(typeof m.per90==="number"&&Number.isFinite(m.per90)?{per90:m.per90}:{}),
      ...(typeof m.percentile==="number"&&Number.isFinite(m.percentile)?{percentile:m.percentile}:{}),
      source:item.provider,verification_status:"manually_reviewed"}));
  const create={
   external_record_id:key,player_id:item.player_id,fotmob_player_id:item.fotmob_player_id,
   player_name:player.name,team_name:item.team_name,fotmob_team_id:item.fotmob_team_id,
   ...(team?{team_id:team.id}:{}),season:item.season,competition:item.competition,
   ...(item.appearances!=null?{appearances:item.appearances}:{}),
   ...(item.minutes!=null?{minutes:item.minutes}:{}),
   ...(item.rating!=null?{rating:item.rating}:{}),
   metrics:safeMetrics,source:item.provider,verification_status:"manually_reviewed",
   review_status:"approved",import_batch:job.id
  };
  const newRow=await db.PlayerSeasonStats.create(create);
  await db.NativeSeasonCandidate.update(id,{status:"applied",
    review_note:"Temporada nueva aprobada; datos originales de otras competiciones conservados"});
  await conclude(db,job.id);
  return respond({ok:true,status:"applied",season_id:newRow.id,team_linked:!!team});
 }catch(e){console.error("review-native",e);return fail(e.message||"No se pudo revisar la temporada",500);}
}
