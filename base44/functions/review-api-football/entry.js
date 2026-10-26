import {createClientFromRequest} from "npm:@base44/sdk";
const str=x=>String(x??"").trim(),rows=x=>Array.isArray(x)?x:x?.items||x?.data||x?.entities||[];
const norm=x=>str(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const bad=(error,status=400)=>Response.json({ok:false,error},{status});
const ok=x=>Response.json({ok:true,...x});
export default async function(req){
 if(req.method!=="POST")return bad("Solo POST",405);
 try{
  const api=createClientFromRequest(req),user=await api.auth.me();
  if(!user||user.role!=="admin")return bad("Solo administradores",403);
  const body=await req.json(),id=str(body.id),action=str(body.action);
  if(!/^[a-f0-9]{24}$/i.test(id))return bad("Candidato inexistente");
  const db=api.asServiceRole.entities,c=await db.ProviderSeasonCandidate.get(id);
  if(!c)return bad("Observación no encontrada",404);
  if(c.status==="applied"||c.status==="rejected")return ok({status:c.status,unchanged:true});
  if(c.status!=="pending")return bad("Observación con conflicto; no se aplica automáticamente.",409);
  if(action==="reject"){
   await db.ProviderSeasonCandidate.update(id,{status:"rejected",review_note:"Descartado por administrador"});
   return ok({status:"rejected"});
  }
  if(action!=="approve")return bad("Acción desconocida",400);
  const player=await db.Player.get(c.player_id);
  if(!player)return bad("Jugador no encontrado",409);
  const ext=rows(await db.PlayerExternalIdentity.filter({player_id:c.player_id,provider:"api_sports"},undefined,30));
  if(ext.length!==1||str(ext[0].provider_player_id)!==str(c.provider_player_id))
   return bad("Vinculación de proveedor sin verificar",409);
  if(!c.season||!c.competition||!c.provider_team_id||!c.provider_league_id||
     !Array.isArray(c.metrics)||!(c.appearances>0||c.minutes>0))
   return bad("Temporada incompleta",409);
  const external="api_sports:"+c.provider_player_id+":"+c.provider_season+":"+c.provider_league_id+":"+c.provider_team_id;
  const prev=rows(await db.PlayerSeasonStats.filter({player_id:c.player_id},undefined,300));
  const exact=prev.find(s=>s.external_record_id===external);
  if(exact) {
   await db.ProviderSeasonCandidate.update(c.id,{status:"applied",review_note:"Ya existía exactamente este registro; no modificado"});
   return ok({status:"applied",unchanged:true,season_id:exact.id});
  }
  // Provider identities are different from FotMob IDs. Check for potential clashes
  // before writing, without guessing equivalences of competitions or teams.
  const collisions=prev.filter(s=>s.season===c.season && norm(s.competition)===norm(c.competition)
    && norm(s.team_name)===norm(c.team_name));
  if(collisions.length)return bad("Esta competición y club ya existen en STATS con otra fuente. Revisar manualmente para evitar duplicados.",409);
  const teamMatches=rows(await db.Team.filter({name:c.team_name},undefined,20))
   .filter(t=>norm(t.name)===norm(c.team_name));
  if(teamMatches.length>1)return bad("Existen varios clubes con ese nombre; no es seguro vincularlo.",409);
  const team=teamMatches.length===1?teamMatches[0]:null;
  const links=rows(await db.PlayerFotmobLink.filter({player_id:c.player_id},undefined,20));
  const pids=[...new Set(links.map(l=>str(l.fotmob_player_id)).filter(Boolean))];
  const fotmob_pid=pids.length===1?pids[0]:"";
  const created=await db.PlayerSeasonStats.create({
   external_record_id:external,player_id:c.player_id,player_name:player.name,
   ...(fotmob_pid?{fotmob_player_id:fotmob_pid}:{}),
   ...(team?{team_id:team.id,fotmob_team_id:str(team.fotmob_id)}:{}),
   team_name:c.team_name,season:c.season,competition:c.competition,
   appearances:c.appearances??null,minutes:c.minutes??null,
   rating:null,metrics:c.metrics.map(m=>({...m,source:"API-Sports",verification_status:"provider_record"})),
   source:"API-Sports",verification_status:"provider_record",review_status:"approved",
   import_batch:c.job_id
  });
  await db.ProviderSeasonCandidate.update(c.id,{status:"applied",
   review_note:team?"Aprobado por administrador y vinculado a club existente":"Aprobado sin vincular el equipo por ID; requiere conciliación del club"});
  return ok({status:"applied",season_id:created.id,team_linked:!!team});
 }catch(e){console.error("review-api-football",e);return bad(e.message||"Error al aplicar estadísticas",500);}
}
