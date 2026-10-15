// Consolidación coherente con los indicadores reales de MF Legacy Studio.
// No se suman porcentajes y los minutos Understat nunca se sustituyen con los FotMob.
const numeric = v => v===null||v===undefined||v===""||!Number.isFinite(Number(v))?null:Number(v);
const key = s => String(s||"").toLowerCase().replace(/%/g,"percent").replace(/[^a-z0-9]/g,"");
const metric = (record,name) => numeric((record.metrics||[]).find(m=>key(m.name)===key(name))?.value);
export function advancedTotals(records=[]){
  let chain=0,buildup=0,chainMinutes=0,buildupMinutes=0,chainRows=0,buildupRows=0,duelsWon=0,duelsTotal=0,duelRows=0;
  for(const r of records){
    const mins=metric(r,"Understat minutes"), xgc=metric(r,"xG Chain"), xgb=metric(r,"xG Buildup");
    // The two metrics may be supplied independently. Use paired source minutes
    // for each, but never imply missing Buildup is zero.
    if(mins!==null&&mins>0&&xgc!==null&&xgc>=0){chainMinutes+=mins;chain+=xgc;chainRows++;}
    if(mins!==null&&mins>0&&xgb!==null&&xgb>=0 && (xgc===null||xgb<=xgc)){
      buildupMinutes+=mins;buildup+=xgb;buildupRows++;
    }
    const won=metric(r,"Ground duels won"), total=metric(r,"Ground duels contested");
    if(won!==null&&total!==null&&Number.isInteger(won)&&Number.isInteger(total)&&total>0&&won>=0&&won<=total){
      duelsWon+=won;duelsTotal+=total;duelRows++;
    }
  }
  return {
    xg_chain_p90:chainRows&&chainMinutes>0?chain*90/chainMinutes:null,
    xg_buildup_p90:buildupRows&&buildupMinutes>0?buildup*90/buildupMinutes:null,
    ground_duels_won_pct:duelRows&&duelsTotal>0?duelsWon*100/duelsTotal:null,
    understatRows:chainRows,buildupRows,duelRows,understatMinutes:chainMinutes,duelsWon,duelsTotal,
    totalRows:records.length
  };
}
