// MF LEGACY — historical peer comparison, independent of FotMob percentile columns.
// This module never writes data, and never uses external provider percentiles.
// Population: one season per player, all club competitions, same current-position archetype.
import { groupStatRows, nationalCompetition } from "./statsViews.js";
import { metricName, WEIGHTS_BY_ROLE, calculateCompositeMF } from "./compositeEngine.js";
import {ballSecurityFromRecords} from "./ballSecurity.js";
import {createPossessionLookup,possessionAdjustedDefActions} from "./teamPossession.js";
import {calculateExperimentalFallback} from "./experimentalFallback.js";
import { canonicalHistoricalCompetition } from "./historicalJson.js";
import { seasonReferencePosition, normalizeHistoricalPosition } from "./historicalPositions.js";

const num = value => value === "" || value === null || value === undefined ||
  !Number.isFinite(Number(value)) ? null : Number(value);
const str = value => String(value ?? "").trim();
const round2 = value => Math.round((value + Number.EPSILON) * 100) / 100;
// Position in Base44 uses FM26 normalized codes (DC, DFC, EI, ED, CDM, ...).
const ROLE_POSITIONS = {
  ST: new Set(["ST","STC","CF","DC","DEL","STRIKER"]),
  W: new Set(["W","RW","LW","RM","LM","ED","EI","AMR","AML","MIR","MIL"]),
  CAM: new Set(["CAM","AM","AMC","MPC","MP","MCO"]),
  CM: new Set(["CM","MC","MCI","MCD","MCR","CRI","CRD"]),
  DM: new Set(["DM","DMC","CDM","MCDDEF","MDF"]),
  WB: new Set(["WB","RWB","LWB","CAD","CAI"]),
  FB: new Set(["FB","RB","LB","DR","DL","LD","LI"]),
  CB: new Set(["CB","DFC","DCB","DCL","DCR"]),
  GK: new Set(["GK","POR","G"]),
};
export function historicalRole(position) {
  const code=str(position).toUpperCase().replace(/\s+/g,"");
  for (const [role,codes] of Object.entries(ROLE_POSITIONS)) if (codes.has(code)) return role;
  return null;
}

