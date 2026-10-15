// Consolidación coherente con los indicadores reales de MF Legacy Studio.
// No se suman porcentajes y los minutos Understat nunca se sustituyen con los FotMob.
const numeric = v => v===null||v===undefined||v===""||!Number.isFinite(Number(v))?null:Number(v);
const key = s => String(s||"").toLowerCase().replace(/%/g,"percent").replace(/[^a-z0-9]/g,"");
const metric = (record,name) => numeric((record.metrics||[]).find(m=>key(m.name)===key(name))?.value);
export function advancedTotals(records=[]){
  let chain=0,buildup=0,understatMinutes=0,chainRows=0,duelsWon=0,duelsTotal=0,duelRows=0;
  for(const r of records){
    const mins=metric(r,"Understat minutes"), xgc=metric(r,"xG Chain"), xgb=metric(r,"xG Buildup");
    if(mins!==null&&mins>0&&xgc!==null&&xgb!==null&&xgc>=0&&xgb>=0&&xgb<=xgc){
      understatMinutes+=mins;chain+=xgc;buildup+=xgb;chainRows++;
    }
    const won=metric(r,"Ground duels won"), total=metric(r,"Ground duels contested");
    if(won!==null&&total!==null&&Number.isInteger(won)&&Number.isInteger(total)&&total>0&&won>=0&&won<=total){
      duelsWon+=won;duelsTotal+=total;duelRows++;
    }
  }
  return {
    xg_chain_p90:chainRows&&understatMinutes>0?chain*90/understatMinutes:null,
    xg_buildup_p90:chainRows&&understatMinutes>0?buildup*90/understatMinutes:null,
    ground_duels_won_pct:duelRows&&duelsTotal>0?duelsWon*100/duelsTotal:null,
    understatRows:chainRows,duelRows,understatMinutes,duelsWon,duelsTotal,
    totalRows:records.length
  };
}
