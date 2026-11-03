// MF LEGACY — direct Understat reader with explicit preview and additive-only writes.
import {createClientFromRequest} from "npm:@base44/sdk";
import {LEAGUES,validateSelection,leaguePlayersFromJson,playerSeasonsFromJson,reconcilePlayer,norm} from "./core.mjs";
const txt = v => String(v ?? "").trim();
const rows = r => Array.isArray(r)?r:r?.items||r?.data||r?.entities||[];
const reply = (data,status=200) => Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
const cache=new Map();
async function understatJson(route){
  const item=cache.get(route);
  if(item && Date.now()-item.at<600000)return item.data;
  const res=await fetch("https://understat.com/"+route,{
    headers:{"Accept":"application/json","X-Requested-With":"XMLHttpRequest","User-Agent":"Mozilla/5.0"},
    signal:AbortSignal.timeout(15000)
  });
  if(!res.ok)throw Error("Understat ha respondido HTTP "+res.status+(res.status===403||res.status===429?" (acceso restringido)":""));
  const type=(res.headers.get("content-type")||"").toLowerCase();
  if(!type.includes("json"))throw Error("Understat no devuelve JSON. Es posible que haya bloqueado la consulta.");
  const length=Number(res.headers.get("content-length")||0);
  if(length>4500000)throw Error("La respuesta de Understat supera el tamaño permitido");
  const body=await res.text();
  if(!body||body.length>4500000)throw Error("La respuesta de Understat está vacía o es demasiado grande");
  let parsed;
  try{parsed=JSON.parse(body);}catch{throw Error("Understat ha devuelto JSON inválido");}
  cache.set(route,{at:Date.now(),data:parsed});
  if(cache.size>70){for(const [key,value] of cache)if(Date.now()-value.at>600000)cache.delete(key);}
  return parsed;
}
async function verifiedPlayer(db,playerId,fotmobId){
  if(!/^[a-f0-9]{24}$/i.test(playerId)||!/^\d{1,15}$/.test(fotmobId))throw Error("La identidad Base44/FotMob no es válida");
  const p=await db.Player.get(playerId);
  if(!p?.id)throw Error("No existe el jugador seleccionado");
  const links=rows(await db.PlayerFotmobLink.filter({player_id:playerId},undefined,30));
  const reverse=rows(await db.PlayerFotmobLink.filter({fotmob_player_id:fotmobId},undefined,30));
  const approved=new Set(["verified","confirmed","manual","manual_confirmada","confirmada","automatic_exact_name_unique","automatic_existing_stats_unique"]);
  if(links.length!==1||txt(links[0].fotmob_player_id)!==fotmobId||
     !approved.has(txt(links[0].verification).toLowerCase())||
     reverse.some(l=>txt(l.player_id)!==playerId))
     throw Error("Confirma una vinculación FotMob única antes de importar Understat");
  const seasons=rows(await db.PlayerSeasonStats.filter({player_id:playerId},undefined,350));
  if(seasons.length>=350)throw Error("Demasiadas temporadas en STATS para verificarlas de forma completa");
  if(seasons.some(s=>txt(s.fotmob_player_id)&&txt(s.fotmob_player_id)!==fotmobId))
    throw Error("El historial tiene IDs FotMob contradictorios");
  return {player:p,seasons};
}
async function getPreview(db,body,league,season){
  const playerId=txt(body.player_id),fotmobId=txt(body.fotmob_player_id);
  const {player,seasons}=await verifiedPlayer(db,playerId,fotmobId);
  if(!seasons.length)return {ok:true,status:"no_stats",reason:"No hay historial FotMob del jugador en STATS"};
  const players=leaguePlayersFromJson(await understatJson("getLeagueData/"+league+"/"+season));
  const matches=players.filter(p=>norm(p.name)===norm(player.name));
  if(matches.length!==1)return {ok:true,status:matches.length?"ambiguous_identity":"no_player",
    reason:matches.length?"El nombre corresponde a varios IDs Understat":"Este jugador no figura en la liga y temporada elegidas"};
  const id=matches[0].understat_id;
  const detail=playerSeasonsFromJson(await understatJson("getPlayerData/"+id));
  const result=reconcilePlayer({league,season,playerName:player.name,leaguePlayers:players,
    providerSeasons:detail,fotmobSeasons:seasons});
  if(result.status!=="verified")return {ok:true,...result};
  const existing=rows(await db.UnderstatSeasonRate.filter({player_id:playerId},undefined,250));
  if(existing.length>=250)throw Error("Demasiadas tasas guardadas para conciliar");
  const plan=result.rates.map(r=>{
    const found=existing.filter(x=>x.season===r.season);
    if(found.length>1||(found.length===1&&txt(found[0].team_key)!=="season-global"))
      return {...r,action:"review",reason:"Existen registros de club o duplicados"};
    const old=found[0];
    const fields=["xg_chain_p90","xg_buildup_p90","xg_total","xa_total"]
      .filter(f=>r[f]!==null && (!old||old[f]===null||old[f]===undefined||old[f]===""));
    return {...r,action:fields.length?(old?"complete":"create"):"unchanged",fields};
  });
  return {ok:true,...result,league,season,player_id:playerId,
    plan,can_apply:plan.some(x=>["create","complete"].includes(x.action))};
}
export default async function(req){
  if(req.method!=="POST")return reply({ok:false,error:"Solo se admite POST"},405);
  try{
    const sdk=createClientFromRequest(req);
    let user;
    try{user=await sdk.auth.me();}catch{return reply({ok:false,error:"Inicia sesión"},401);}
    if(!user)return reply({ok:false,error:"Inicia sesión"},401);
    if(user.role!=="admin")return reply({ok:false,error:"Solo administradores"},403);
    const body=await req.json();
    if(!["preview-league","preview-player","apply-player"].includes(body?.action))
      return reply({ok:false,error:"Operación desconocida"},400);
    const league=txt(body.league),season=validateSelection(league,body.season);
    if(body.action==="preview-league"){
      const data=leaguePlayersFromJson(await understatJson("getLeagueData/"+league+"/"+season));
      return reply({ok:true,status:"online",league,league_name:LEAGUES[league],
        season:season+"/"+(Number(season)+1),player_count:data.length,
        preview:data.slice(0,15),source:"Understat · consulta directa",
        saved:0});
    }
    const db=sdk.asServiceRole.entities;
    const result=await getPreview(db,body,league,season);
    if(body.action==="preview-player")return reply(result);
    if(!body.confirm_apply)return reply({ok:false,error:"Confirma la aplicación tras revisar la vista previa"},400);
    if(!result.ok||result.status!=="verified")return reply({...result,saved:0,updated:0});
    const playerId=txt(body.player_id),pid=txt(body.fotmob_player_id);
    let saved=0,updated=0,unchanged=0;
    const skipped=[...result.skipped];
    for(const rate of result.plan){
      if(rate.action==="review"){skipped.push({season:rate.season,reason:rate.reason});continue;}
      if(rate.action==="unchanged"){unchanged++;continue;}
      if(!["create","complete"].includes(rate.action))continue;
      const existing=rows(await db.UnderstatSeasonRate.filter({player_id:playerId,season:rate.season},undefined,10));
      if(existing.length>1||(existing.length===1&&txt(existing[0].team_key)!=="season-global")){
        skipped.push({season:rate.season,reason:"Se detectó un registro concurrente o ambiguo"});continue;
      }
      const fields=["xg_chain_p90","xg_buildup_p90","xg_total","xa_total"];
      const patch={};
      for(const key of fields){
        if(rate[key]!==null&&(!existing.length||existing[0][key]===null||existing[0][key]===undefined||existing[0][key]===""))patch[key]=rate[key];
      }
      if(!Object.keys(patch).length){unchanged++;continue;}
      if(existing.length){await db.UnderstatSeasonRate.update(existing[0].id,patch);updated++;}
      else{
        await db.UnderstatSeasonRate.create({
          player_id:playerId,fotmob_player_id:pid,season:rate.season,
          team:"Temporada",team_key:"season-global",source:"Understat · consulta directa",
          source_scope:"Ligas cubiertas por Understat; no incluye copas ni Europa",
          understat_player_id:result.understat_id,source_url:result.source_url,
          provider_minutes:rate.minutes,...patch
        });saved++;
      }
    }
    return reply({ok:true,status:"applied",player:result.name,understat_player_id:result.understat_id,
      saved,updated,unchanged,skipped,source_url:result.source_url});
  }catch(e){
    const message=String(e?.message||e);
    const timeout=message.includes("timeout")||message.includes("timed out")||message.includes("AbortError");
    console.error("understat-live",message.slice(0,220));
    return reply({ok:false,status:timeout?"timeout":"error",
      error:timeout?"Understat no responde en 15 segundos. No se ha modificado ningún dato.":message.slice(0,230)},502);
  }
}
