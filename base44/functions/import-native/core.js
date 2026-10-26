// Pure, provider-neutral port of the historic statistics normalizer.
// Does not fetch FotMob or any other third-party service.
const sourceSet=new Set(["fotmob","understat"]);
const trim=x=>String(x??"").trim();
const norm=x=>trim(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const aliases=new Map([
 ["total clearances","clearances"],["despejes","clearances"],["clearances","clearances"],
 ["successful tackles","tackles won"],["tackles won","tackles won"],
 ["interceptions","interceptions"],["intercepciones","interceptions"],
 ["shots blocked","blocked shots"],["blocked shots","blocked shots"]
]);
export const canonicalMetric=x=>aliases.get(norm(x))||norm(x);
export function parseNumber(value) {
 if(typeof value==="number")return Number.isFinite(value)?value:null;
 if(typeof value!=="string")return null;
 const s=value.trim().replace(/\u00a0/g," ").replace(/%$/,"").trim();
 if(!s||!/^[-+]?\d+(?:[.,]\d+)?$/.test(s))return null;
 const v=Number(s.replace(",","."));
 return Number.isFinite(v)?v:null;
}
export function normalizeMetric(raw,provider) {
 if(!raw||typeof raw!=="object")return null;
 const id=trim(raw.localizedTitleId||raw.name||raw.title);
 const key=canonicalMetric(id);
 if(!key || key==="rank" || key==="percentile")return null;
 const title=key==="clearances"?"Clearances":trim(raw.title||raw.name||id);
 const total=parseNumber(raw.statValue??raw.value??raw.total);
 const rate=parseNumber(raw.per90);
 // Distinguish an absent field from a genuine value of zero.
 if(total===null&&rate===null)return null;
 if(total!==null&&total<0||rate!==null&&rate<0)return null;
 const ratio=/percent|percentage|%/.test(norm(title))||trim(raw.statFormat)==="percent";
 if(ratio&&total!==null&&total>100)return null;
 const metric={name:title,source:provider,verification_status:"source_received"};
 if(total!==null)metric.value=total;
 if(rate!==null&&!ratio)metric.per90=rate;
 const percentile=parseNumber(raw.percentile??raw.percentileRank);
 if(percentile!==null && percentile>=0&&percentile<=100)metric.percentile=percentile;
 return metric;
}
export function readMetrics(root,provider,maxNodes=1500){
 const found=[],conflicts=[],byName=new Map();
 const stack=[root],seen=new WeakSet();let visited=0;
 while(stack.length&&visited<maxNodes){
  const cur=stack.pop();visited++;
  if(!cur||typeof cur!=="object")continue;
  if(seen.has(cur))continue;
  seen.add(cur);
  if(Array.isArray(cur)){for(let i=cur.length-1;i>=0;i--)stack.push(cur[i]);continue;}
  if(cur.localizedTitleId||cur.statValue!==undefined||cur.name&&("value" in cur||"per90" in cur)) {
   const m=normalizeMetric(cur,provider);
   if(m){
    const key=canonicalMetric(m.name);
    if(!byName.has(key))byName.set(key,m);
    else {
     const prior=byName.get(key);
     for(const part of ["value","per90"]){
      if(m[part]===undefined)continue;
      if(prior[part]===undefined)prior[part]=m[part];
      else if(prior[part]!==m[part])conflicts.push(key+":"+part);
     }
    }
   }
  }
  // Only inspect statistics, not shot events, market values, heatmaps etc.
  for(const [k,v] of Object.entries(cur)){
   if(["items","statsSection","topStatCard","stats","metrics","statistics","sections","groups"].includes(k)
      && v&&typeof v==="object")stack.push(v);
  }
 }
 const disputed=new Set(conflicts.map(s=>s.split(":")[0]));
 for(const [key,m] of byName)if(!disputed.has(key))found.push(m);
 return {metrics:found,conflicts:[...new Set(conflicts)],truncated:!!stack.length};
}
const seasonRe=/^(\d{4})(?:\/(\d{4}))?$/;
export function validateSeason(record,playerId,pid){
 if(!record||typeof record!=="object"||Array.isArray(record))throw Error("Registro no válido");
 const season=trim(record.season),match=seasonRe.exec(season);
 if(!match||match[2]&&Number(match[2])!==Number(match[1])+1)throw Error("Temporada incorrecta");
 const competition=trim(record.competition),team=trim(record.team_name);
 const tid=trim(record.fotmob_team_id);
 const provider=trim(record.provider).toLowerCase();
 if(!sourceSet.has(provider))throw Error("Fuente no admitida");
 if(!competition||competition.length>130||!team||team.length>130)throw Error("Falta liga o equipo");
 if(tid&&!/^\d{1,15}$/.test(tid))throw Error("ID equipo no válido");
 if(trim(record.fotmob_player_id)!==pid)throw Error("ID FotMob no coincide");
 const source_record_id=trim(record.source_record_id||record.profile_season_id);
 if(!source_record_id||source_record_id.length>180)throw Error("Registro sin origen identificable");
 const raw=record.statistics??record.payload??record.metrics??{};
 const summary=readMetrics(raw,provider);
 const direct=record.metrics&&Array.isArray(record.metrics)?readMetrics(record.metrics,provider):null;
 const metrics=direct?direct.metrics:summary.metrics;
 const conflicts=direct?direct.conflicts:summary.conflicts;
 const appearances=parseNumber(record.appearances);
 const minutes=parseNumber(record.minutes);
 const rating=parseNumber(record.rating);
 if(appearances!==null&&(appearances<0||!Number.isInteger(appearances)))throw Error("Partidos incorrectos");
 if(minutes!==null&&(minutes<0||!Number.isInteger(minutes)))throw Error("Minutos incorrectos");
 if(!metrics.length&&appearances===null&&minutes===null)throw Error("No contiene estadísticas de esta competición");
 const warnings=[];
 if(!tid)warnings.push("Falta ID numérico verificado del club; no se podrá aplicar sin resolverlo.");
 if(conflicts.length)warnings.push("Métricas descartadas por contradicción: "+conflicts.join(", "));
 if(summary.truncated)warnings.push("Estructura de estadísticas demasiado grande; análisis parcial.");
 const evidence=trim(record.evidence_url);
 if(evidence && (!/^https:\/\//.test(evidence)||evidence.length>650))throw Error("URL de evidencia no válida");
 return {player_id:playerId,fotmob_player_id:pid,provider,season,competition,
  fotmob_team_id:tid,team_name:team,source_competition_id:trim(record.source_competition_id),
  source_record_id,evidence_url:evidence,appearances,minutes,rating,
  metrics,warnings};
}
export function checkOverwrite(existing,candidate){
 const normalizeComp=norm;
 if(existing.player_id!==candidate.player_id||existing.season!==candidate.season)return false;
 const sameComp=normalizeComp(existing.competition)===normalizeComp(candidate.competition);
 const sameTeam=trim(existing.fotmob_team_id)&&trim(existing.fotmob_team_id)===trim(candidate.fotmob_team_id);
 return !!(sameComp&&sameTeam);
}
