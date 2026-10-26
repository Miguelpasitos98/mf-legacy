import {canonicalHistoricalCompetition} from "./historicalJson.js";
const n=v=>v===null||v===undefined||v===""?null:Number.isFinite(Number(v))?Number(v):null;
const str=v=>String(v??"").trim();
/** Align player minutes with actual club fixtures by season+competition+team. */
export function playPctFromTeamMatches(summary,matches=[]){
 const records=summary?.records||[];
 if(!records.length)return null;
 let minutes=0,fixtures=0,matched=0;
 for(const row of records){
  const m=n(row.minutes),own=n(row.team_matches);
  if(m===null||m<0)continue;
  const ids=[str(row.team_id),str(row.fotmob_team_id)].filter(Boolean);
  const aligned=matches.filter(t=>str(t.season)===str(row.season)&&
   canonicalHistoricalCompetition(t.competition)===canonicalHistoricalCompetition(row.competition)&&
   ids.some(id=>id===str(t.team_id)||id===str(t.fotmob_team_id)));
  const values=[...new Set(aligned.map(t=>n(t.team_matches)).filter(v=>v!==null&&v>0))];
  if(values.length>1)continue; // conflicting source: never guess
  const tm=values.length===1?values[0]:own;
  if(!(tm>0))continue;
  minutes+=m;fixtures+=tm;matched++;
 }
 return matched&&fixtures>0?minutes/(fixtures*90)*100:null;
}
