import {normaliseSearch} from "./trophyCatalog.js";
import {trophyEditionRows} from "./trophyDetailData.js";
const str=value=>String(value??"").trim();
const seasonSort=(a,b)=>str(b.season).localeCompare(str(a.season),"es",{numeric:true});

export function archiveOverview(honours=[],credits=[],catalog=[],players=[]){
 const verified=trophyEditionRows(honours).filter(h=>h.verified===true);
 const trophyMap=new Map(catalog.map(t=>[str(t.source_id),t]));
 const clubMap=new Map(),playerMap=new Map(),competitionMap=new Map();
 const playersById=new Map(players.map(p=>[str(p.id),p]));
 const byHonourId=new Map(verified.map(h=>[str(h.id),h]));
 const seenPlayers=new Set();
 const addPlayer=(playerId,h,kind)=>{
  const key=[str(playerId),str(h.trophy_source_id),str(h.season),kind].join("|");
  if(seenPlayers.has(key)||!playerId)return;seenPlayers.add(key);
  const p=playerMap.get(str(playerId))||{id:str(playerId),name:playersById.get(str(playerId))?.name||"Jugador",total:0,collective:0,individual:0,seasons:[],trophies:new Set()};
  p.total++;p[kind]++;p.trophies.add(str(h.trophy_source_id));p.seasons.push(h.season);playerMap.set(p.id,p);
 };
 for(const h of verified){
  const trophyId=str(h.trophy_source_id),teamId=str(h.recipient_id);
  if(trophyId){
   const row=competitionMap.get(trophyId)||{
    source_id:trophyId,name:trophyMap.get(trophyId)?.name||trophyId,count:0,
    latest:"",winners:new Set(),trophy:trophyMap.get(trophyId)
   };
   row.count++;row.winners.add(str(h.recipient_type)+"|"+teamId);
   if(!row.latest||h.season>row.latest)row.latest=h.season;
   competitionMap.set(trophyId,row);
  }
  if(h.recipient_type==="Team"&&teamId){
   const row=clubMap.get(teamId)||{id:teamId,name:h.recipient_name||"Equipo",total:0,trophies:new Set(),seasons:[],latest:""};
   row.total++;row.trophies.add(trophyId);row.seasons.push(h.season);
   if(!row.latest||h.season>row.latest)row.latest=h.season;
   clubMap.set(teamId,row);
  }
  if(h.recipient_type==="Player")addPlayer(teamId,h,"individual");
 }
 for(const c of credits){
  if(c.status!=="confirmed"||c.verified!==true)continue;
  const h=byHonourId.get(str(c.trophy_honour_id));
  if(!h||h.recipient_type!=="Team"||str(c.team_id)!==str(h.recipient_id)||str(c.season)!==str(h.season))continue;
  addPlayer(str(c.player_id),h,"collective");
 }
 const rank=(records,key)=>[...records].sort((a,b)=>b[key]-a[key]||a.name.localeCompare(b.name,"es"));
 return {
  verified,verifiedCount:verified.length,
  competitions:rank(competitionMap.values(),"count").map(v=>({...v,winnerCount:v.winners.size})),
  clubs:rank(clubMap.values(),"total").map(v=>({...v,distinct:v.trophies.size,seasons:[...v.seasons].sort().reverse()})),
  players:rank(playerMap.values(),"total").map(v=>({...v,distinct:v.trophies.size,seasons:[...v.seasons].sort().reverse()}))
 };
}
export function searchArchiveRows(items,query){
 const q=normaliseSearch(query).trim();
 if(!q)return items;
 const compact=q.replace(/[^a-z0-9]+/g,"");
 return items.filter(item=>{
  const text=normaliseSearch([item.name,item.latest,...(item.seasons||[]),item.source_id].filter(Boolean).join(" "));
  return text.includes(q)||text.replace(/[^a-z0-9]+/g,"").includes(compact);
 });
}
