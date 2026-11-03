// MF LEGACY — public, immutable Understat archive; pure, testable reconciliation.
export const ARCHIVE_URL='https://raw.githubusercontent.com/vibedatascience/understat_players_aggregated/768b7ca0b977a5e6b4b429c7b0cf750e8269f2fc/understat_players_aggregated_2014_td.csv';
export const ARCHIVE_SHA256='aa6b98bf396beef014c893d40e6352af0b03dc562aa0f82d56ff066acba09f0e';
// This revision was collected in September 2025: 2025/26 is only a partial
// snapshot, and 2026/27 is absent. Never publish either as a full-season rate.
export const LAST_COMPLETE_SEASON_START=2024;
const txt=x=>String(x??'').trim();
const chars={'Ø':'O','ø':'o','Ł':'L','ł':'l','Đ':'D','đ':'d','Ð':'D','ð':'d','Þ':'Th','þ':'th','Æ':'Ae','æ':'ae','Œ':'Oe','œ':'oe','ß':'ss'};
export const normalized=x=>txt(x).replace(/[ØøŁłĐđÐðÞþÆæŒœß]/g,ch=>chars[ch]||ch)
  .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const num=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const clubs={
 'psg':'paris saint germain','paris sg':'paris saint germain',
 'atletico de madrid':'atletico madrid','atletico madrid':'atletico madrid',
 'inter milan':'internazionale','inter':'internazionale',
 'rb leipzig':'rb leipzig','rasenballsport leipzig':'rb leipzig',
 'manchester utd':'manchester united','man utd':'manchester united',
 'spurs':'tottenham','tottenham hotspur':'tottenham'
};
const teamKey=x=>clubs[normalized(x)]||normalized(x);
const leagueKey=x=>{
 const n=normalized(x);
 if(['epl','premier league','english premier league'].includes(n))return 'epl';
 if(['la liga','laliga','la liga ea sports','la liga santander','la liga ea sports'].includes(n))return 'laliga';
 if(['bundesliga','german bundesliga'].includes(n))return 'bundesliga';
 if(['serie a','italian serie a'].includes(n))return 'seriea';
 if(['ligue 1','french ligue 1'].includes(n))return 'ligue1';
 if(['rfpl','russian premier league'].includes(n))return 'rfpl';
 return '';
};
const fullSeason=x=>{
 const m=/^(\d{4})\/(\d{2}|\d{4})$/.exec(txt(x));
 if(!m)return '';
 const start=Number(m[1]),end=Number(m[2]);
 return end===(start+1)%100||end===start+1?start+'/'+(start+1):'';
};
function cells(line){
 const out=[];let value='',quoted=false;
 for(let i=0;i<line.length;i++){
  const c=line[i];
  if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){out.push(value);value='';}
  else value+=c;
 }
 if(quoted)throw Error('Archivo Understat con CSV entrecomillado incompleto');
 out.push(value);return out;
}
export function readArchive(csv,playerName){
 if(typeof csv!=='string'||!csv.length||csv.length>11000000)throw Error('Tamaño del archivo Understat incorrecto');
 const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/);
 const headers=cells(lines[0]),required=['id','player_name','season','team_title','league','time','xGChain','xGBuildup'];
 if(required.some(k=>!headers.includes(k)))throw Error('Columnas Understat no reconocidas');
 const indices=Object.fromEntries(required.map(k=>[k,headers.indexOf(k)]));
 const sourceMetrics=['goals','assists','xG','xA','npxG','shots'];
 const metricIndices=Object.fromEntries(sourceMetrics.map(k=>[k,headers.indexOf(k)]));
 const players=new Map(),target=normalized(playerName);
 for(let i=1;i<lines.length;i++){
  if(!lines[i])continue;
  const values=cells(lines[i]);
  if(values.length!==headers.length)throw Error('Fila Understat inválida: '+i);
  if(normalized(values[indices.player_name])!==target)continue;
  const id=txt(values[indices.id]),season=fullSeason(values[indices.season]);
  if(!/^\d+$/.test(id)||!season)continue;
  const row={id,season,team:txt(values[indices.team_title]),
    league:leagueKey(values[indices.league]),minutes:num(values[indices.time]),
    chain:num(values[indices.xGChain]),buildup:num(values[indices.xGBuildup]),
    stats:Object.fromEntries(sourceMetrics.map(k=>[k,metricIndices[k]>=0?num(values[metricIndices[k]]):null]))};
  if(!players.has(id))players.set(id,[]);
  players.get(id).push(row);
 }
 return players;
}

