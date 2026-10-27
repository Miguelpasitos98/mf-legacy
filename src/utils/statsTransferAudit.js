import {RAW_METRICS,initialConfig,columnValue} from "./statsColumns.js";
import {normalizedMetricKey} from "./metricKey.js";
import {seasonActive} from "./statsViews.js";

const COLUMN_IDS=RAW_METRICS.map(([id])=>id);
const RATE_PAIRS=[["goals","goalsper90"],["assists","assistsper90"],["xg","xgper90"],["xa","xaper90"],["goals_prevented","calc_goals_prevented_p90"]];
const numeric=v=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?null:Number(v);
const identity=row=>[row.player_name||row.player_id||"",row.season||"",row.competition||""].join(" · ");

export function auditStatsTransfer(records,{includeCurrent=false,now=new Date(),maxExamples=60}={}){
 const config=initialConfig();
 const totals={rows:0,metrics:0,visibleValues:0,notRepresented:0,unreadable:0,
   ratesPresent:0,ratesVisible:0,ratesHidden:0,missingMinutes:0,minutesAsMetric:0,
   currentExcluded:0};
 const issues=new Map();
 const add=(type,name,row,extra="")=>{
  const key=type+"|"+name;
  if(!issues.has(key))issues.set(key,{type,metric:name,count:0,examples:[]});
  const item=issues.get(key);item.count++;
  if(item.examples.length<4&&totals.rows<=maxExamples*100)item.examples.push(identity(row)+(extra?" · "+extra:""));
 };
 for(const row of records||[]){
  if(!includeCurrent&&seasonActive(row.season,now)){totals.currentExcluded++;continue;}
  totals.rows++;
  const metrics=Array.isArray(row.metrics)?row.metrics:[];
  if(numeric(row.minutes)===null){totals.missingMinutes++;if(metrics.some(m=>normalizedMetricKey(m.name)==="minutes"))totals.minutesAsMetric++;}
  for(const metric of metrics){
   if(numeric(metric.value)===null&&numeric(metric.per90)===null)continue;
   totals.metrics++;
   const matches=COLUMN_IDS.filter(id=>normalizedMetricKey(id)===normalizedMetricKey(metric.name));
   // Some aliases (e.g. Goals prevented) are represented by a calculated
   // default column and are not literally named like the source field.
   const readable=COLUMN_IDS.filter(id=>{
    const n=columnValue(row,"competition",id,config);
    return n!==null&&normalizedMetricKey(id)===normalizedMetricKey(metric.name);
   });
   const special=normalizedMetricKey(metric.name)==="goalsprevented";
   if(!matches.length&&!special){totals.notRepresented++;add("no_column",metric.name,row);}
   else if(!special&&!readable.length&&numeric(metric.value)!==null){
    totals.unreadable++;add("not_readable",metric.name,row);
   }else totals.visibleValues++;
  }
  for(const [name,id] of RATE_PAIRS){
   const target=metrics.find(m=>normalizedMetricKey(m.name)===normalizedMetricKey(name==="goals_prevented"?"Goals prevented":name));
   const rate=numeric(target?.per90);
   if(rate===null)continue;
   totals.ratesPresent++;
   const shown=columnValue(row,"competition",id,config);
   if(shown===null){totals.ratesHidden++;add("rate_hidden",target.name,row,"/90="+rate);}
   else totals.ratesVisible++;
  }
 }
 const items=[...issues.values()].sort((a,b)=>b.count-a.count||a.metric.localeCompare(b.metric));
 return {totals,issues:items,counts:{issueTypes:items.length,unmappedNames:items.filter(x=>x.type==="no_column").length}};
}
