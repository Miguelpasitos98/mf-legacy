import {createClientFromRequest} from "npm:@base44/sdk";
const str=x=>String(x??"").trim(), arr=x=>Array.isArray(x)?x:x?.response||[];
const ok=(x,status=200)=>Response.json(x,{status,headers:{"Cache-Control":"no-store"}});
const bad=(error,status=400)=>ok({ok:false,error},status);
const norm=s=>str(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const validId=x=>/^\d{1,12}$/.test(str(x));
const ignored=new Set(["de","del","da","do","dos","das","van","von","jr","junior"]);
const tokens=x=>new Set(norm(x).split(" ").filter(t=>t.length>=3&&!ignored.has(t)));
const num=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0?x:null;
const integer=x=>typeof x==="number"&&Number.isInteger(x)&&x>=0?x:null;
async function provider(path,params,key){
 const url=new URL("https://v3.football.api-sports.io"+path);
 Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,str(v)));
 const res=await fetch(url,{headers:{"x-apisports-key":key,accept:"application/json"},signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw Error("API-Football HTTP "+res.status);
 const data=await res.json();
 if(data.errors&&(Array.isArray(data.errors)?data.errors.length:Object.keys(data.errors).length))
   throw Error("API-Football: problema con clave, cuota o parámetros "+JSON.stringify(data.errors).slice(0,130));
 return data;
}
function season(year,league) {
 const country=norm(league.country),name=norm(league.name);
 const calendar=["usa","united states","brazil","argentina","mexico","japan","sweden","norway","finland","denmark","australia"];
 const european=["england","spain","italy","france","germany","netherlands","portugal","belgium","scotland","austria","switzerland","turkey","europe"];
 const cup=["champions league","europa league","conference league"];
 const cross=european.includes(country)||cup.some(x=>name.includes(x));
 return !calendar.includes(country)&&cross&&!name.includes("world cup")&&!name.includes("copa america")
   ?year+"/"+(year+1):String(year);
}
async function digest(s){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,"0")).join("");}
function extract(stat){
 const result=[],minutes=integer(stat?.games?.minutes);
 const add=(name,val,rate=true)=>{
  const v=num(val);if(v===null)return;
  result.push({name,value:v,per90:rate&&minutes>0?v*90/minutes:null,
    percentile:null,source:"API-Sports",verification_status:"provider_record"});
 };
 add("Goals",stat?.goals?.total);
 add("Assists",stat?.goals?.assists);
 add("Shots",stat?.shots?.total);
 add("Shots on target",stat?.shots?.on);
 add("Key passes",stat?.passes?.key);
 add("Total passes",stat?.passes?.total);
 add("Tackles",stat?.tackles?.total);
 add("Interceptions",stat?.tackles?.interceptions);
 add("Shots blocked",stat?.tackles?.blocks);
 add("Duels",stat?.duels?.total);
 add("Duels won",stat?.duels?.won);
 add("Dribbles attempted",stat?.dribbles?.attempts);
 add("Successful dribbles",stat?.dribbles?.success);
 add("Fouls drawn",stat?.fouls?.drawn);
 add("Fouls committed",stat?.fouls?.committed);
 add("Yellow cards",stat?.cards?.yellow);
 add("Red cards",stat?.cards?.red);
 add("Penalty goals",stat?.penalty?.scored);
 add("Penalties missed",stat?.penalty?.missed);
 add("Saves",stat?.goals?.saves);
 add("Goals conceded",stat?.goals?.conceded);
 add("Minutes",minutes,false);
 add("Appearances",integer(stat?.games?.appearences??stat?.games?.appearances),false);
 return result;
}
export default async function(req){
 if(req.method!=="POST")return bad("Solo POST",405);
 try{
  const client=createClientFromRequest(req),user=await client.auth.me();
  if(!user||user.role!=="admin")return bad("Solo administradores",403);
  const body=await req.json(),action=str(body.action),key=str(Deno.env.get("MF_V3_APISPORTS_KEY"));
  if(action==="health")return ok({ok:true,configured:key.length>=16,provider:"API-Football"});
  if(key.length<16)return bad("Falta MF_V3_APISPORTS_KEY en secretos de Base44",503);
  if(action==="search"){
   const term=str(body.query);
   if(term.length<4||term.length>60)return bad("Introduce 4-60 caracteres");
   const data=await provider("/players/profiles",{search:term},key);
   return ok({ok:true,profiles:arr(data).slice(0,30).map(x=>x.player||x).filter(x=>validId(x?.id))
    .map(x=>({id:x.id,name:x.name,firstname:x.firstname,lastname:x.lastname,nationality:x.nationality,birth_date:x.birth?.date||""}))});
  }
  if(action==="seasons"){
   if(!validId(body.provider_player_id))return bad("ID externo inválido");
   const data=await provider("/players/seasons",{player:body.provider_player_id},key);
   return ok({ok:true,seasons:arr(data).filter(x=>Number.isInteger(x)&&x>=2000&&x<=2035).sort((a,b)=>b-a)});
  }
  if(action!=="import")return bad("Acción desconocida");
  const playerId=str(body.player_id),pid=str(body.provider_player_id),year=Number(body.season);
  if(!/^[a-f0-9]{24}$/i.test(playerId)||!validId(pid)||!Number.isInteger(year)||year<2000||year>2035)
   return bad("Jugador, ID o temporada incorrectos");
  if(body.identity_confirmed!==true)return bad("Confirma la identidad antes de importar",409);
  const db=client.asServiceRole.entities,player=await db.Player.get(playerId);
  if(!player)return bad("Jugador no encontrado",404);
  const own=arr(await db.PlayerExternalIdentity.filter({player_id:playerId,provider:"api_sports"},undefined,30));
  const others=arr(await db.PlayerExternalIdentity.filter({provider:"api_sports",provider_player_id:pid},undefined,30));
  if(own.some(x=>str(x.provider_player_id)!==pid)||others.some(x=>x.player_id!==playerId))return bad("Conflicto de identidad de API-Sports",409);
  const profiles=arr(await provider("/players/profiles",{player:pid},key)).map(x=>x.player||x);
  const external=profiles.find(x=>str(x?.id)===pid);
  if(!external)return bad("El proveedor no reconoce el ID",409);
  const nameFound=new Set([...tokens(external.name),...tokens(external.firstname),...tokens(external.lastname)]);
  const overlap=[...tokens(player.name)].filter(n=>nameFound.has(n)).length;
  const birth=str(player.date_of_birth),externalBirth=str(external.birth?.date);
  if(birth&&externalBirth&&birth!==externalBirth)return bad("Fecha de nacimiento incompatible",409);
  if(overlap<2&&!(birth&&externalBirth&&birth===externalBirth))return bad("Nombre del proveedor no coincide inequívocamente",409);
  const data=await provider("/players",{id:pid,season:year},key);
  const stats=arr(data).filter(x=>str(x?.player?.id)===pid)
    .flatMap(x=>Array.isArray(x.statistics)?x.statistics:[]);
  if(!stats.length)return ok({ok:true,status:"unavailable",created:0,reason:"La fuente no ofrece estadísticas para esa temporada"});
  const staged=[];
  for(const s of stats){
   const leagueId=str(s?.league?.id),teamId=str(s?.team?.id);
   if(!validId(leagueId)||!validId(teamId)||!str(s?.league?.name)||!str(s?.team?.name))continue;
   const appearances=integer(s.games?.appearences??s.games?.appearances),minutes=integer(s.games?.minutes);
   if(!(appearances>0)&&!(minutes>0))continue;
   staged.push({candidate_key:"api_sports:"+playerId+":"+pid+":"+year+":"+leagueId+":"+teamId,
    player_id:playerId,player_name:player.name,source:"api_sports",provider_player_id:pid,
    provider_season:year,season:season(year,s.league),competition:str(s.league.name),
    provider_league_id:leagueId,provider_team_id:teamId,team_name:str(s.team.name),country:str(s.league.country),
    appearances,minutes,rating:num(Number.parseFloat(s.games?.rating)),metrics:extract(s),
    status:"pending",source_url:"https://www.api-football.com/documentation_v3",
    retrieved_at:new Date().toISOString(),source_payload_hash:await digest(JSON.stringify(s))});
  }
  if(!staged.length)return ok({ok:true,status:"unavailable",created:0,reason:"Sin competiciones con estadísticas comprobables"});
  const previous=arr(await db.ProviderSeasonCandidate.filter({player_id:playerId,source:"api_sports"},undefined,200));
  const byKey=new Map(previous.map(x=>[x.candidate_key,x]));
  const fresh=[];let same=0,changed=0;
  for(const entry of staged.slice(0,40)){
   const existing=byKey.get(entry.candidate_key);
   if(!existing)fresh.push(entry);
   else if(existing.source_payload_hash===entry.source_payload_hash)same++;
   else{changed++;if(existing.status==="pending")await db.ProviderSeasonCandidate.update(existing.id,
     {status:"conflict",review_note:"El proveedor presenta valores nuevos para la misma identidad. Revisar; no sustituido."});}
  }
  const now=new Date().toISOString();
  const job=await db.ImportJob.create({
   job_key:"mfv3:api_sports:"+playerId+":"+year+":"+crypto.randomUUID(),player_id:playerId,player_name:player.name,
   sources:["api_sports"],status:fresh.length?"review":"completed",progress:100,requested_at:now,finished_at:now,
   phase:fresh.length?"Temporadas nuevas pendientes de aprobación":"Sin temporadas nuevas; revisa duplicados o cambios",
   source_results:{api_sports:{status:"complete",note:"Estadísticas descargadas para "+staged.length+" equipos y competiciones"}},
   received_candidates:fresh.length,worker_version:"api-sports-live-v1"});
  for(const entry of fresh)await db.ProviderSeasonCandidate.create({...entry,job_id:job.id});
  if(!own.length)await db.PlayerExternalIdentity.create({player_id:playerId,provider:"api_sports",provider_player_id:pid,
   player_name:external.name||"",birth_date:externalBirth,verified_at:now,verification:"manual"});
  return ok({ok:true,status:fresh.length?"review":"completed",job_id:job.id,created:fresh.length,unchanged:same,
   changed,source:"API-Football",fetched_competitions:staged.length});
 }catch(e){console.error("import-api-football",e);return bad(e.message||"Fallo de importación",500);}
}