// Consolidación coherente con los indicadores reales de MF Legacy Studio.
// No se suman porcentajes y los minutos Understat nunca se sustituyen con los FotMob.
const numeric = v => v===null||v===undefined||v===""||!Number.isFinite(Number(v))?null:Number(v);
const key = s => String(s||"").toLowerCase().replace(/%/g,"percent").replace(/[^a-z0-9]/g,"");
const metric = (record,name) => numeric((record.metrics||[]).find(m=>key(m.name)===key(name))?.value);
export function advancedTotals(records=[],{includeSeasonRates=true}={}){
  const seasons=new Set(records.map(r=>r.season));
  const clubs=new Set(records.map(r=>String(r.team_id||r.fotmob_team_id||r.team_name||"").trim()).filter(Boolean));
  const seasonRates=includeSeasonRates&&seasons.size===1&&clubs.size<=1?records.map(r=>({chain:metric(r,"xG Chain season /90"),buildup:metric(r,"xG Buildup season /90")})):[];
  const seasonChain=seasonRates.find(r=>r.chain!==null)?.chain??null;
  const seasonBuildup=seasonRates.find(r=>r.buildup!==null)?.buildup??null;
  let chain=0,buildup=0,chainMinutes=0,buildupMinutes=0,chainRows=0,buildupRows=0,duelsWon=0,duelsTotal=0,duelRows=0;
  const directChain=[],directBuildup=[];
  for(const r of records){
    const mins=metric(r,"Understat minutes"), xgc=metric(r,"xG Chain"), xgb=metric(r,"xG Buildup");
    // The two metrics may be supplied independently. Use paired source minutes
    // for each, but never imply missing Buildup is zero.
    if(mins!==null&&mins>0&&xgc!==null&&xgc>=0){chainMinutes+=mins;chain+=xgc;chainRows++;}
    if(mins!==null&&mins>0&&xgb!==null&&xgb>=0 && (xgc===null||xgb<=xgc)){
      buildupMinutes+=mins;buildup+=xgb;buildupRows++;
    }
    const chainRate=metric(r,"xG Chain /90"),buildupRate=metric(r,"xG Buildup /90");
    if(chainRate!==null)directChain.push({rate:chainRate,minutes:mins});
    if(buildupRate!==null)directBuildup.push({rate:buildupRate,minutes:mins});
    const won=metric(r,"Ground duels won"), total=metric(r,"Ground duels contested");
    if(won!==null&&total!==null&&Number.isInteger(won)&&Number.isInteger(total)&&total>0&&won>=0&&won<=total){
      duelsWon+=won;duelsTotal+=total;duelRows++;
    }
  }
  const rate=(seasonRate,direct,total,minutes,rows)=>{
    if(seasonRate!==null)return seasonRate;
    if(direct.length===1&&records.length===1)return direct[0].rate;
    if(direct.length){
      // A multi-competition /90 requires aligned denominators; never average rates.
      if(direct.length!==records.length||direct.some(r=>!(r.minutes>0)))return null;
      const sumMinutes=direct.reduce((acc,r)=>acc+r.minutes,0);
      return direct.reduce((acc,r)=>acc+r.rate*r.minutes,0)/sumMinutes;
    }
    return rows&&minutes>0?total*90/minutes:null;
  };
  return {
    xg_chain_p90:rate(seasonChain,directChain,chain,chainMinutes,chainRows),
    xg_buildup_p90:rate(seasonBuildup,directBuildup,buildup,buildupMinutes,buildupRows),
    ground_duels_won_pct:duelRows&&duelsTotal>0?duelsWon*100/duelsTotal:null,
    understatRows:chainRows,buildupRows,duelRows,understatMinutes:chainMinutes,duelsWon,duelsTotal,
    totalRows:records.length
  };
}
