/** Manager Fit V6: scouting constraints, kept distinct from tactical scoring. */
export function seasonReferenceDate(season){
 const m=String(season||"").match(/^(\d{4})\/(\d{4})$/);
 if(m&&+m[2]===+m[1]+1)return new Date(Date.UTC(+m[2],5,30));
 const n=String(season||"").match(/^(\d{4})$/);
 return n?new Date(Date.UTC(+n[1],11,31)):null;
}
export function ageOnSeason(player,season){
 const value=String(player?.date_of_birth||"").trim();
 const m=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
 if(!m)return null;
 const [d,mo,y]=[+m[1],+m[2],+m[3]];
 const birth=new Date(Date.UTC(y,mo-1,d)),ref=seasonReferenceDate(season);
 if(!ref||birth.getUTCDate()!==d||birth.getUTCMonth()!==mo-1||birth>ref)return null;
 let age=ref.getUTCFullYear()-y;
 if(ref.getUTCMonth()<mo-1||(ref.getUTCMonth()===mo-1&&ref.getUTCDate()<d))age--;
 return age>=0&&age<90?age:null;
}
export function valuationForSeason(rows,playerId,season){
 const available=rows.filter(r=>String(r.player_id)===String(playerId)&&r.season===season);
 // A valuation must match the historical season exactly: no current-value fallback.
 const candidates=available.map(r=>({eur:Number(r.transfermarkt_value_eur),date:r.market_value_as_of||"",
   status:r.verification_status||"pending"}))
  .filter(r=>Number.isFinite(r.eur)&&r.eur>0);
 if(!candidates.length)return null;
 candidates.sort((a,b)=>b.date.localeCompare(a.date));
 return candidates[0];
}
export function filterScoutingCandidates(items,{season,minAge=null,maxAge=null,maxValueM=null,knownValueOnly=false,minimumCoverage=0,coverageMode="role"}={}){
 return items.filter(item=>{
  const age=ageOnSeason(item.player,season);
  if(minAge!==null&&(age===null||age<minAge))return false;
  if(maxAge!==null&&(age===null||age>maxAge))return false;
  const value=item.valuation?.eur??null;
  if(knownValueOnly&&value===null)return false;
  if(maxValueM!==null&&(value===null||value>maxValueM*1000000))return false;
  const coverage=coverageMode==="hybrid"?item.hybrid?.coverage:
    coverageMode==="career"?item.career?.coverage:
    coverageMode==="historical"?item.historical?.coverage:
    coverageMode==="attributes"?item.advanced?.coverage:
    coverageMode==="position"?(item.fit===null?0:100):item.roleFit?.coverage;
  if(minimumCoverage>0&&(coverage??0)<minimumCoverage)return false;
  return true;
 });
}
export const formatTransferValue=v=>v===null||v===undefined?"Sin valoración":(v/1e6).toLocaleString("es-ES",{maximumFractionDigits:2})+" M€";
