// Consolidación coherente con los indicadores reales de MF Legacy Studio.
// No se suman porcentajes y los minutos Understat nunca se sustituyen con los FotMob.
const numeric = v => v===null||v===undefined||v===""||!Number.isFinite(Number(v))?null:Number(v);
const key = s => String(s||"").toLowerCase().replace(/%/g,"percent").replace(/[^a-z0-9]/g,"");
const metric = (record,name) => numeric((record.metrics||[]).find(m=>key(m.name)===key(name))?.value);
const metricPer90 = (record,name) => numeric((record.metrics||[]).find(m=>key(m.name)===key(name))?.per90);
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
    const chainRate=metric(r,"xG Chain /90")??metricPer90(r,"xG Chain /90")??metricPer90(r,"xG Chain"),buildupRate=metric(r,"xG Buildup /90")??metricPer90(r,"xG Buildup /90")??metricPer90(r,"xG Buildup");
    const scopedPublished=name=>(r.metrics||[]).some(m=>key(m.name)===key(name)&&m.provenance?.provider==='craftedfc_understat'&&m.provenance?.scope==='league_team_season'&&m.provenance?.rate_kind==='published_per90'&&r.season&&(r.fotmob_team_id||r.team_id)&&r.fotmob_tournament_id);
    if(chainRate!==null)directChain.push({rate:chainRate,minutes:mins,scoped:scopedPublished('xG Chain /90')});
    else if(mins>0&&xgc!==null&&xgc>=0)directChain.push({rate:xgc*90/mins,minutes:mins});
    if(buildupRate!==null)directBuildup.push({rate:buildupRate,minutes:mins,scoped:scopedPublished('xG Buildup /90')});
    else if(mins>0&&xgb!==null&&xgb>=0&&(xgc===null||xgb<=xgc))directBuildup.push({rate:xgb*90/mins,minutes:mins});
    const won=metric(r,"Ground duels won"), total=metric(r,"Ground duels contested");
    if(won!==null&&total!==null&&Number.isInteger(won)&&Number.isInteger(total)&&total>0&&won>=0&&won<=total){
      duelsWon+=won;duelsTotal+=total;duelRows++;
    }
  }
  const rate=(seasonRate,direct,total,minutes,rows)=>{
    if(seasonRate!==null)return seasonRate;
    if(direct.length===1&&records.length===1)return direct[0].rate;
    if(direct.length===1&&direct[0].scoped)return direct[0].rate;
    if(direct.length){
      // A multi-competition /90 requires aligned denominators; never average rates.
      // Unsupported cups/nationals have no Understat row: retain the covered
      // league rate and its coverage, without borrowing those matches' minutes.
      if(direct.some(r=>!(r.minutes>0)))return null;
      const sumMinutes=direct.reduce((acc,r)=>acc+r.minutes,0);
      return direct.reduce((acc,r)=>acc+r.rate*r.minutes,0)/sumMinutes;
    }
    return rows&&minutes>0?total*90/minutes:null;
  };
  return {
    xg_chain_p90:rate(seasonChain,directChain,chain,chainMinutes,chainRows),
    xg_buildup_p90:rate(seasonBuildup,directBuildup,buildup,buildupMinutes,buildupRows),
    ground_duels_won_pct:duelRows&&duelsTotal>0?duelsWon*100/duelsTotal:null,
    understatRows:Math.max(chainRows,directChain.filter(r=>r.scoped).length),buildupRows:Math.max(buildupRows,directBuildup.filter(r=>r.scoped).length),duelRows,understatMinutes:chainMinutes,duelsWon,duelsTotal,
    totalRows:records.length
  };
}
