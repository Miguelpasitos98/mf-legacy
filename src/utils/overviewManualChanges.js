import {metricName} from "./compositeEngine.js";
const num=value=>{
 if(value===null||value===undefined||String(value).trim()==="")return null;
 const n=Number(String(value).trim().replace(",","."));
 return Number.isFinite(n)?n:null;
};
const valueOf=(row,name,field=null)=>field?num(row[field]):
 num((row.metrics||[]).find(m=>metricName(m.name)===metricName(name))?.value);
const SIMPLE={
 goals:{name:"Goals"},assists:{name:"Assists"},xg:{name:"xG"},xa:{name:"xA"},
 shots:{name:"Shots"},appearances:{name:"Partidos",field:"appearances"},
 minutes:{name:"Minutos",field:"minutes"},rating:{name:"Nota FotMob",field:"rating"}
};
export const MANUAL_CARD_TITLES={
 ...Object.fromEntries(Object.entries(SIMPLE).map(([key,item])=>[key,item.name])),
 chain:"xG Chain /90",buildup:"xG Buildup /90",ground:"Duelos terrestres ganados (%)",other:"Otra estadística"
};
const integer=(n,label)=>{if(!Number.isInteger(n)||n<0)throw Error(label+" debe ser entero y no negativo.");};
function valid(value,label){
 const n=num(value);
 if(n===null||n<0||n>1e9)throw Error("Introduce un valor válido y no negativo para "+label+".");
 return n;
}
export function createOverviewManualChanges(record,mode,form,note){
 if(!record?.id)throw Error("Selecciona un registro guardado y con ID.");
 const sourceNote=String(note||"").trim()||"Registro manual";
 if(sourceNote.length>500)throw Error("La referencia de la fuente es demasiado larga.");
 let entries=[];
 if(SIMPLE[mode]){
  const {name,field=null}=SIMPLE[mode];
  const value=valid(form.value,name);
  if(["goals","assists","shots","appearances","minutes"].includes(mode))integer(value,name);
  if(mode==="rating"&&value>10)throw Error("La nota FotMob debe estar entre 0 y 10.");
  entries=[{name,field,value}];
 }else if(mode==="chain"||mode==="buildup"){
  const label=mode==="chain"?"xG Chain":"xG Buildup";
  const minutes=valid(form.sourceMinutes,"Minutos Understat");
  integer(minutes,"Minutos Understat");
  if(minutes<=0)throw Error("Los minutos Understat deben ser mayores que cero.");
  const entered=valid(form.value,label);
  const total=form.unit==="per90"?entered*minutes/90:entered;
  const otherName=mode==="chain"?"xG Buildup":"xG Chain";
  const otherValue=valueOf(record,otherName);
  if((mode==="buildup"&&otherValue!==null&&total>otherValue+1e-8)||
     (mode==="chain"&&otherValue!==null&&otherValue>total+1e-8))
     throw Error("xG Buildup no puede superar xG Chain para la misma competición. Revisa la fuente y los minutos.");
  const provenance=form.unit==="per90"?sourceNote+" · Total derivado de valor /90 introducido y minutos de la misma fuente":sourceNote;
  entries=[{name:label,value:total,sourceNote:provenance},{name:"Understat minutes",value:minutes}];
 }else if(mode==="ground"){
  const won=valid(form.won,"Duelos terrestres ganados");
  const contested=valid(form.contested,"Duelos terrestres disputados");
  integer(won,"Duelos ganados");integer(contested,"Duelos disputados");
  if(contested<=0||won>contested)throw Error("Los duelos disputados deben ser positivos e iguales o superiores a los ganados.");
  entries=[
   {name:"Ground duels won",value:won},
   {name:"Ground duels contested",value:contested},
   {name:"Ground duels won %",value:won*100/contested}
  ];
 }else if(mode==="other"){
  const name=String(form.name||"").trim();
  if(!name||name.length>100)throw Error("Introduce el nombre de la estadística.");
  if(["xgchain","xgbuildup","xgchain90","xgbuildup90","groundduelswonpercent"].includes(metricName(name)))
   throw Error("Para estas métricas utiliza su tarjeta específica, que valida también los denominadores.");
  const value=valid(form.value,name);
  if(name.includes("%")&&value>100)throw Error("Un porcentaje debe estar entre 0 y 100.");
  entries=[{name,value}];
 }else throw Error("Tipo de estadística no reconocido.");
 const changes=entries.filter(entry=>valueOf(record,entry.name,entry.field)!==entry.value)
  .map(entry=>({...entry,sourceNote:entry.sourceNote||sourceNote}));
 if(!changes.length)throw Error("Los valores ya coinciden con los guardados.");
 return changes;
}