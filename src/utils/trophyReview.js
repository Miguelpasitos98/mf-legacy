import {normaliseSearch} from "./trophyCatalog.js";

const id=value=>String(value??"").trim();
export const validTrophyEvidenceUrl=value=>{
 const url=id(value);
 if(!/^https:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(url))return false;
 try{
  const parsed=new URL(url);
  return parsed.protocol==="https:"&&parsed.hostname.includes(".")&&!parsed.username&&!parsed.password&&parsed.hostname.length>3;
 }catch{return false;}
};
export const creditReviewKey=credit=>[id(credit.trophy_honour_id),id(credit.player_id)].join("|");
const statusIsPending=credit=>credit.status==="candidate"&&credit.verified!==true;

// Produce records suitable for review without guessing teams, players or winners.
// Even when the current championship is unverified, keep the candidate visible
// with a block reason so it can be diagnosed rather than silently disappearing.
export function trophyReviewRows({credits=[],honours=[],teams=[],players=[],catalog=[]}={}){
 const teamMap=new Map(teams.map(team=>[id(team.id),team]));
 const playerMap=new Map(players.map(player=>[id(player.id),player]));
 const trophyMap=new Map(catalog.map(trophy=>[id(trophy.source_id),trophy]));
 const honourMap=new Map(honours.map(honour=>[id(honour.id),honour]));
 const creditGroups=new Map();
 for(const credit of credits){
  if(!credit?.id)continue;
  const key=creditReviewKey(credit);
  if(!creditGroups.has(key))creditGroups.set(key,[]);
  creditGroups.get(key).push(credit);
 }
 return credits.filter(credit=>credit?.id).map(credit=>{
  const honour=honourMap.get(id(credit.trophy_honour_id))||null;
  const player=playerMap.get(id(credit.player_id))||null;
  const team=teamMap.get(id(credit.team_id))||null;
  const trophyId=id(credit.trophy_source_id||honour?.trophy_source_id);
  const trophy=trophyMap.get(trophyId)||null;
  const sameSource=!credit.trophy_source_id||id(credit.trophy_source_id)===id(honour?.trophy_source_id);
  const duplicate=(creditGroups.get(creditReviewKey(credit))||[]).length>1;
  const reasons=[];
  if(!honour)reasons.push("Título de equipo no encontrado");
  else{
   if(honour.recipient_type!=="Team")reasons.push("El título no pertenece a un club");
   if(honour.verified!==true)reasons.push("Título del club pendiente de verificar");
   if(id(honour.recipient_id)!==id(credit.team_id))reasons.push("Equipo del título distinto");
   if(id(honour.season)!==id(credit.season))reasons.push("Temporada distinta");
   if(!sameSource)reasons.push("Trofeo distinto");
  }
  if(!team)reasons.push("Equipo no encontrado");
  if(!player)reasons.push("Jugador no encontrado");
  if(!trophy)reasons.push("Trofeo de catálogo no encontrado");
  if(duplicate)reasons.push("Adjudicación duplicada: revisión manual");
  if(credit.status==="candidate"&&credit.verified===true)reasons.push("Estado de verificación inconsistente");
  const pending=statusIsPending(credit);
  return {
   ...credit,team,player,trophy,honour,
   team_name:team?.name||honour?.recipient_name||"Club desconocido",
   player_name:player?.name||"Jugador desconocido",
   trophy_name:trophy?.name||"Trofeo no identificado",
   season:id(credit.season),
   pending,blocked:reasons.length>0,reasons,
   has_evidence:validTrophyEvidenceUrl(credit.source_url)
  };
 }).sort((a,b)=>
  Number(b.pending)-Number(a.pending)||
  id(b.season).localeCompare(id(a.season),"es",{numeric:true})||
  a.team_name.localeCompare(b.team_name,"es")||
  a.player_name.localeCompare(b.player_name,"es"));
}

export function filterTrophyReviews(rows,{status="candidate",team="all",trophy="all",season="all",query="",blocked="all"}={}){
 const search=normaliseSearch(query).trim();
 return rows.filter(row=>
  (status==="all"||row.status===status)&&
  (team==="all"||id(row.team_id)===team)&&
  (trophy==="all"||id(row.trophy_source_id||row.honour?.trophy_source_id)===trophy)&&
  (season==="all"||id(row.season)===season)&&
  (blocked==="all"||(blocked==="blocked"?row.blocked:!row.blocked))&&
  (!search||normaliseSearch([row.player_name,row.team_name,row.trophy_name,row.season,row.evidence_note].join(" ")).includes(search))
 );
}

export function prepareTrophyDecision(row,{status,source="",acknowledged=false}={}){
 if(!row?.id)throw Error("Adjudicación no encontrada.");
 if(!row.pending||row.status!=="candidate")throw Error("Solo se pueden revisar adjudicaciones candidatas.");
 if(row.blocked)throw Error("La adjudicación presenta inconsistencias. Revisa sus IDs antes de modificarla.");
 if(status==="confirmed"){
  if(!acknowledged)throw Error("Debes revisar y confirmar expresamente la elegibilidad del jugador.");
  if(!validTrophyEvidenceUrl(source))throw Error("Introduce una URL HTTPS válida que acredite la elegibilidad del jugador.");
  return {
   status:"confirmed",verified:true,source_url:id(source),
   evidence_type:"official_roster",
   evidence_note:"Elegibilidad para esta edición comprobada individualmente con la fuente oficial."
  };
 }
 if(status==="excluded")return {
  status:"excluded",verified:false,
  evidence_note:[id(row.evidence_note),"Excluido tras revisión de adjudicación."].filter(Boolean).join(" ").slice(0,1200)
 };
 throw Error("Estado de revisión no reconocido.");
}

export function safeBulkTrophyPlan(rows,decisions={}){
 const plan=[],seen=new Set();
 for(const row of rows){
  if(seen.has(row.id))continue;
  seen.add(row.id);
  const decision=decisions[id(row.id)];
  if(!decision)throw Error("Falta revisar un elemento seleccionado.");
  plan.push({id:row.id,payload:prepareTrophyDecision(row,decision)});
 }
 return plan;
}
