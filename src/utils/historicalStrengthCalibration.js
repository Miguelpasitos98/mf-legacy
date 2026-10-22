// Experimental calibration of club/league strength against REAL historical CraftedFC ratings.
// No invented strength scales, coefficients, historical joins or "official" claims.
// This module is independent of Composite MF Legacy and never persists calculated ratings.
const finite = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
const key = v => String(v ?? "").trim();
const seasonKey = v => {
  const s=key(v).replace(/[-–]/g,"/"); const m=s.match(/^(\d{4})\/(\d{2}|\d{4})$/);
  if (!m) return s;
  const start=Number(m[1]), end=Number(m[2])<100?Math.floor(start/100)*100+Number(m[2]):Number(m[2]);
  return end===start+1?`${start}/${end}`:s;
};
const id = row => key(row?.team_id || row?.fotmob_team_id || row?.club_id);
const strength = (row,field) => finite(row?.[field] ?? row?.[field==="club_strength"?"team_strength":"league_strength"]);
export const STRENGTH_CALIBRATION_VERSION="mf-strength-calibration-v1-experimental";

// Explicit identifier and season only: no fuzzy names or accidental reuse of current snapshots.
export function createHistoricalStrengthLookup(rows=[]) {
  const byKey=new Map(), conflicts=[];
  for(const row of rows) {
    const team=id(row),season=seasonKey(row?.season);
    const league=key(row?.league_id || row?.competition_id);
    const club=strength(row,"club_strength"), competition=strength(row,"league_strength");
    if(!team||!season||!league||club===null||competition===null)continue;
    const k=[team,season,league].join("|");
    if(byKey.has(k)) {
      const old=byKey.get(k);
      if(old.club_strength!==club||old.league_strength!==competition) {byKey.set(k,null);conflicts.push(k);}
    } else byKey.set(k,{club_strength:club,league_strength:competition});
  }
  return {get({team_id,fotmob_team_id,club_id,season,league_id,competition_id}={}) {
    const team=key(team_id||fotmob_team_id||club_id),league=key(league_id||competition_id);
    const record=byKey.get([team,seasonKey(season),league].join("|"));
    return record||null;
  },size:[...byKey.values()].filter(Boolean).length,conflicts:[...new Set(conflicts)]};
}

// A label must be explicitly scoped to a player, season and position; an undated
// snapshot is NOT a historical training example.
export function buildStrengthCalibrationSamples({observations=[],strengthRows=[],referenceRatings=[]}={}) {
  const lookup=createHistoricalStrengthLookup(strengthRows);
  const references=new Map(),duplicates=new Set();
  for(const r of referenceRatings) {
    const k=[key(r.player_id),seasonKey(r.season),key(r.role)].join("|");
    if(!r.player_id||!r.season||!r.role||finite(r.rating)===null)continue;
    if(references.has(k))duplicates.add(k);
    references.set(k,finite(r.rating));
  }
  const samples=[],excluded={no_reference:0,ambiguous_reference:0,no_strength:0,no_base_score:0};
  for(const o of observations) {
    const k=[key(o.playerId||o.player_id),seasonKey(o.season),key(o.role)].join("|");
    if(duplicates.has(k)){excluded.ambiguous_reference++;continue;}
    if(!references.has(k)){excluded.no_reference++;continue;}
    // A strength value cannot be joined from several clubs/leagues without
    // their distinct minutes: require caller-provided, proven single-season context.
    const clubId=o.team_id||o.club_id, leagueId=o.league_id||o.competition_id;
    const s=lookup.get({team_id:clubId,season:o.season,league_id:leagueId});
    if(!s){excluded.no_strength++;continue;}
    const base=finite(o.baseScore??o.base_score);
    if(base===null||base<0||base>100){excluded.no_base_score++;continue;}
    samples.push({playerId:key(o.playerId||o.player_id),season:seasonKey(o.season),role:key(o.role),
      baseScore:base,club_strength:s.club_strength,league_strength:s.league_strength,
      rating:references.get(k)});
  }
  return {samples,excluded,strengthConflicts:lookup.conflicts};
}

