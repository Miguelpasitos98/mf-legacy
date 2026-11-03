// Read-only presentation views for the MF LEGACY trophy catalogue.
// All views use the SAME source_id; no new trophy records are created.
// Scope and reputation are editorial estimates, never evidence of official titles.
import {normaliseSearch} from "./trophyCatalog.js";
import {classifyTrophy,groupTrophies} from "./trophyGrouping.js";
import {estimateTrophyReputation,trophyResearchAnchor} from "./trophyResearch.js";

export const TROPHY_CATALOG_VIEW_MODES=["gallery","reputation","scope","leagues","countries","clubs"];
const TIERS=[
 {key:"rep180",title:"180–200 · Élite mundial",min:180,max:200,rank:0},
 {key:"rep150",title:"150–179 · Prestigio internacional",min:150,max:179,rank:1},
 {key:"rep120",title:"120–149 · Alta relevancia",min:120,max:149,rank:2},
 {key:"rep90",title:"90–119 · Reconocimiento nacional",min:90,max:119,rank:3},
 {key:"rep60",title:"60–89 · Tradición regional",min:60,max:89,rank:4},
 {key:"rep0",title:"0–59 · Locales y minoritarios",min:0,max:59,rank:5}
];
const scope=(key,title,rank,detail)=>({key,title,rank,detail});
const SCOPES=[
 scope("world","Mundiales",0,"Competiciones de ámbito mundial"),
 scope("continental","Continentales / interconfederativas",1,"Competiciones de varios países"),
 scope("friendly","Amistosos e invitacionales",2,"Torneos de exhibición; no implican oficialidad"),
 scope("national","Nacionales",3,"Competiciones asociadas a un país, ámbito no necesariamente confirmado"),
 scope("regional","Regionales y locales",4,"Competiciones geográficamente limitadas"),
 scope("unknown","Ámbito por determinar",5,"Sin información suficiente para clasificarlas")
];
const REGIONAL=/\b(?:regional(?:es)?|county|district|provincial|municipal|comarcal|county fa|state cup|state league|campeonato (?:de|da|do) (?:cataluna|galicia|asturias|andalucia|madrid|baviera)|gauliga|kreisliga|bezirksliga|landesliga|copa (?:catalunya|galicia|macaya))\b/;
const FRIENDLY=/\b(?:amistos[oa]|friendly|invitational|invitation cup|summer tournament|preseason|pre season|trofeo|trofeu|emirates cup|audi cup|uhrencup|joan gamper|ramon de carranza|teresa herrera)\b/;
export function trophyScope(trophy,leagues=[],countries=[]){
 const associated=classifyTrophy(trophy,leagues,countries);
 const n=normaliseSearch(trophy.name||trophy.source_name||"");
 const anchor=trophyResearchAnchor(trophy);
 if(anchor?.friendly||FRIENDLY.test(n)&&trophy.category!=="International")return SCOPES[2];
 if(associated.kind==="world")return SCOPES[0];
 if(associated.kind==="confederation"||trophy.country_resolution==="international"||trophy.category==="International")return SCOPES[1];
 if(REGIONAL.test(n)||trophy.region&&String(trophy.region).trim())return SCOPES[4];
 if(associated.kind==="country")return SCOPES[3];
 return SCOPES[5];
}
export function reputationTier(trophy){
 const value=estimateTrophyReputation(trophy).score;
 return TIERS.find(t=>value>=t.min&&value<=t.max)||TIERS[5];
}
const byName=(a,b)=>String(a.name||"").localeCompare(String(b.name||""),"es",{numeric:true});
const byReputation=(a,b)=>estimateTrophyReputation(b).score-estimateTrophyReputation(a).score||byName(a,b);
function groupedBy(items,getGroup,{sortItems=byReputation,sortGroups=(a,b)=>a.rank-b.rank||a.title.localeCompare(b.title,"es")}={}){
 const groups=new Map();
 for(const item of items){
  const parent=getGroup(item);if(!parent)continue;
  if(!groups.has(parent.key))groups.set(parent.key,{...parent,items:[]});
  groups.get(parent.key).items.push(item);
 }
 return [...groups.values()].map(group=>({...group,items:group.items.sort(sortItems)})).sort(sortGroups);
}
const unlinked={key:"country-unlinked",title:"País no confirmado",kind:"unclassified",rank:999};
const external={key:"country-global",title:"Internacionales / multinacionales",kind:"international",rank:500};
function countryGroup(trophy,leagues,countries){
 const item=classifyTrophy(trophy,leagues,countries);
 if(item.kind==="country")return {...item,rank:1};
 if(item.kind==="world"||item.kind==="confederation")return external;
 return unlinked;
}
export function trophyViewGroups(items,view,leagues=[],countries=[],sortMode="name"){
 if(view==="gallery")return groupTrophies(items,leagues,countries,sortMode);
 if(view==="reputation")return groupedBy(items,reputationTier,{sortItems:byReputation});
 if(view==="scope")return groupedBy(items,t=>trophyScope(t,leagues,countries),{sortItems:byReputation});
 if(view==="countries")return groupedBy(items,t=>countryGroup(t,leagues,countries),{
  sortItems:sortMode==="reputation_asc"?(a,b)=>byReputation(b,a):sortMode==="reputation_desc"?byReputation:byName,
  sortGroups:(a,b)=>(a.rank===999?1:b.rank===999?-1:0)||
  (a.kind==="country"&&b.kind==="country"?a.title.localeCompare(b.title,"es"):a.rank-b.rank)
 });
 if(view==="leagues")return groupedBy(items.filter(t=>t.category==="League"),t=>countryGroup(t,leagues,countries),{
  sortItems:byReputation,
  sortGroups:(a,b)=>a.rank===999?1:b.rank===999?-1:a.rank===500?1:b.rank===500?-1:
   Math.max(...b.items.map(x=>estimateTrophyReputation(x).score))-
   Math.max(...a.items.map(x=>estimateTrophyReputation(x).score))||a.title.localeCompare(b.title,"es")
 });
 return [];
}
export function groupTrophyHonoursForClub(honours=[],editions=[],teamId=""){
 const linked=String(teamId||"");
 if(!linked)return {verified:[],historical:[],verifiedTrophies:[],historicalTrophies:[]};
 const verified=honours.filter(h=>h.verified===true&&h.recipient_type==="Team"&&String(h.recipient_id)===linked);
 const historical=editions.filter(e=>String(e.champion_team_id||"")===linked);
 return {verified,historical,
  verifiedTrophies:[...new Set(verified.map(h=>String(h.trophy_source_id)).filter(Boolean))],
  historicalTrophies:[...new Set(historical.map(h=>String(h.trophy_source_id)).filter(Boolean))]};
}