const PER90 = {
  npxg_p90:["xG excl. penalty","Non-penalty xG","np xG","npxG"],
  xg_chain_p90:["xG Chain","xGChain"],
  xa_p90:["xA","Expected assists"],
  xgot_p90:["xGOT"],
  xg_buildup_p90:["xG Buildup","xGBuildup"],
  shots_on_target_p90:["Shots on target"],
  big_chances_created_p90:["Big chances created"],
  possession_won_final_3rd_p90:["Possession won final 3rd"],
  accurate_long_balls_p90:["Accurate long balls"],
  successful_dribbles_p90:["Dribbles","Successful dribbles"],
  dispossessed_p90:["Dispossessed"],
  dribbled_past_p90:["Dribbled past"],
  goals_prevented_p90:["Goals prevented"],
  accurate_passes_p90:["Accurate passes"],
  def_actions_poss_adj_p90:["PAdj defensive actions","Possession adjusted defensive actions","PAdj Defensive Actions"],
};
const PERCENTAGE = {
  aerial_duels_won_pct:["Aerials won %","Aerial duels won %"],
  ground_duels_won_pct:["Ground duels won %","Ground duels success rate"],
  save_pct:["Save percentage","Save %","Saves %"],
};
const pickMetric=(row,names)=>{
  const index=new Map((row.metrics||[]).filter(m=>m?.name).map(m=>[metricName(m.name),m]));
  for(const name of names){
    const m=index.get(metricName(name));
    if(m && num(m.value)!==null) return m;
  }
  return null;
};
const metricTotal=(row,names)=>{
  const m=pickMetric(row,names);
  if(!m)return null;
  const minutes=num(row.minutes);
  // If a source stores a metric named "/90", convert it back to a total
  // so that season-wide /90 uses aligned minutes rather than mean of rates.
  if(/(?:\/90|per[\s_-]?90)$/i.test(m.name)){
    const amount=num(m.value);
    return minutes>0 ? amount*minutes/90 : null;
  }
  return num(m.value);
};
const alignedPer90=(records,names,minutesSource=null)=>{
  let amount=0, minutes=0, count=0;
  for(const row of records){
    // Understat totals MUST use Understat minutes, never FotMob minutes.
    const candidate=pickMetric(row,names);
    // Understat-only totals must be divided by Understat minutes even when
    // FotMob lists a different duration for the same competition.
    const understat=candidate?.source==="Understat";
    const mins=understat
      ?(num(candidate.provider_minutes)??num(pickMetric(row,["Understat minutes"])?.value))
      :minutesSource?num(pickMetric(row,[minutesSource])?.value):num(row.minutes);
    const value=metricTotal(row,names);
    if(mins===null || mins<=0 || value===null)continue;
    amount+=value;minutes+=mins;count++;
  }
  return minutes>0 && count>0 ? amount*90/minutes : null;
};
const groundDuelPercentage=records=>{
  let won=0,contested=0;
  for(const row of records){
    const w=num(pickMetric(row,["Ground duels won"])?.value);
    const c=num(pickMetric(row,["Ground duels contested"])?.value);
    if(w===null||c===null||!Number.isInteger(w)||!Number.isInteger(c)||c<=0||w<0||w>c)continue;
    won+=w;contested+=c;
  }
  // Do not calculate a simple mean of percentages or weight them by minutes.
  return contested>0 ? won/contested*100 : null;
};
const pairedFinishing=(records)=>{
  let diff=0,minutes=0;
  for(const row of records){
    const mins=num(row.minutes);
    const a=metricTotal(row,PER90.xgot_p90),b=metricTotal(row,PER90.npxg_p90);
    if(mins===null||mins<=0||a===null||b===null)continue;
    diff+=a-b;minutes+=mins;
  }
  return minutes>0?diff*90/minutes:null;
};
const weightedPct=(records,names)=>{
  let sum=0,mins=0;
  for(const row of records){
    const value=pickMetric(row,names);
    const m=num(row.minutes),v=num(value?.value);
    if(m===null||m<=0||v===null||v<0||v>100)continue;
    sum+=v*m;mins+=m;
  }
  return mins>0 ? sum/mins : null;
};
const weightedRating=records=>{
  let sum=0,total=0;
  for(const row of records){
    const rating=num(row.rating)??num(pickMetric(row,["Rating"])?.value);
    const matches=num(row.appearances);
    if(rating===null||matches===null||matches<=0)continue;
    sum+=rating*matches;total+=matches;
  }
  return total>0?sum/total:null;
};
const matchesKey=(r, id)=>id+"|"+r.season+"|"+canonicalHistoricalCompetition(r.competition);
const safeTeamMatches=(row, lookup)=>{
  const candidates=[
    row.team_id && matchesKey(row,str(row.team_id)),
    row.fotmob_team_id && matchesKey(row,str(row.fotmob_team_id)),
  ].filter(Boolean);
  const fromLookup=candidates.map(k=>lookup.get(k)).filter(v=>v!==undefined);
  if(fromLookup.some(v=>v===null))return null; // conflicting shared records
  if(new Set(fromLookup).size>1)return null;
  const resolved=fromLookup[0]??num(row.team_matches);
  return resolved!==null && resolved>0 ? resolved : null;
};
function teamMatchesLookup(matches=[]){
  const map=new Map();
  for(const row of matches){
    const n=num(row.team_matches);
    if(n===null||n<=0)continue;
    for(const id of [row.team_id,row.fotmob_team_id].map(str).filter(Boolean)){
      const key=matchesKey(row,id);
      if(!map.has(key))map.set(key,n);
      else if(map.get(key)!==n)map.set(key,null);
    }
  }
  return map;
}
const playShare=(records, lookup)=>{
  let mins=0,denominator=0;
  for(const r of records){
    const m=num(r.minutes),tm=safeTeamMatches(r,lookup);
    if(m===null||m<0||tm===null)continue;
    mins+=m;denominator+=tm*90;
  }
  return denominator>0?mins/denominator*100:null;
};
const valKey=(playerId,season)=>playerId+"|"+season;
// Historical club-only comparisons must also exclude competitions whose
// short name (EURO) or youth category is not caught by the generic filter.
export const historicalNationalCompetition = name => {
  const x=String(name??"").toLowerCase().replace(/[^a-z0-9]/g,"");
  return nationalCompetition(name) ||
    /^euro(?:$|u\d{2}|qualification)/.test(x) ||
    /^(uefau\d{2}championship|uefaeuropeanchampionship|africacupofnations)$/.test(x);
};
export function buildHistoricalObservations({stats=[],players=[],valuations=[],teamMatches=[],teams=[],teamPossessions=[]}={}){
  const byPlayer=new Map(players.filter(p=>p?.id).map(p=>[str(p.id),p]));
  const valueMaps=new Map();
  for(const v of valuations){
    if(!v?.player_id || !v?.season)continue;
    const key=valKey(str(v.player_id),str(v.season));
    if(!valueMaps.has(key))valueMaps.set(key,[]);
    valueMaps.get(key).push(v);
  }
  const tmLookup=teamMatchesLookup(teamMatches);
  const getPossession=createPossessionLookup(teamPossessions,teams);
  const groups=new Map();
  for(const r of groupStatRows(stats).filter(r=>r?.season && !historicalNationalCompetition(r.competition))){
    const id=str(r.player_id);
    if(!id || !byPlayer.has(id))continue; // exact Base44 Player ID only
    const key=valKey(id,str(r.season));
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(r);
  }
  const observations=[];
  for(const [key,records] of groups){
    const player=byPlayer.get(str(records[0].player_id));
    const seasonValuations=valueMaps.get(key);
    // La posición histórica efectiva decide el arquetipo de esta temporada:
    // corrección por competición > corrección de temporada > posición FIFA >
    // respaldo provisional. Nunca se inventa una posición FIFA.
    const valuation=seasonValuations?.length===1?seasonValuations[0]:null;
    const fallback=normalizeHistoricalPosition(player?.position||player?.position_raw);
    let position=seasonReferencePosition({
      valuation,competitions:records.map(r=>r.competition),fallback,
    });
    let role=historicalRole(position.position);
    if(!role && position.source!=="fallback" && fallback){
      position={position:fallback,source:"fallback",mixed:position.mixed};
      role=historicalRole(fallback);
    }
    if(!role)continue;
    const values={rating:weightedRating(records),finishing_xgot_minus_npxg:pairedFinishing(records),
      play_share:playShare(records,tmLookup)};
    for(const [metric,names] of Object.entries(PER90))
      values[metric]=alignedPer90(records,names,
        metric==="xg_chain_p90"||metric==="xg_buildup_p90"?"Understat minutes":null);
    // Prefer a complete, verified source PAdj series if it already exists;
    // otherwise calculate our own 50%-possession-normalised metric.
    // Never combine an adjusted numerator with missing minutes/competitions.
    const hasDirectPAdj=records.every(r=>num(r.minutes)>0&&metricTotal(r,PER90.def_actions_poss_adj_p90)!==null);
    values.def_actions_poss_adj_p90=hasDirectPAdj
      ?alignedPer90(records,PER90.def_actions_poss_adj_p90)
      :possessionAdjustedDefActions(records,metricTotal,getPossession);
    for(const [metric,names] of Object.entries(PERCENTAGE))
      values[metric]=metric==="ground_duels_won_pct"
        ? groundDuelPercentage(records) : weightedPct(records,names);
    // Ball Security is a derived percentage; do not use partial competitor
    // coverage as if it represented a complete player-season.
    const security=ballSecurityFromRecords(records,metricTotal);
    values.ball_security=["W","CAM","FB","WB"].includes(role)&&!security.partial?security.value:null;
    // Never fall back to seasonless FC/Transfermarkt or snapshot CraftedFC fields.
    values.fc27_ovr=valuation?num(valuation.fifa_fc_overall):null;
    values.market_value=valuation?num(valuation.transfermarkt_value_eur):null;
    observations.push({
      key,playerId:str(player.id),playerName:player.name||records[0].player_name||"",
      season:str(records[0].season),role,values,
      position:position.position,positionSource:position.source,positionMixed:Boolean(position.mixed),
      pAdjMethod:hasDirectPAdj?"provider_imported":values.def_actions_poss_adj_p90!==null?"mf_possession_50_experimental":"missing",
      minutes:records.reduce((n,r)=>n+Math.max(0,num(r.minutes)||0),0),
      competitions:records.length,
    });
  }
  return observations;
}
// Excel-style midrank: 0 for sole minimum, 100 for sole maximum; ties share rank.
// Each player-season, including the target, is exactly one observation.
export function historicalPercentile(value, peers) {
  if(num(value)===null)return null;
  const valid=peers.map(num).filter(v=>v!==null);
  const n=valid.length;
  if(n<2)return null;
  const lower=valid.filter(v=>v<value).length;
  const ties=valid.filter(v=>v===value).length;
  if(!ties)return null; // must actually belong to the population
  return round2(100*(lower+(ties-1)/2)/(n-1));
}
export function compareHistoricalObservation(observation,observations,minimum=10){
  if(!observation)return null;
  const role=observation.role;
  const peers=observations.filter(r=>r.role===role);
  const keys=WEIGHTS_BY_ROLE[role] ?
    [...Object.keys(WEIGHTS_BY_ROLE[role]),"rating"] :
    [...new Set(peers.flatMap(p=>Object.keys(p.values)))];
  const items=keys.map(key=>{
    const current=num(observation.values[key]);
    const eligible=peers.filter(p=>num(p.values[key])!==null);
    const values=eligible.map(p=>num(p.values[key]));
    const nPlayers=new Set(eligible.map(p=>p.playerId)).size;
    // A history with 11 seasons from one footballer does not establish a
    // cross-player percentile, regardless of the number of observations.
    const percentile=current!==null && nPlayers>=2?historicalPercentile(current,values):null;
    const penalty=(WEIGHTS_BY_ROLE[role]?.[key]||0)<0;
    // Position among historical SEASONS (not distinct players).
    // In negative-weight metrics fewer losses means a better place.
    // Equal values share the same place (competition rank).
    const rank=percentile===null?null:1+values.filter(v=>penalty?v<current:v>current).length;
    return {
      key,value:current,percentile,n:values.length,nPlayers,rank,
      provisional:percentile!==null && nPlayers<minimum,
      status:current===null?"no_value":percentile===null?"insufficient":nPlayers<minimum?"provisional":"ready",
      // Negative weights are signed: more losses -> higher raw percentile -> larger deduction.
      penalty,
    };
  });
  const percentiles=Object.fromEntries(items.map(r=>[r.key,r.percentile]));
  const calc=WEIGHTS_BY_ROLE[role]
    ? calculateCompositeMF({metrics:[]},role,percentiles,null)
    : null;
  const rows=items.map(item=>{
    const result=calc?.rows.find(r=>r.key===item.key);
    const rawContribution=result?.contribution??null;
    return {...item,weight:result?.weight??null,contribution:Object.is(rawContribution,-0)?0:rawContribution,
      name:result?.name||item.key};
  });
  // Do not rank a mostly empty season as world-class just because the single
  // available metric (typically play share) happens to have a high percentile.
  if(calc && calc.score!==null && (calc.count<3 || calc.coverage<25)){
    calc.score=null;
    calc.status="insufficient_coverage";
  }
  const experimentalFallback=WEIGHTS_BY_ROLE[role]?calculateExperimentalFallback(role,percentiles):null;
  return {role,playerId:observation.playerId,season:observation.season,
    population:peers.length,players:new Set(peers.map(p=>p.playerId)).size,
    rows,composite:calc,experimentalFallback,method:"Percentiles históricos MF LEGACY por posición (rango medio de empates)."};
}