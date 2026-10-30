import {canonicalHistoricalClub} from "./historicalJson.js";

// Compare official names without club-form designators, not by indiscriminately
// deleting words. Sporting/Real/Inter/City/United are part of the identity.
const PREFIXES=new Set(["fc","cf","afc","fk","as","ac","ssc","sc","rc","ogc"]);
const SUFFIXES=new Set(["fc","cf","afc","fk"]);
const VARIANTS=new Set(["b","ii","iii","2","3","u17","u18","u19","u20","u21","u23","reserves","reserve","castilla","femeni","femenino","femenina","women","womens","ladies","academy","youth","juvenil"]);
const str=v=>String(v??"").trim();
const clean=v=>str(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

export function clubIdentityTokens(name){
 const canonical=clean(canonicalHistoricalClub(name));
 const raw=canonical.split(" ").filter(Boolean);
 const parts=[...raw],variantEnding=[];
 // Preserve reserve/youth markers even when FC appears immediately before them.
 while(parts.length>1&&VARIANTS.has(parts[parts.length-1]))variantEnding.unshift(parts.pop());
 // One source may say "AS Monaco FC" while the app says "Monaco".
 // Remove designators at edges only, not distinctive central tokens.
 while(parts.length>1&&PREFIXES.has(parts[0]))parts.shift();
 while(parts.length>1&&SUFFIXES.has(parts[parts.length-1]))parts.pop();
 parts.push(...variantEnding);
 return {canonical,tokens:parts,normal:parts.join(" "),variants:raw.filter(t=>VARIANTS.has(t)||/^u\d{2}$/.test(t)||/^sub\d{2}$/.test(t)).sort().join("|"),
  protectedSuffix:raw.length>1&&["sc","sporting","juniors"].includes(raw.at(-1))?raw.at(-1):""};
}
const levenshtein=(a,b)=>{
 const previous=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  let topLeft=previous[0];previous[0]=i;
  for(let j=1;j<=b.length;j++){
   const above=previous[j];previous[j]=Math.min(previous[j]+1,previous[j-1]+1,topLeft+(a[i-1]===b[j-1]?0:1));topLeft=above;
  }
 }
 return previous[b.length];
};
function rateIdentities(from,to){
 if(!from.normal||!to.normal)return null;
 if(from.variants!==to.variants||from.protectedSuffix!==to.protectedSuffix)return null;
 if(from.canonical===to.canonical)return {score:99,confidence:"high",reason:"Nombre equivalente"};
 if(from.normal===to.normal&&from.normal.length>=4)return {score:96,confidence:"high",reason:"Siglas del nombre oficial (AS, FC, SC…)"};
 const first=new Set(from.tokens),second=new Set(to.tokens);
 const common=[...first].filter(t=>second.has(t)&&t.length>2);
 const smaller=Math.min(first.size,second.size),larger=Math.max(first.size,second.size);
 // A short provider name embedded in the official name is a suggestion
 // for explicit manual review, never a silent bulk auto-match.
 if(common.length&&common.length===smaller&&larger-smaller<=3){
  const meaningful=common.some(t=>t.length>=4&&!["club","real","city","united","sporting","athletic"].includes(t));
  if(meaningful)return {score:84,confidence:"review",reason:"Nombre abreviado dentro del oficial"};
 }
 const isSubstring=Math.min(from.normal.length,to.normal.length)>=4&&(from.normal.includes(to.normal)||to.normal.includes(from.normal));
 // Avoid an expensive edit-distance calculation for unrelated catalog clubs.
 if(!common.length&&!isSubstring)return null;
 const similarity=1-levenshtein(from.normal,to.normal)/Math.max(from.normal.length,to.normal.length);
 if(similarity>=0.84&&common.length)
  return {score:Math.round(72+Math.min(10,(similarity-0.84)*65)),confidence:"review",reason:"Nombre muy parecido"};
 if(Math.min(from.normal.length,to.normal.length)>=4&&
   (from.normal.includes(to.normal)||to.normal.includes(from.normal))&&
   (similarity>=0.54||from.tokens.some(t=>to.tokens.some(u=>u.startsWith(t)&&t.length>=4))))
  return {score:76,confidence:"review",reason:"Posible nombre corto"};
 return null;
}

const catalogIdentityCache=new WeakMap();
function preparedCatalog(teams){
 let prepared=catalogIdentityCache.get(teams);
 if(!prepared){
  prepared=teams.filter(team=>team?.id).map(team=>({team,identity:clubIdentityTokens(team.name)}));
  catalogIdentityCache.set(teams,prepared);
 }
 return prepared;
}
export function rankPossessionTeamCandidates(group,teams=[]){
 if(!group||group.conflict)return [];
 const ids=[...group.fotmobIds||[]].map(str).filter(Boolean);
 if(ids.length>1)return [];
 const names=[...new Set([group.name,...(group.names||[])].map(str).filter(Boolean))];
 const results=[],sourceNames=names.map(clubIdentityTokens);
 for(const {team,identity} of preparedCatalog(teams)){
  const teamId=str(team.id),fm=str(team.fotmob_id);
  if(group.linkedIds?.size&&(!group.linkedIds.has(teamId)||group.linkedIds.size!==1))continue;
  if(ids.length&&fm&&ids[0]!==fm)continue;
  let result=null;
  if(ids.length&&fm===ids[0])result={score:100,confidence:"high",reason:"ID FotMob confirmado"};
  else{
   for(const sourceName of sourceNames){
    const candidate=rateIdentities(sourceName,identity);
    if(candidate&&(!result||candidate.score>result.score))result=candidate;
   }
  }
  if(result)results.push({team,...result});
 }
 return results.sort((a,b)=>b.score-a.score||str(a.team.name).localeCompare(str(b.team.name),"es"));
}
export function recommendPossessionTeam(group,teams=[]){
 const ranked=rankPossessionTeamCandidates(group,teams);
 if(!ranked.length)return null;
 const [best,next]=ranked;
 // If several teams are similarly plausible, require a manual search.
 if(next&&best.score-next.score<9)return null;
 return best;
}
