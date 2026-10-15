// Manual changes are explicit, audited and never rewrite unrelated fields.
import {metricName} from "./compositeEngine.js";
const numeric=x=>x===null||x===undefined||x===""?null:
  Number.isFinite(Number(String(x).trim().replace(",",".")))?Number(String(x).trim().replace(",",".")):null;
const allowedFields=new Set(["rating","minutes","appearances"]);
const safeName=s=>String(s??"").trim();
export function applyManualStatChanges(record,changes){
 if(!Array.isArray(changes)||!changes.length)throw Error("No hay datos que guardar.");
 let current=record;
 for(const change of changes){
  const result=applyManualStatChange(current,change);
  current={...current,...result.update};
 }
 const update={};
 if(changes.some(c=>!c.field))update.metrics=current.metrics;
 for(const c of changes.filter(c=>c.field))update[c.field]=current[c.field];
 update.manual_metric_history=current.manual_metric_history;
 return {update};
}
export function applyManualStatChange(row,{name,value,sourceNote,field=null,changedAt}){
  if(!row?.id)throw Error("Selecciona una competición guardada y con ID.");
  const metric=safeName(name),note=safeName(sourceNote);
  if(!metric||metric.length>100)throw Error("El nombre de la estadística no es válido.");
  if(!note||note.length>500)throw Error("Indica la fuente o referencia del dato manual.");
  const number=numeric(value);
  if(number===null||Math.abs(number)>1e9)throw Error("Introduce un número válido y finito.");
  if(field!==null&&!allowedFields.has(field))throw Error("Este campo no admite edición manual.");
  if((field==="appearances"||field==="minutes") && (!Number.isInteger(number)||number<0))
    throw Error("Partidos y minutos deben ser enteros no negativos.");
  if(field==="rating" && (number<0||number>10))throw Error("La nota debe estar entre 0 y 10.");
  if(!field && metric.includes("%") && (number<0||number>100))
    throw Error("Un porcentaje debe estar entre 0 y 100.");
  if(!field && /(?:Understat minutes|duels won|duels contested)$/i.test(metric)
    && (!Number.isInteger(number)||number<0))throw Error("Este recuento debe ser un entero no negativo.");
  const previous=Array.isArray(row.metrics)?row.metrics:[];
  const old=field?numeric(row[field]):
    numeric(previous.find(m=>metricName(m.name)===metricName(metric))?.value);
  if(old===number)throw Error("El valor ya coincide con el registrado.");
  const audit={
    metric_name:field?"$field:"+field:metric,
    old_value:old,
    new_value:number,
    source_note:note,
    changed_at:changedAt||new Date().toISOString(),
  };
  const history=[...(Array.isArray(row.manual_metric_history)?row.manual_metric_history:[]),audit];
  if(field)return {update:{[field]:number,manual_metric_history:history},audit};
  const copy=previous.map(m=>({...m}));
  const idx=copy.findIndex(m=>metricName(m.name)===metricName(metric));
  if(idx>=0){
    copy[idx]={...copy[idx],value:number,per90:null,percentile:null};
  }else copy.push({name:metric,value:number,per90:null,percentile:null});
  return {update:{metrics:copy,manual_metric_history:history},audit};
}
