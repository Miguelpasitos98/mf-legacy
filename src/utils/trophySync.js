import {normaliseSearch} from "./trophyCatalog.js";

const str=value=>String(value??"").trim();
export const TROPHY_IMPORT_FORMAT="mf_legacy_trophy_honours_v1";
export const trophySeason=value=>{
 const v=str(value).replace(/^(\d{4})[-–](\d{4})$/,"$1/$2");
 return /^(?:19|20)\d{2}(?:\/(?:19|20)\d{2})?$/.test(v)?v:"";
};
export const trophyHonourKey=(trophyId,season,teamId)=>[str(trophyId),str(season),str(teamId)].join("|");
const validUrl=v=>/^https:\/\/[^\s/]+\.[^\s/]+/i.test(str(v));
const onlyOne=items=>items.length===1?items[0]:null;

export function trophyResearchPrompt(team,{from="2015/2016",to="2025/2026"}={}){
 if(!team?.id)throw Error("Selecciona un equipo de MF Legacy.");
 return [
  "MF LEGACY — INVESTIGACIÓN DE PALMARÉS OFICIAL POR CLUB",
  "Equipo: "+team.name+" | ID Base44: "+team.id,
  "Periodo: "+from+" — "+to,
  "Investiga los títulos oficiales de PRIMER EQUIPO del club, por temporada y competición.",
  "Incluye ligas, copas, supercopas, títulos continentales y mundiales, no amistosos.",
  "Contrasta cada título con la federación, UEFA/FIFA o una fuente oficial verificable.",
  "Devuelve EXCLUSIVAMENTE JSON compatible con mf_legacy_trophy_honours_v1:",
  '{"format":"mf_legacy_trophy_honours_v1","honours":[{"team_id":"'+team.id+'","team_name":"'+String(team.name).replaceAll('"','')+'","season":"2024/2025","trophy_source_id":"","trophy_name":"NOMBRE OFICIAL DEL TÍTULO","source_url":"https://fuente-oficial.com/resultado","verified":true}]}',
  "Para trophy_source_id usa SOLO un ID original confirmado del catálogo de Trophies.",
  "Si no conoces el ID, deja trophy_source_id vacío: la aplicación solo lo aceptará si encuentra una coincidencia de nombre ÚNICA.",
  "No inventes resultados, nombres de equipos, IDs, fechas ni fuentes. Omite los títulos sin evidencia.",
  "NO asignes títulos individuales a los futbolistas; se cruzarán después con STATS."
 ].join("\n");
}
export function parseTrophyResearch(text){
 const parsed=JSON.parse(str(text));
 if(!parsed||parsed.format!==TROPHY_IMPORT_FORMAT||!Array.isArray(parsed.honours))throw Error("Formato incorrecto; se requiere mf_legacy_trophy_honours_v1.");
 if(parsed.honours.length>250)throw Error("Importa como máximo 250 ediciones por lote.");
 return parsed.honours;
}
export function previewTrophyHonours(entries,{catalog=[],trophies=[],honours=[],teams=[]}={}){
 const bySource=new Map((catalog||[]).map(t=>[str(t.source_id),t]));
 for(const t of trophies||[])bySource.set(str(t.source_id),{...(bySource.get(str(t.source_id))||{}),...t});
 const byName=new Map();
 for(const t of bySource.values()){
  const key=normaliseSearch(t.name);
  if(key&&!/sin identificar/.test(key))byName.set(key,[...(byName.get(key)||[]),t]);
 }
 const byTeam=new Map(teams.map(t=>[str(t.id),t]));
 const existing=new Map(honours.filter(h=>h.recipient_type==="Team").map(h=>[trophyHonourKey(h.trophy_source_id,h.season,h.recipient_id),h]));
 const seen=new Set();
 return entries.map((raw,index)=>{
  const team=byTeam.get(str(raw.team_id));
  const season=trophySeason(raw.season);
  const explicit=str(raw.trophy_source_id);
  const aliases=byName.get(normaliseSearch(raw.trophy_name))||[];
  const trophy=explicit?bySource.get(explicit):onlyOne(aliases);
  const url=str(raw.source_url);
  const sourceOk=validUrl(url);
  const identity=team&&season&&trophy?trophyHonourKey(trophy.source_id,season,team.id):"";
  let status="new",reason="";
  if(!team){status="review";reason="ID de equipo desconocido";}
  else if(!season){status="review";reason="Temporada o edición inválida";}
  else if(!trophy){status="review";reason=explicit?"ID de trofeo no encontrado":aliases.length>1?"Nombre de trofeo ambiguo":"Sin coincidencia exacta de trofeo";}
  else if(trophy.trophy_type==="Individual Trophy"){status="review";reason="El registro corresponde a un premio individual";}
  else if(identity&&seen.has(identity)){status="duplicate";reason="Duplicado dentro del lote";}
  else if(identity&&existing.has(identity)){status="existing";reason="Adjudicación ya registrada";}
  else if(!sourceOk){status="review";reason="Falta URL HTTPS de evidencia";} 
  if(identity)seen.add(identity);
  return {index,status,reason,team,trophy,season,source_url:sourceOk?url:"",verified:Boolean(raw.verified)&&sourceOk,raw};
 });
}

