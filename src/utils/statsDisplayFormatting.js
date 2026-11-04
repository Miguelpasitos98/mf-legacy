import {getColumn,isGoalsAssistsCountColumn} from "./statsColumns.js";

// The same value policy applies to season and competition tables. This
// presentation layer never changes sources, aggregates, sorting or Composite.
const EXPECTED_TOTALS=new Set([
 "xg","xa","xgot","xgexclpenalty","xgagainstwhileonpitch",
 "psxgot_against","xgchain","xgbuildup","goals_prevented"
]);
const RATE_COLUMNS=new Set([
 "goalsper90","assistsper90","gaper90","xgper90","xaper90",
 "xgaper90","savesper90","calc_xgchainper90","calc_xgbuildupper90",
 "calc_goals_prevented_p90"
]);
const DECIMAL_TOTALS=new Set(["xga","calc_goals_prevented"]);
const PERCENT_ONE=new Set([
 "playpct","passaccuracy","longballaccuracy","crossaccuracy",
 "dribblessuccessrate","duelswonvariante2","aerialswonvariante2"
]);
const PERCENT_TWO=new Set(["calc_groundduelspct"]);
const GOALKEEPER_OFFENSE=new Set([
 "goals","assists","ga","gaper90","goalsper90","assistsper90",
 "xg","xa","xga","xgper90","xaper90","xgaper90",
 "shots","shotsontarget","chancescreated","bigchancescreated"
]);
const isEmpty=value=>value===null||value===undefined||value===""||
 !Number.isFinite(Number(value));

export function isStatsGoalkeeper(player){
 return /^(GK|POR|G)$/i.test(String(player?.position||player?.position_raw||"").trim());
}
export function statsDisplayDigits(columnId,config){
 const id=String(columnId||"");
 // User formulas retain their chosen precision. Built-in metrics and
 // physical count/rate types are consistent even in older saved layouts.
 if(!EXPECTED_TOTALS.has(id)&&!RATE_COLUMNS.has(id)&&
    !DECIMAL_TOTALS.has(id)&&!PERCENT_ONE.has(id)&&!PERCENT_TWO.has(id)&&
    id!=="rating"&&id!=="topspeed"&&id!=="ga"){
  const col=getColumn(config,id);
  if(col?.kind==="computed")return Math.max(0,Math.min(4,Number(col.decimals)||0));
  return 0;
 }
 if(PERCENT_ONE.has(id)||id==="topspeed")return 1;
 if(PERCENT_TWO.has(id))return 2;
 if(id==="ga")return 0;
 return 2;
}
export function formatStatsTableValue(value,columnId,config,{goalkeeper=false,partial=false}={}){
 const id=String(columnId||"");
 const decimals=statsDisplayDigits(id,config);
 const visualZero=isEmpty(value)&&(
  goalkeeper&&GOALKEEPER_OFFENSE.has(id)||
  id==="penaltygoals"||
  isGoalsAssistsCountColumn(id,config)
 );
 const supplied=!isEmpty(value);
 if(!supplied&&!visualZero)return {text:"—",suffix:"",visualZero:false,
  partial:false,decimals,unit:"",title:"Dato no disponible; no equivale a cero."};
 const number=supplied?Number(value):0;
 const rounded=Number(number.toFixed(decimals));
 const threshold=1/(10**decimals);
 const belowPrecision=supplied&&number!==0&&rounded===0;
 const formatted=belowPrecision?(number>0?"<"+threshold.toLocaleString("es-ES",{
   minimumFractionDigits:decimals,maximumFractionDigits:decimals
  }):">−"+threshold.toLocaleString("es-ES",{
   minimumFractionDigits:decimals,maximumFractionDigits:decimals
  })):
  (Object.is(rounded,-0)?0:number).toLocaleString("es-ES",{
   minimumFractionDigits:decimals,maximumFractionDigits:decimals
  });
 const col=getColumn(config,id);
 const unit=col?.unit|| (PERCENT_ONE.has(id)||PERCENT_TWO.has(id)?"%":"");
 const title=visualZero?"Cero solo visual: estadística ausente. No se guarda como cero ni se utiliza en las fórmulas o el Composite.":
  [
   belowPrecision?"Dato real no nulo: "+String(number)+". Se indica el umbral en lugar de redondear a un cero engañoso.":null,
   partial?"Subtotal parcial: faltan estadísticas de alguna competición.":null
  ].filter(Boolean).join(" ")||undefined;
 return {text:formatted,suffix:visualZero?"†":partial?"*":"",visualZero,
  partial:!visualZero&&Boolean(partial),decimals,unit:supplied?unit:"",
  title};
}