// Replenish missing *league-only* STATS fields from the same verified archive.
// This never treats Understat totals as FotMob observations, and it never
// creates a player/season or assumes a club match based on name alone.
export function deriveStatsBackfill(players,stats){
 const identity=deriveRates(players,stats);
 if(identity.status!=='verified')return {status:identity.status,understat_id:null,entries:[],skipped:[]};
 const archive=players.get(identity.understat_id)||[];
 const labels=[['goals','Understat Goals'],['assists','Understat Assists'],
   ['xG','Understat xG'],['xA','Understat xA'],
   ['npxG','Understat npxG'],['shots','Understat Shots']];
 const counts=new Map();
 for(const source of archive){
  const scope=[source.season,source.league,teamKey(source.team)].join('|');
  counts.set(scope,(counts.get(scope)||0)+1);
 }
 const entries=[],skipped=[];
 for(const source of archive){
  if(!source.league||!source.season||Number(source.season.slice(0,4))>LAST_COMPLETE_SEASON_START)continue;
  const scope=[source.season,source.league,teamKey(source.team)].join('|');
  if(counts.get(scope)!==1){skipped.push({season:source.season,reason:'Registro de club duplicado en el archivo'});continue;}
  const found=stats.filter(s=>s.id&&s.season===source.season&&
   leagueKey(s.competition)===source.league&&teamKey(s.team_name)===teamKey(source.team)&&s.is_national_team!==true);
  if(found.length!==1){skipped.push({season:source.season,reason:'Club, liga o temporada sin vinculación única en STATS'});continue;}
  if(!(source.minutes>0)||source.chain===null||source.buildup===null||source.chain<0||source.buildup<0||source.buildup>source.chain){
   skipped.push({season:source.season,reason:'Observación Understat incompleta o incoherente'});continue;
  }
  const provenance={provider:'understat_archive',player_id:identity.understat_id,
    archive_url:ARCHIVE_URL,sha256:ARCHIVE_SHA256,scope:'league_team_season'};
  const metrics=[];
  for(const [field,name] of labels){
   const value=source.stats?.[field];
   if(value===null||value===undefined||!Number.isFinite(value)||value<0)continue;
   if(['goals','assists','shots'].includes(field)&&!Number.isInteger(value))continue;
   metrics.push({name,value,per90:value*90/source.minutes,unit:'total',
     source:'understat',source_url:ARCHIVE_URL,verification_status:'verified',provenance});
  }
  if(!metrics.length)continue;
  metrics.push({name:'Understat minutes',value:source.minutes,unit:'total',
    source:'understat',source_url:ARCHIVE_URL,verification_status:'verified',provenance});
  entries.push({id:found[0].id,season:source.season,
    competition:found[0].competition,team_name:found[0].team_name,
    metrics});
 }
 return {status:'verified',understat_id:identity.understat_id,entries,skipped};
}

export function deriveRates(players,stats){
 // Identity is accepted ONLY when source ID is unique AND at least two distinct
 // exact season + domestic competition + club matches exist in FotMob history.
 const results=[];
 for(const [id,archive] of players){
  const matched=[],invalid=[],bySeason=new Map();
  for(const row of archive){
   if(!row.league)continue;
   if(!bySeason.has(row.season))bySeason.set(row.season,[]);
   bySeason.get(row.season).push(row);
   const compatible=stats.filter(s=>s.season===row.season
    &&leagueKey(s.competition)===row.league&&teamKey(s.team_name)===teamKey(row.team)
    &&s.is_national_team!==true);
   if(compatible.length===1)matched.push(row);
   else if(compatible.length>1)invalid.push(row.season+' · '+row.team+' (varios registros)');
  }
  const identities=new Set(matched.map(r=>r.season+'|'+r.league+'|'+teamKey(r.team)));
  if(identities.size<2||invalid.length)continue;
  const rates=[],skipped=[];
  for(const [season,sourceRows] of bySeason){
   const start=Number(season.slice(0,4));
   if(start>LAST_COMPLETE_SEASON_START){
    skipped.push({season,reason:'Archivo histórico parcial o sin actualizar; no se inventan tasas de temporada completa'});
    continue;
   }
   const selected=sourceRows.filter(r=>matched.includes(r));
   const sourceKeys=sourceRows.map(r=>[r.season,r.league,teamKey(r.team)].join('|'));
   if(new Set(sourceKeys).size!==sourceKeys.length){
    skipped.push({season,reason:'El archivo contiene filas duplicadas del mismo club y liga'});continue;
   }
   if(selected.length!==sourceRows.length||!selected.length){
    skipped.push({season,reason:'Cobertura incompleta de clubes o competiciones; se conserva como pendiente'});
    continue;
   }
   if(selected.some(r=>!(r.minutes>0)||r.chain===null||r.buildup===null||r.chain<0||r.buildup<0||r.buildup>r.chain)){
    skipped.push({season,reason:'Minutos o métricas de Understat incompletos o inconsistentes'});
    continue;
   }
   const minutes=selected.reduce((sum,r)=>sum+r.minutes,0);
   const chain=selected.reduce((sum,r)=>sum+r.chain,0);
   const buildup=selected.reduce((sum,r)=>sum+r.buildup,0);
   rates.push({season,minutes,team_count:selected.length,
    xg_chain_p90:chain*90/minutes,xg_buildup_p90:buildup*90/minutes,
    xg_total:selected.every(r=>r.stats?.xG!==null&&r.stats?.xG!==undefined)?selected.reduce((n,r)=>n+r.stats.xG,0):null,
    xa_total:selected.every(r=>r.stats?.xA!==null&&r.stats?.xA!==undefined)?selected.reduce((n,r)=>n+r.stats.xA,0):null});
  }
  results.push({understat_id:id,matched:identities.size,rates,skipped});
 }
 if(results.length!==1)return {status:results.length?'ambiguous_identity':'insufficient_identity',matches:results.length,rates:[],skipped:[]};
 const hit=results[0];
 return {status:'verified',...hit};
}