function solve(a,b) {
  const n=b.length,m=a.map((r,i)=>[...r,b[i]]);
  for(let j=0;j<n;j++) {
    let pivot=j;for(let i=j+1;i<n;i++)if(Math.abs(m[i][j])>Math.abs(m[pivot][j]))pivot=i;
    if(Math.abs(m[pivot][j])<1e-10)return null;
    [m[j],m[pivot]]=[m[pivot],m[j]];
    const d=m[j][j];for(let k=j;k<=n;k++)m[j][k]/=d;
    for(let i=0;i<n;i++)if(i!==j){const f=m[i][j];for(let k=j;k<=n;k++)m[i][k]-=f*m[j][k];}
  }
  return m.map(r=>r[n]);
}
function fit(rows,lambda=1) {
  // Center strength variables using TRAINING data only; ridge for stability.
  const mean=k=>rows.reduce((s,r)=>s+r[k],0)/rows.length;
  const center={club_strength:mean("club_strength"),league_strength:mean("league_strength")};
  const features=r=>[1,r.baseScore,r.club_strength-center.club_strength,r.league_strength-center.league_strength];
  const a=Array.from({length:4},()=>[0,0,0,0]),b=[0,0,0,0];
  for(const r of rows) {
    const x=features(r);
    for(let i=0;i<4;i++){b[i]+=x[i]*r.rating;for(let j=0;j<4;j++)a[i][j]+=x[i]*x[j];}
  }
  for(let i=1;i<4;i++)a[i][i]+=lambda;
  const coefficients=solve(a,b);
  return coefficients?{coefficients,center,predict:r=>features(r).reduce((s,x,i)=>s+x*coefficients[i],0)}:null;
}
const measure=(rows,predict)=> {
  const errors=rows.map(r=>predict(r)-r.rating);
  return {n:rows.length,mae:errors.reduce((s,e)=>s+Math.abs(e),0)/rows.length,
    rmse:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/rows.length)};
};
// Group holdout by player to prevent a player's seasons leaking into train/test.
// This is an experiment, NEVER label output as CraftedFC's exact rating.
export function calibrateHistoricalStrength(samples=[],{minimumPlayers=20,minimumTestPlayers=5,lambda=1}={}) {
  const clean=samples.filter(r=>key(r.playerId)&&["ST","W","CM","CAM","GK","CB","FB","WB"].includes(r.role)&&
    [r.baseScore,r.club_strength,r.league_strength,r.rating].every(v=>finite(v)!==null)&&r.rating>=0&&r.rating<=100);
  const byRole={};
  for(const role of [...new Set(clean.map(r=>r.role))]) {
    const rows=clean.filter(r=>r.role===role);
    const players=[...new Set(rows.map(r=>r.playerId))].sort();
    if(players.length<minimumPlayers) {byRole[role]={status:"insufficient_players",players:players.length,required:minimumPlayers};continue;}
    const testCount=Math.max(minimumTestPlayers,Math.floor(players.length/5));
    if(players.length-testCount<5){byRole[role]={status:"insufficient_training_data"};continue;}
    const testIds=new Set(players.filter((_,i)=>i%players.length<testCount));
    const train=rows.filter(r=>!testIds.has(r.playerId)),test=rows.filter(r=>testIds.has(r.playerId));
    const model=fit(train,lambda);
    if(!model){byRole[role]={status:"singular_model"};continue;}
    const baseline=measure(test,r=>r.baseScore),calibrated=measure(test,r=>model.predict(r));
    byRole[role]={status:"experimental_validated_holdout",trainPlayers:new Set(train.map(r=>r.playerId)).size,
      testPlayers:new Set(test.map(r=>r.playerId)).size,baseline,calibrated,
      improvesMAE:calibrated.mae<baseline.mae,coefficients:model.coefficients,
      trainingCenters:model.center,warning:"Modelo empírico, no fórmula oficial de CraftedFC."};
  }
  return {version:STRENGTH_CALIBRATION_VERSION,byRole};
}
