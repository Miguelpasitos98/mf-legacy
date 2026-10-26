import {createClientFromRequest} from "npm:@base44/sdk";
import {validateSeason} from "./core.js";
const str=x=>String(x??"").trim();
const rows=x=>Array.isArray(x)?x:x?.items||x?.data||x?.entities||[];
const response=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const fail=(error,status=400)=>response({ok:false,error},status);
async function hash(s){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(h)].map(n=>n.toString(16).padStart(2,"0")).join("");}
async function identity(db,playerId,pid){
 const p=await db.Player.get(playerId);
 if(!p)return null;
 const links=rows(await db.PlayerFotmobLink.filter({player_id:playerId},undefined,30));
 const ids=[...new Set(links.map(l=>str(l.fotmob_player_id)).filter(Boolean))];
 if(ids.length!==1||ids[0]!==pid||links.length>30)throw Error("La identidad FotMob no coincide con una vinculación única");
 if(!links.some(l=>["verified","confirmed","manual","automatic_exact_name_unique"].includes(str(l.verification).toLowerCase())))throw Error("Vinculación sin confirmar");
 const backlinks=rows(await db.PlayerFotmobLink.filter({fotmob_player_id:pid},undefined,30));
 if(backlinks.some(l=>l.player_id!==playerId))throw Error("ID FotMob asignado a otro jugador");
 return p;
}
function fromArchive(row,pid){
 const provider=row.record_kind==="fotmob_season"?"fotmob":
  row.record_kind==="understat_summary"?"understat":null;
 if(!provider)return null;
 let payload={};
 try {if(row.payload_json)payload=JSON.parse(row.payload_json);}catch{}
 return {provider,fotmob_player_id:pid,season:row.season,competition:row.competition,
  team_name:row.team_name,fotmob_team_id:row.fotmob_team_id,
  source_competition_id:row.source_competition_id,
  source_record_id:row.source_record_id||row.record_key,
  appearances:row.appearances,minutes:row.minutes,
  metrics:Array.isArray(row.metrics)&&row.metrics.length?row.metrics:undefined,
  statistics:payload, evidence_url:""};
}
export default async function(req){
 if(req.method!=="POST")return fail("Solo POST",405);
 try{
  const sdk=createClientFromRequest(req);
  const user=await sdk.auth.me();
  if(!user||user.role!=="admin")return fail("Solo administradores",403);
  const content=await req.text();
  if(content.length>180000)return fail("Lote demasiado grande: máximo 180 KB",413);
  const body=JSON.parse(content),action=str(body.action||"health");
  if(action==="health")return response({ok:true,engine:"web-native-v1",
    source_connectors_live:[],supports:["parse-fotmob-structured","parse-understat-structured","first-season-staging","manual-review"],
    note:"Motor nativo. No accede automáticamente a FotMob ni a otras fuentes externas."});
  if(!["prepare","archive"].includes(action))return fail("Operación desconocida");
  const playerId=str(body.player_id),pid=str(body.fotmob_player_id);
  if(!/^[a-f0-9]{24}$/i.test(playerId)||!/^\d{1,15}$/.test(pid))return fail("IDs de jugador incorrectos");
  const db=sdk.asServiceRole.entities;
  const player=await identity(db,playerId,pid);
  if(!player)return fail("Jugador existente no encontrado",404);
  let records=[];
  if(action==="prepare"){
   if(body.schema!=="mf_legacy_native_snapshot_v1"||!Array.isArray(body.records)||body.records.length<1||body.records.length>12)
    return fail("Formato nativo incorrecto. Entre 1 y 12 registros por lote.");
   records=body.records;
  }else {
   const saved=rows(await db.PlayerProviderRecord.filter({fotmob_player_id:pid},undefined,160));
   records=saved.map(r=>fromArchive(r,pid)).filter(Boolean).slice(0,12);
   if(!records.length)return response({ok:true,status:"unavailable",created:0,
     reason:"No existen observaciones archivadas para este jugador; hace falta una fuente de datos permitida."});
  }
  let normalized=[];
  for(const raw of records){
   try{normalized.push(validateSeason(raw,playerId,pid));}
   catch(e){if(action==="prepare")throw e;}
  }
  if(!normalized.length)return response({ok:true,status:"unavailable",created:0,
    reason:"Ningún registro tenía identidad y estadísticas compatibles."});
  const selected=[],disputed=[];
  for(const item of normalized){
   const keyRaw=[item.player_id,item.provider,item.season,item.competition,
    item.fotmob_team_id,item.team_name,item.source_record_id].join("|");
   const candidate_key="mfv3:native:"+await hash(keyRaw);
   const source_checksum=await hash(JSON.stringify(item));
   if(selected.some(s=>s.candidate_key===candidate_key)){
    const duplicate=selected.find(s=>s.candidate_key===candidate_key);
    if(duplicate.source_checksum!==source_checksum)disputed.push(item.source_record_id);
    continue;
   }
   selected.push({...item,candidate_key,source_checksum,status:"pending",received_at:new Date().toISOString()});
  }
  if(disputed.length)return fail("El lote contiene observaciones contradictorias para una misma competición: "+disputed.join(","),409);
  const prior=[];
  for(let i=0;i<selected.length;i+=15){
   const group=rows(await db.NativeSeasonCandidate.filter({candidate_key:{$in:selected.slice(i,i+15).map(s=>s.candidate_key)}},undefined,40));
   prior.push(...group);
  }
  const seen=new Map(prior.map(r=>[r.candidate_key,r]));
  const fresh=[],changed=[];
  let unchanged=0;
  for(const row of selected){
   const old=seen.get(row.candidate_key);
   if(!old)fresh.push(row);
   else if(old.source_checksum===row.source_checksum)unchanged++;
   else changed.push({id:old.id,source_record_id:row.source_record_id});
  }
  const time=new Date().toISOString(),sources=[...new Set(normalized.map(r=>r.provider))];
  const job=await db.ImportJob.create({
   job_key:"mfv3:native:"+playerId+":"+crypto.randomUUID(),player_id:playerId,player_name:player.name,
   fotmob_player_id:pid,sources,status:fresh.length||changed.length?"review":"completed",progress:100,
   requested_at:time,started_at:time,finished_at:time,worker_version:"base44-web-native-v1",
   phase:fresh.length?"Temporadas nuevas esperando revisión":changed.length?"Cambios en los datos de origen: revisar conflictos":"Sin nuevas temporadas disponibles",
   source_results:Object.fromEntries(sources.map(s=>[s,{status:"complete",note:"Estructura normalizada y guardada como candidata"}])),
   received_candidates:fresh.length
  });
  for(const row of fresh)await db.NativeSeasonCandidate.create({...row,job_id:job.id});
  for(const item of changed){
   const old=prior.find(r=>r.id===item.id);
   if(old?.status==="pending")await db.NativeSeasonCandidate.update(item.id,
     {status:"conflict",review_note:"La misma identidad contiene otras estadísticas; no se reemplazó."});
  }
  return response({ok:true,job_id:job.id,status:fresh.length?"review":"completed",
   created:fresh.length,already_present:unchanged,changed:changed.length,
   warnings:normalized.flatMap(r=>r.warnings||[]),
   no_external_fetch:true});
 }catch(e){console.error("import-native",e);return fail(e.message||"No se pudo preparar el lote",500);}
}
