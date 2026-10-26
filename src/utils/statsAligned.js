// Cálculo de fórmulas de temporada con cobertura alineada por competición.
// Cada variable y los minutos del denominador proceden del MISMO grupo de partidos.
import {metricsValue,statNum} from "./statsViews.js";

export function alignedFormulaInputs(records,variables){
 const ids=[...new Set(variables)];
 const eligible=[],excluded=[];
 for(const row of records||[]){
  const values={};
  let valid=true;
  for(const id of ids){
   const n=id==="rating"||id==="minutes"?statNum(row[id]):metricsValue(row,id);
   if(n===null||!Number.isFinite(n)){valid=false;break;}
   if((id==="minutes"||id==="team_matches")&&n<=0){valid=false;break;}
   values[id]=n;
  }
  (valid?eligible:excluded).push({row,values});
 }
 const totals={};
 for(const id of ids)totals[id]=eligible.reduce((sum,e)=>sum+e.values[id],0);
 return {totals,eligible,excluded,available:eligible.length,total:(records||[]).length,minutes:eligible.reduce((sum,e)=>sum+(statNum(e.row.minutes)||0),0)};
}
