const validDate=date=>/^\\d{4}-\\d{2}-\\d{2}$/.test(String(date||""))&&!Number.isNaN(Date.parse(date));
export function historicalMarketChartRows(valuations=[]){
 const byDate=new Map();
 for(const row of valuations||[]){
  const eur=Number(row.transfermarkt_value_eur);
  if(row.transfermarkt_value_eur===null||row.transfermarkt_value_eur===undefined||!Number.isFinite(eur)||eur<0)continue;
  const season=String(row.season||"");
  const match=/^(\\d{4})\\/(\\d{4})$/.exec(season);
  // The season end is a display proxy, never a claimed Transfermarkt quote date.
  const date=validDate(row.market_value_as_of)?row.market_value_as_of:match?match[2]+"-06-30":null;
  if(!date)continue;
  const value=eur/1000000;
  const old=byDate.get(date);
  // Prefer a dated quote over an undated season-end proxy.
  const exact=validDate(row.market_value_as_of);
  if(!old||(!old.exact&&exact))byDate.set(date,{date,value,team:"",club_id:"",exact});
 }
 return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date))
  .map(({date,value,team,club_id})=>({date,value,team,club_id}));
}
