export const norm = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
// Metric keys retain the distinction between totals and percentages.
export const metricNorm = name => norm(String(name??"").replace(/%/g,"percent"));
export const statNum = v => v===null||v===undefined||v===""?null:Number.isFinite(Number(v))?Number(v):null;
export const nationalCompetition = name => {
 const x=norm(name);
 if(x.includes("clubworldcup")||x.includes("fifaclubworldcup"))return false;
 return /finalissima|conmeboluefacupofchampions|worldcup|copaamerica|nationsleague|conmebolqualif|euroqualif|afcon|africacupofnations|asiancup|goldcup|internationalfriendly|uefaqualif|olympicgames|olympics|olympicfootball|olympicqualif|fifau20|fifau17|u20worldcup|u17worldcup|u23asiancup|u20asiancup|u17asiancup|southamericanu20|southamericanu17|worldcupqualification|worldcupqualifiers|friendliesinternational/.test(x)
  || /^euro(?:$|u\d{2}|\d{4}|qualification)/.test(x)
  || /^uefa(?:euro\d{4}|u\d{2}championship|europeanchampionship)/.test(x);
};
export const clubKey = value => {
 let x=norm(value);
 if(x.startsWith("fc")&&x.length>4)x=x.slice(2);
 if(x.endsWith("fc")&&x.length>4)x=x.slice(0,-2);
 return x;
};
const unique=(list,match)=>{const a=list.filter(match);return a.length===1?a[0]:null;};
const exactTeam=(r,teams)=>{
 const byID=teams.find(t=>r.team_id&&String(t.id)===String(r.team_id));
 if(byID)return byID;
 const byFotmob=unique(teams,t=>r.fotmob_team_id&&String(t.fotmob_id||"")===String(r.fotmob_team_id));
 if(byFotmob)return byFotmob;
 if(r.team_name)return unique(teams,t=>norm(t.name)===norm(r.team_name))||unique(teams,t=>clubKey(t.name)===clubKey(r.team_name));
 return null;
};
export const resolveTeam=(record,teams,peers=[])=>{
 if(nationalCompetition(record.competition)){
  const team=exactTeam(record,teams);
  const sourceName=String(record.team_name||"").trim();
  const suspicious= /^(atletico|atlético|river plate|manchester|paris saint|psg|real madrid|barcelona|arsenal|chelsea|bayern|monaco)/i.test(sourceName);
  // Never guess a national side from the player's club or nationality.
  if(team && !suspicious && (record.team_id||record.fotmob_team_id))return {team,status:"national_confirmed",label:"Selección vinculada"};
  return {team:null,status:"national_unlinked",label:suspicious?"Selección pendiente · asociación de club detectada":"Selección pendiente de vincular"};
 }
 const team=exactTeam(record,teams);
 if(record.team_id&&team)return {team,status:"confirmed",label:"Equipo vinculado"};
 if(team)return {team,status:"confirmed",label:"Identificado por nombre o ID FotMob"};
 if(record.team_name)return {team:null,status:"source",label:record.team_name+" · sin vincular"};
 const peersSame=peers.filter(r=>r!==record&&r.season===record.season&&!nationalCompetition(r.competition)).map(r=>exactTeam(r,teams)).filter(Boolean);
 const candidates=[...new Map(peersSame.map(t=>[String(t.id),t])).values()];
 if(candidates.length===1)return {team:candidates[0],status:"suggested",label:"Posible: "+candidates[0].name};
 return {team:null,status:"unknown",label:"Club no identificado"};
};
export const metricsValue=(r,name)=>{
 if(!r)return null;
 if(["minutes","appearances","rating","team_matches"].includes(name))return statNum(r[name]);
 const aliases={goals:["goals","goles"],assists:["assists","asistencias"],xg:["xg","expectedgoals"],xa:["xa","expectedassists"],shots:["shots","tiros"],tackles:["tackles","entradas"],recoveries:["recoveries","recuperaciones"],shotsontarget:["shotsontarget","tirosapuerta"],goals_prevented:["goalsprevented","goals_prevented","golesevitados"],goalsconcededwhileonpitch:["goalsconcededwhileonpitch","goalsconceded","golesencajadosencampo"]};
 const candidate=(r.metrics||[]).find(m=>(aliases[name]||[metricNorm(name)]).includes(metricNorm(m.name)));
 return candidate?statNum(candidate.value):null;
};
export const aggregate=(records,keys=["goals","assists","xg","xa","shots"])=>{
 const output={};for(const key of keys){
  let value=0,available=0;
  for(const r of records){const n=metricsValue(r,key);if(n!==null){value+=n;available++;}}
  output[key]={value:available?value:null,available,total:records.length,partial:available<records.length};
 }
 return output;
};
export const seasonActive=(season,now=new Date())=>{
 const start=Number(String(season||"").slice(0,4));
 const current=now.getUTCMonth()>=6?now.getUTCFullYear():now.getUTCFullYear()-1;
 return start===current;
};
export const defaultSeason = (rows, preferred="", now=new Date()) => {
  const seasons=[...new Set((rows||[]).map(r=>r.season).filter(Boolean))].sort().reverse();
  if(preferred&&seasons.includes(preferred))return preferred;
  const latestCompletedEnd=now.getUTCMonth()>=6?now.getUTCFullYear():now.getUTCFullYear()-1;
  return seasons.find(s=>/^\d{4}\/\d{4}$/.test(s)&&Number(s.slice(5))<=latestCompletedEnd)||seasons[0]||"Todas";
};
export const groupStatRows=(rows)=>{
 const grouped=new Map();
 for(const r of rows||[]){
  const key=[r.player_id||r.fotmob_player_id,r.season,norm(r.competition)].join("|");
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(r);
 }
 const result=[];
 for(const pack of grouped.values()){
  const ids=[...new Set(pack.filter(r=>r.fotmob_team_id||r.team_id).map(r=>String(r.fotmob_team_id||r.team_id)))];
  if(ids.length>1){result.push(...pack);continue;}
  const ordered=[...pack].sort((a,b)=>(b.metrics?.length||0)-(a.metrics?.length||0));
  const first={...ordered[0]};
  for(const r of ordered){
   for(const field of ["team_id","fotmob_team_id","team_name","appearances","minutes","rating","team_matches"]){
    if((first[field]===null||first[field]===undefined||first[field]==="")&&r[field]!==null&&r[field]!==undefined&&r[field]!=="")first[field]=r[field];
   }
  }
  const merged=new Map();
  for(const r of ordered)for(const m of r.metrics||[]){const key=metricNorm(m.name);if(!merged.has(key))merged.set(key,m);}
  first.metrics=[...merged.values()];first._sourceRows=pack.length;
  result.push(first);
 }
 return result;
};