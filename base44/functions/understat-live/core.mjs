// Direct Understat HTTP data adapter. No persistence or guessed player identity here.
export const LEAGUES = Object.freeze({
  EPL: "Premier League", La_Liga: "LaLiga", Bundesliga: "Bundesliga",
  Serie_A: "Serie A", Ligue_1: "Ligue 1", RFPL: "Russian Premier League"
});
const txt = v => String(v ?? "").trim();
const num = v => v === "" || v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null;
export const norm = v => txt(v).replace(/[ØøŁłĐđÐðÞþÆæŒœß]/g, ch => ({
  "Ø":"O","ø":"o","Ł":"L","ł":"l","Đ":"D","đ":"d","Ð":"D","ð":"d",
  "Þ":"Th","þ":"th","Æ":"Ae","æ":"ae","Œ":"Oe","œ":"oe","ß":"ss"
})[ch] || ch).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clubs = {
  "atletico de madrid":"atletico madrid","atletico madrid":"atletico madrid",
  "fc barcelona":"barcelona","barcelona fc":"barcelona",
  "real madrid cf":"real madrid","villarreal cf":"villarreal",
  "valencia cf":"valencia","fc bayern munich":"bayern munich",
  "manchester utd":"manchester united","man utd":"manchester united",
  "tottenham hotspur":"tottenham","spurs":"tottenham",
  "psg":"paris saint germain","paris sg":"paris saint germain",
  "internazionale":"inter","inter milan":"inter",
  "rasenballsport leipzig":"rb leipzig"
};
const teamKey = v => clubs[norm(v)] || norm(v);
const leagues = {
  "epl":"EPL","premier league":"EPL","english premier league":"EPL",
  "la liga":"La_Liga","laliga":"La_Liga","la liga ea sports":"La_Liga","la liga santander":"La_Liga","primera division":"La_Liga",
  "bundesliga":"Bundesliga","serie a":"Serie_A","italian serie a":"Serie_A",
  "ligue 1":"Ligue_1","rfpl":"RFPL","russian premier league":"RFPL"
};
const competition = v => leagues[norm(v)] || null;
export function seasonLabel(start){
  const y=Number(start);
  if(!Number.isInteger(y) || y<2014 || y>2100) return null;
  return y+"/"+(y+1);
}
export function validateSelection(league, season){
  const y=Number(season);
  if(!Object.hasOwn(LEAGUES,league)||!Number.isInteger(y)||y<2014||y>new Date().getUTCFullYear())throw Error("Liga o temporada no permitida");
  return String(y);
}
export function leaguePlayersFromJson(payload){
  const rows = payload?.players;
  if(!Array.isArray(rows)||!rows.length||rows.length>3000)throw Error("Understat no ha devuelto una lista de jugadores válida");
  const parsed = rows.map(r => {
    const id=txt(r?.id),name=txt(r?.player_name),minutes=num(r?.time);
    if(!/^\d{1,15}$/.test(id)||!name||!Number.isFinite(minutes)||minutes<0)return null;
    const chain=num(r?.xGChain),buildup=num(r?.xGBuildup);
    return {understat_id:id, name, team:txt(r?.team_title), minutes,
      xg_chain_p90:chain!==null&&minutes>0?chain*90/minutes:null,
      xg_buildup_p90:buildup!==null&&minutes>0?buildup*90/minutes:null};
  }).filter(Boolean);
  if(!parsed.length)throw Error("Understat ha devuelto jugadores sin datos identificables");
  return parsed;
}
export function playerSeasonsFromJson(payload){
  const rows=payload?.groups?.season;
  if(!Array.isArray(rows)||rows.length>100)throw Error("El historial individual de Understat no tiene el formato esperado");
  return rows.map(r=>{
    const season=seasonLabel(r?.season),team=txt(r?.team),minutes=num(r?.time);
    if(!season||!team)return null;
    return {season,team,minutes,chain:num(r?.xGChain),buildup:num(r?.xGBuildup),
      xg:num(r?.xG),xa:num(r?.xA)};
  }).filter(Boolean);
}
const fullSeasonsOnly = season => Number(season.slice(0,4))<new Date().getUTCFullYear();
export function reconcilePlayer({league, season, playerName, leaguePlayers, providerSeasons, fotmobSeasons}){
  const label=seasonLabel(season);
  const found=leaguePlayers.filter(p=>norm(p.name)===norm(playerName));
  if(found.length!==1)return {status:found.length?"ambiguous_identity":"no_player",reason:found.length?"Coinciden varios IDs Understat con el mismo nombre.":"El jugador no aparece con nombre exacto en esta liga y temporada."};
  const identity=found[0],matches=[],skipped=[],bySeason=new Map();
  const records=fotmobSeasons.filter(s=>s?.is_national_team!==true&&txt(s?.season)&&competition(s?.competition));
  for(const row of providerSeasons){
    const key=row.season+"|"+teamKey(row.team);
    if(!bySeason.has(row.season))bySeason.set(row.season,[]);
    bySeason.get(row.season).push(row);
    const compatible=records.filter(s=>s.season===row.season&&teamKey(s.team_name)===teamKey(row.team));
    if(compatible.length===1)matches.push({row,season:row.season,team:row.team,league:competition(compatible[0].competition)});
    if(compatible.length>1)skipped.push({season:row.season,reason:"Club y temporada duplicados en STATS"});
  }
  const anchors=matches.filter(m=>m.season===label&&m.league===league);
  const distinct = new Set(matches.filter(m=>fullSeasonsOnly(m.season)).map(m=>m.season+"|"+teamKey(m.team)));
  if(anchors.length!==1||distinct.size<2||skipped.length){
    return {status:"insufficient_identity",understat_id:identity.understat_id,
      matches:distinct.size,reason:"Se necesitan al menos dos temporadas o clubes confirmados en STATS, incluyendo la liga y temporada consultadas. No se ha guardado nada.",skipped};
  }
  const rates=[];
  for(const [year,rows] of bySeason){
    if(!fullSeasonsOnly(year)){skipped.push({season:year,reason:"Temporada en curso; no se guardan tasas globales parciales"});continue;}
    const keys=rows.map(r=>teamKey(r.team));
    if(new Set(keys).size!==keys.length){skipped.push({season:year,reason:"Registros duplicados por club en Understat"});continue;}
    const covered=rows.every(r=>matches.some(m=>m.row===r));
    if(!covered){skipped.push({season:year,reason:"No hay cobertura exacta de todos los equipos en STATS"});continue;}
    if(rows.some(r=>!(r.minutes>0)||r.chain===null||r.buildup===null||r.chain<0||r.buildup<0||r.buildup>r.chain)){
      skipped.push({season:year,reason:"Faltan minutos o datos válidos de Chain/Buildup"});continue;
    }
    const minutes=rows.reduce((a,r)=>a+r.minutes,0);
    const chain=rows.reduce((a,r)=>a+r.chain,0);
    const buildup=rows.reduce((a,r)=>a+r.buildup,0);
    const xg=rows.every(r=>r.xg!==null)?rows.reduce((a,r)=>a+r.xg,0):null;
    const xa=rows.every(r=>r.xa!==null)?rows.reduce((a,r)=>a+r.xa,0):null;
    rates.push({season:year,minutes,team_count:rows.length,
      xg_chain_p90:chain*90/minutes,xg_buildup_p90:buildup*90/minutes,xg_total:xg,xa_total:xa});
  }
  return {status:"verified",understat_id:identity.understat_id,
    name:identity.name,matches:distinct.size,rates,skipped,
    source_url:"https://understat.com/player/"+identity.understat_id};
}