// Championship eligibility is a separate question from season membership.
// Competition matching is conservative; no name-only/season-only player credits.
export function canonicalTrophyCompetition(v){
 const normalized=normaliseSearch(v).replace(/[^a-z0-9]+/g," ").trim();
 const aliases=[
  [/\b(champions league|liga de campeones)\b/,"champions league"],
  [/\b(europa league|liga europa)\b/,"europa league"],
  [/\b(conference league)\b/,"conference league"],
  [/\b(premier league)\b/,"premier league"],
  [/\b(la liga|laliga|primera division de espana)\b/,"laliga"],
  [/\b(copa del rey)\b/,"copa del rey"],
  [/\b(fa cup)\b/,"fa cup"],
  [/\b(copa de la liga inglesa|efl cup|carabao cup)\b/,"efl cup"]
 ];
 return aliases.find(([rx])=>rx.test(normalized))?.[1]||normalized;
}
export function previewPlayerTrophyCredits(honour,{stats=[],players=[],careers=[],trophy=null,existing=[]}={}){
 if(!honour?.id||honour.recipient_type!=="Team"||!honour.verified)return [];
 const teamId=str(honour.recipient_id),season=trophySeason(honour.season);
 if(!teamId||!season)return [];
 const name=str(trophy?.name),comp=canonicalTrophyCompetition(name);
 const playersById=new Map(players.map(p=>[str(p.id),p]));
 const previous=new Set(existing.filter(c=>str(c.trophy_honour_id)===str(honour.id)).map(c=>str(c.player_id)));
 const perPlayer=new Map();
 for(const s of stats){
  const id=str(s.player_id);
  if(!id||str(s.team_id)!==teamId||trophySeason(s.season)!==season||!(Number(s.appearances)>0))continue;
  if(!playersById.has(id))continue;
  const hit=canonicalTrophyCompetition(s.competition)===comp;
  const entry=perPlayer.get(id)||{player:playersById.get(id),matches:0,participation:0,competition_names:[],team_season:true};
  if(hit){entry.matches+=Number(s.appearances);entry.participation++;entry.competition_names.push(s.competition);}
  perPlayer.set(id,entry);
 }
 // Do not infer a trophy from a market value, a current Team or a player
 // who only appears in another competition during that season.
 // Non-matching team-season memberships are only research leads.
 return [...perPlayer.values()].map(x=>({
  ...x,
  team_id:teamId,season,player_id:String(x.player.id),
  status:previous.has(String(x.player.id))?"existing":x.participation?"candidate":"review",
  reason:x.participation?"Participó en la competición; comprobar plantilla campeona":"Militó en el equipo, sin PJ de la competición",
  verified:false
 })).sort((a,b)=>Number(b.participation>0)-Number(a.participation>0)||a.player.name.localeCompare(b.player.name,"es"));
}
