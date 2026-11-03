import fs from 'node:fs';
import {estimateTrophyReputation,inferTrophyCountry,recommendedTrophyCategory,trophyResearchAnchor,REPUTATION_METHOD} from '../src/utils/trophyResearch.js';
const input=JSON.parse(fs.readFileSync('scripts/trophy_research_input.json','utf8'));
const {trophies,countries}=input;
const actions=[];
const counters={statuses:{},categories:{},scores:{},countries:{},countriesByStatus:{},unlinked:[],anchored:[],conflicts:[]};
function add(groupMap,data,id){const key=JSON.stringify(data);if(!groupMap.has(key))groupMap.set(key,{data,ids:[]});groupMap.get(key).ids.push(id)}
const reputation=new Map(),country=new Map(),category=new Map(),region=new Map();
let modified=0,matchedCountries=0,unresolved=0,international=0;
const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const knownUrlUpdates=[];
for(const t of trophies){
 const sid=String(t.source_id||'');if(!sid)continue;
 const rep=estimateTrophyReputation(t),geo=inferTrophyCountry(t,countries),anchor=trophyResearchAnchor(t);
 if(rep.score<0||rep.score>200||!Number.isInteger(rep.score))throw Error('bad score '+sid);
 const repData={reputation:rep.score,reputation_basis:rep.basis,reputation_method:REPUTATION_METHOD};
 add(reputation,repData,sid);
 const geoData={country_id:geo.country_id||'',country:geo.country||'',country_resolution:geo.resolution};
 add(country,geoData,sid);
 if(geo.region||anchor?.region)add(region,{region:geo.region||anchor.region},sid);
 let proposed=String(t.category||'');
 const suggested=recommendedTrophyCategory(t);
 if(t.identification_status==='Pending'&&suggested&&suggested!==proposed&&['International','Cup','League','Supercup','Other'].includes(suggested))add(category,{category:suggested},sid);
 if(anchor?.url&&(!t.research_source_url||!String(t.research_source_url).trim())){
  knownUrlUpdates.push({source_id:sid,url:anchor.url,name:t.name,score:rep.score,basis:rep.basis});
 }
 if(geo.country_id){matchedCountries++;counters.countries[geo.country]=(counters.countries[geo.country]||0)+1;}
 else if(geo.resolution==='international')international++;
 else {unresolved++;counters.unlinked.push({source_id:sid,name:t.name});}
 if(anchor)counters.anchored.push({source_id:sid,name:t.name,reputation:rep.score,country:geo.country||'',url:anchor.url||'',friendly:!!anchor.friendly});
 counters.scores[rep.score]=(counters.scores[rep.score]||0)+1;
 counters.statuses[t.identification_status]=(counters.statuses[t.identification_status]||0)+1;
 counters.categories[proposed]=(counters.categories[proposed]||0)+1;
}
const groups=map=>[...map.values()].sort((a,b)=>b.ids.length-a.ids.length);
const result={
 meta:{created_at:new Date().toISOString(),input_records:trophies.length,country_records:countries.length,method:REPUTATION_METHOD,
  assigned_country:matchedCountries,international,unresolved_country:unresolved,anchored:counters.anchored.length,
  groups:{reputation:reputation.size,country:country.size,category:category.size,region:region.size,sources:knownUrlUpdates.length}},
 reputation_groups:groups(reputation),country_groups:groups(country),category_groups:groups(category),region_groups:groups(region),source_updates:knownUrlUpdates,
 audit:counters
};
fs.writeFileSync('scripts/trophy_research_plan.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result.meta));
console.log('Top score counts',JSON.stringify(Object.entries(counters.scores).sort((a,b)=>Number(b[0])-Number(a[0])).slice(0,30)));
console.log('Most assigned countries',JSON.stringify(Object.entries(counters.countries).sort((a,b)=>b[1]-a[1]).slice(0,25)));
console.log('Unlinked examples',JSON.stringify(counters.unlinked.slice(0,22)));
