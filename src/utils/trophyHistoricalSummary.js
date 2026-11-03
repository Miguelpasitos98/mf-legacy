// Editorial projection of FM24/Rob finals. NEVER mixes this material with
// the independently verified TrophyHonour archive.
const asText=value=>String(value??"").trim();
const keyFor=row=>asText(row?.edition_key)||[asText(row?.trophy_source_id),asText(row?.season)].join(":");
const yearFor=row=>{
 const year=Number(row?.edition_year);
 return Number.isFinite(year)&&year>0?year:Number(asText(row?.season).slice(0,4))+1||0;
};
const clubKey=row=>{
 const id=asText(row?.champion_team_id);
 if(id)return "id:"+id;
 return "name:"+asText(row?.champion_name).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
};
export function trophyHistoricalSummary(editions=[],events=[]){
 const unique=new Map();
 for(const row of Array.isArray(editions)?editions:[]){
  if(!row?.season||!row?.champion_name)continue;
  const key=keyFor(row);
  if(!unique.has(key))unique.set(key,row);
 }
 const finals=[...unique.values()].sort((a,b)=>yearFor(b)-yearFor(a)||asText(b.season).localeCompare(asText(a.season),"es",{numeric:true}));
 const clubs=new Map();
 for(const row of finals){
  const key=clubKey(row);
  const previous=clubs.get(key)||{key,team_id:asText(row.champion_team_id),name:asText(row.champion_name),count:0,seasons:[]};
  previous.count++;
  previous.seasons.push(asText(row.season));
  clubs.set(key,previous);
 }
 const ranking=[...clubs.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,"es"));
 return {
  editionCount:finals.length,
  clubCount:ranking.length,
  eventCount:Array.isArray(events)?new Set(events.map(event=>asText(event?.event_key)).filter(Boolean)).size:0,
  newest:finals[0]?.season||"",
  earliest:finals.at(-1)?.season||"",
  recentFinals:finals.slice(0,4),
  ranking,
  finals
 };
}
