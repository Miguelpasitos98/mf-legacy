// FotMob xGOT read-only bridge: totals and rates always use FotMob minutes,
// never Understat minutes or xG. Do not infer absence as zero.
const norm=x=>String(x??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const numeric=x=>x===null||x===undefined||x===""?null:Number.isFinite(Number(x))?Number(x):null;
export const xgotMetric=record=>(record?.metrics||[]).find(m=>
  ["xgot","expectedgoalsontarget"].includes(norm(m?.name)) &&
  /fotmob/i.test(String(m?.source||record?.source||"")) &&
  ["verified","verificado","auto_verified"].includes(String(m?.verification_status||record?.verification_status||"").toLowerCase()) &&
  String(m?.unit||"total")!=="percentage"
);
export function xgotObservations(records,fotmobId=""){
 const used=new Set(),result=[];
 for(const row of records||[]){
  if(fotmobId&&String(row.fotmob_player_id||"")!==String(fotmobId))continue;
  if(!/^\d{4}\/\d{4}$/.test(String(row.season||"")))continue;
  const m=xgotMetric(row);
  const total=numeric(m?.value),providerMinutes=numeric(m?.provider_minutes);
  const minutes=providerMinutes>0?providerMinutes:numeric(row.minutes);
  const publishedRate=numeric(m?.per90);
  const rate=publishedRate!==null&&publishedRate>=0?publishedRate:
    total!==null&&total>=0&&minutes>0?total*90/minutes:null;
  if(total!==null&&total<0||rate!==null&&rate<0)continue;
  const signature=[String(row.season),String(row.competition||""),String(row.fotmob_team_id||row.team_id||row.team_name||""),String(row.is_national_team||false)].join("|");
  if(used.has(signature))continue;used.add(signature);
  result.push({
    season:String(row.season),competition:String(row.competition||"Sin competición"),
    team:String(row.team_name||""),minutes:minutes>0?minutes:null,
    total:total!==null&&total>=0?total:null,per90:rate,
    hasXgot:!!m&&(total!==null||rate!==null),
    source:m?.source||"fotmob",source_url:m?.source_url||("https://www.fotmob.com/players/"+row.fotmob_player_id),
    rateOrigin:publishedRate!==null?"publicado":rate!==null?"calculado":null
  });
 }
 return result.sort((a,b)=>b.season.localeCompare(a.season)||a.competition.localeCompare(b.competition));
}
export function summarizeFotmobXgot(records,fotmobId=""){
 const obs=xgotObservations(records,fotmobId),groups=new Map();
 for(const item of obs){if(!groups.has(item.season))groups.set(item.season,[]);groups.get(item.season).push(item)}
 const seasons=[...groups.entries()].map(([season,entries])=>{
  const known=entries.filter(e=>e.total!==null),rateRows=known.filter(e=>e.minutes>0);
  const total=known.length?known.reduce((n,e)=>n+e.total,0):null;
  const totalMinutes=rateRows.reduce((n,e)=>n+e.minutes,0);
  // A single published per90 is used as provided, even if its minutes
  // differ slightly from a rounded season-minute display. For multiple
  // competitions, rates require totals and aligned source minutes.
  const rate=entries.length===1&&entries[0].per90!==null?entries[0].per90:
    rateRows.length&&rateRows.length===known.length?total*90/totalMinutes:null;
  return {season,entries,total,per90:rate,minutes:totalMinutes||null,
    knownCompetitions:known.length,allCompetitions:entries.length,
    partial:known.length!==entries.length,
    source:"FotMob",scope:"competitions_with_fotmob_xgot"};
 });
 return {seasons,observations:obs,recordCount:obs.length};
}
