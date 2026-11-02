/**
 * Manager Fit V3 — historical season-specific evidence.
 * Uses only explicit player_id links. A single historical season is queried
 * and assessed; never combine seasons, estimated FM26 ability, or competition
 * totals without minute alignment.
 */
const LABELS={
 buildup:["xG Buildup","xGBuildup"],
 chain:["xG Chain","xGChain"],
 xa:["xA","Expected assists"],
 xg:["xG excl. penalty","Non-penalty xG","np xG","npxG"],
 passing:["Accurate passes"],
 longPassing:["Accurate long balls"],
 creation:["Big chances created"],
 dribbles:["Dribbles","Successful dribbles"],
 pressure:["Possession won final 3rd"],
 defense:["PAdj defensive actions","Possession adjusted defensive actions"],
 preventing:["Goals prevented"],
 shot:["Shots on target"]
};
export const HIST_ROLE_METRICS={
 GK:["preventing","longPassing","passing"],
 CB:["buildup","defense","longPassing","passing"],
 FB:["xa","buildup","chain","defense","dribbles"],
 DM:["buildup","passing","defense","longPassing"],
 AM:["xa","chain","creation","buildup"],
 WG:["xa","dribbles","chain","creation"],
 ST:["xg","chain","shot","pressure"]
};
const normalize=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
const positive=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const id=s=>String(s??"");
const isClubRow=r=>r?.is_national_team!==true && !/international|national team|world cup|euro|copa america/i.test(String(r?.competition||""));
function rate(metric,row){
 const per90=positive(metric.per90);
 if(per90!==null)return per90;
 const explicit=String(metric.name||"");
 if(/\/90|per\s*90/i.test(explicit))return positive(metric.value);
 const total=positive(metric.value);
 const minutes=positive(row.minutes);
 return total!==null&&minutes>=90?total*90/minutes:null;
}
const findMetric=(row,key)=>{
 const aliases=LABELS[key]||[];
 return (row.metrics||[]).find(m=>aliases.some(a=>normalize(a)===normalize(m?.name)||normalize(a+" /90")===normalize(m?.name)));
};
export function collectPlayerSeasonMetrics(rows,understatRows=[],season,playerId){
 const club=rows.filter(r=>id(r.player_id)===id(playerId)&&r.season===season&&isClubRow(r));
 const result={};
 for(const key of Object.keys(LABELS)){
  const data=club.map(row=>({row,metric:findMetric(row,key)})).filter(x=>x.metric);
  const totalMinutes=data.reduce((s,x)=>s+(positive(x.row.minutes)||0),0);
  const amounts=data.map(({row,metric})=>({v:rate(metric,row),mins:positive(row.minutes)}))
    .filter(x=>x.v!==null&&x.mins>=90);
  const denom=amounts.reduce((s,x)=>s+x.mins,0);
  // Weighted by aligned minutes; never average rates arithmetically.
  if(denom>0)result[key]={value:amounts.reduce((s,x)=>s+x.v*x.mins,0)/denom,source:"FotMob",minutes:denom};
  else if(totalMinutes>0)result[key]=null;
 }
 const under=understatRows.filter(r=>id(r.player_id)===id(playerId)&&r.season===season);
 for(const [key,field] of [["chain","xg_chain_p90"],["buildup","xg_buildup_p90"]]){
  const values=under.map(r=>positive(r[field])).filter(v=>v!==null);
  // Multiple team rows cannot be correctly combined without aligned minutes.
  if(values.length===1)result[key]={value:values[0],source:"Understat",minutes:null};
 }
 return result;
}
export function seasonPercentiles(metrics,peers,role,profile){
 const used=HIST_ROLE_METRICS[role]||[];
 const axis=Number(profile?.possession)||0;
 const pace=Number(profile?.tempo)||0;
 const pressing=Number(profile?.pressing)||0;
 const weights=Object.fromEntries(used.map(k=>[k,1]));
 if(axis>=70){for(const k of ["buildup","passing","chain"])if(weights[k])weights[k]*=1.6;}
 if(pace>=70){for(const k of ["chain","dribbles","shot"])if(weights[k])weights[k]*=1.4;}
 if(pressing>=70){for(const k of ["pressure","defense"])if(weights[k])weights[k]*=1.6;}
 let weighted=0,weightSum=0;
 const breakdown=[];
 for(const key of used){
  const observation=metrics[key]?.value;
  if(observation===null||observation===undefined)continue;
  const population=peers.map(p=>p[key]?.value).filter(v=>v!==null&&v!==undefined&&Number.isFinite(v)).sort((a,b)=>a-b);
  // Percentiles against under 10 observed players are too unstable to publish.
  if(population.length<10)continue;
  const less=population.filter(v=>v<observation).length;
  const equal=population.filter(v=>v===observation).length;
  const percentile=Math.round((less+equal/2)/population.length*100);
  weighted+=percentile*weights[key];weightSum+=weights[key];
  breakdown.push({key,value:observation,percentile,source:metrics[key]?.source,peers:population.length,weight:weights[key]});
 }
 return {
  score:weightSum>0&&breakdown.length>=2?Math.round(weighted/weightSum):null,
  coverage:used.length?Math.round(breakdown.length/used.length*100):0,
  breakdown,missing:used.filter(key=>!breakdown.some(row=>row.key===key)),
  confidence:breakdown.length>=3?"medium":breakdown.length>=2?"low":"insufficient"
 };
}
export function historicalRoleCandidates(players,role){
 const positions={GK:["GK"],CB:["DFC","CB"],FB:["LD","LI","CRD","CRI","RB","LB","RWB","LWB"],DM:["CDM","DM","CM"],AM:["CAM","CM","AM"],WG:["EI","ED","RW","LW"],ST:["DC","ST","CF"]}[role]||[];
 return players.filter(p=>positions.includes(String(p.position||"").toUpperCase()));
}
