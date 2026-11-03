import {normalizedMetricKey} from "./metricKey.js";
const num=v=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?null:Number(v);
const provider=m=>String(m?.source||m?.provenance?.provider||"").toLowerCase();
export const isUnderstatMetric=m=>provider(m).includes("understat")||/^understat\b/i.test(m?.name||"");
export function metricMinutes(row,metric){
  const own=num(metric?.provider_minutes)??num(metric?.provenance?.provider_minutes);
  if(own>0)return own;
  const name=isUnderstatMetric(metric)?"Understat minutes":provider(metric).includes("fotmob")?"FotMob minutes":null;
  const clock=name?(row.metrics||[]).find(m=>normalizedMetricKey(m.name)===normalizedMetricKey(name)):null;
  if(num(clock?.value)>0)return num(clock.value);
  // An Understat numerator must never silently inherit FotMob's clock.
  return isUnderstatMetric(metric)?null:num(row.minutes);
}
export function selectSourceMetric(row,names,{allowRateOnly=false}={}){
  const metrics=Array.isArray(row?.metrics)?row.metrics:[];
  const candidates=[];
  for(const [alias,name] of names.entries()){
    for(const m of metrics){
      const rateLabel=normalizedMetricKey(m.name)===normalizedMetricKey(name+" /90");
      if(!rateLabel&&normalizedMetricKey(m.name)!==normalizedMetricKey(name))continue;
      if(num(m.value)===null&&(!allowRateOnly||num(m.per90)===null))continue;
      const manual=provider(m).includes("manual")||String(m.verification_status||"").includes("manual");
      const priority=manual?0:isUnderstatMetric(m)?2:1;
      candidates.push({m,priority,alias,rateLabel});
    }
  }
  candidates.sort((a,b)=>a.priority-b.priority||a.alias-b.alias||Number(b.rateLabel)-Number(a.rateLabel));
  const best=candidates[0];
  if(!best)return null;
  const same=candidates.filter(c=>c.priority===best.priority&&c.alias===best.alias&&c.rateLabel===best.rateLabel);
  if(same.some(c=>num(c.m.value)!==num(best.m.value)||num(c.m.per90)!==num(best.m.per90)))return null;
  return best.m;
}
export function metricNumerator(row,metric,minutes=metricMinutes(row,metric)){
  if(!metric)return null;
  if(/(?:\/\s*90|per[\s_-]?90)$/i.test(metric.name))return minutes>0&&num(metric.value)!==null?num(metric.value)*minutes/90:null;
  const total=num(metric.value);
  return total!==null?total:minutes>0&&num(metric.per90)!==null?num(metric.per90)*minutes/90:null;
}
