import test from "node:test";
import assert from "node:assert/strict";
import { historicalRole, historicalNationalCompetition, buildHistoricalObservations, historicalPercentile, compareHistoricalObservation } from "../src/utils/historicalPeers.js";

const players=[
  {id:"h",name:"Haaland",position:"DC"},
  {id:"k",name:"Kane",position:"DC"},
  {id:"s",name:"Salah",position:"ED"},
  {id:"x",name:"Rodri",position:"CDM"},
  {id:"c",name:"Defensa",position:"DFC"},
];
const record=(player_id,season,competition,minutes,metric,amount,extras={})=>({
  player_id,season,competition,minutes,
  appearances:10,rating:8,
  metrics:[{name:metric,value:amount,per90:999,percentile:100}],...extras,
});
test("traduce las posiciones reales de MF LEGACY sin equiparar delantero, extremo o MCD",()=>{
  assert.equal(historicalRole("DC"),"ST");
  assert.equal(historicalRole("ED"),"W");
  assert.equal(historicalRole("EI"),"W");
  assert.equal(historicalRole("DFC"),"CB");
  assert.equal(historicalRole("CDM"),"DM");
  assert.equal(historicalRole("GK"),"GK");
  assert.equal(historicalRole("xyz"),null);
});
test("dos competiciones de la misma temporada forman una observación con minutos alineados",()=>{
  const stats=[
    record("h","2022/2023","Premier League",900,"xG excl. penalty",8),
    record("h","2022/2023","Champions League",450,"xG excl. penalty",2),
    record("k","2022/2023","Premier League",900,"xG excl. penalty",5),
    record("s","2022/2023","Premier League",900,"xG excl. penalty",10),
  ];
  const observations=buildHistoricalObservations({stats,players});
  assert.equal(observations.length,3);
  const h=observations.find(v=>v.playerId==="h");
  assert.equal(h.competitions,2);
  assert.equal(h.values.npxg_p90,10*90/1350);
  assert.equal(h.role,"ST");
  assert.equal(observations.find(v=>v.playerId==="s").role,"W");
  assert.equal(observations.find(v=>v.playerId==="h").values.market_value,null);
});
test("valores faltantes no se convierten en cero y no se utilizan los percentiles FotMob",()=>{
  const stats=[
    record("h","2022/2023","Premier League",900,"xA",2),
    record("k","2022/2023","Premier League",900,"xA",0),
  ];
  const o=buildHistoricalObservations({stats,players});
  const h=o.find(x=>x.playerId==="h");
  assert.equal(h.values.npxg_p90,null);
  assert.equal(h.values.xa_p90,.2);
  assert.equal(o.find(x=>x.playerId==="k").values.xa_p90,0);
  const result=compareHistoricalObservation(h,o);
  assert.equal(result.rows.find(r=>r.key==="npxg_p90").percentile,null);
  assert.equal(result.rows.find(r=>r.key==="xa_p90").percentile,100);
  assert.equal(result.rows.find(r=>r.key==="xa_p90").provisional,true);
  assert.equal(result.population,2);
});
test("xG Chain y xG Buildup usan minutos Understat y no los de FotMob",()=>{
 const stats=[
  {player_id:"h",season:"2022/2023",competition:"Premier League",minutes:2000,
   metrics:[{name:"xG Chain",value:20},{name:"xG Buildup",value:6},{name:"Understat minutes",value:1000}]},
  {player_id:"h",season:"2022/2023",competition:"Champions League",minutes:900,
   metrics:[{name:"xA",value:1}]},
 ];
 const o=buildHistoricalObservations({stats,players})[0];
 assert.equal(o.values.xg_chain_p90,1.8);
 assert.equal(o.values.xg_buildup_p90,0.54);
});
test("Ground duels % agrega ganados/disputados, no promedio porcentual",()=>{
 const stats=[
  {player_id:"h",season:"2022/2023",competition:"Premier League",minutes:1800,
   metrics:[{name:"Ground duels won",value:11},{name:"Ground duels contested",value:28},{name:"Ground duels won %",value:39.2857}]},
  {player_id:"h",season:"2022/2023",competition:"Champions League",minutes:450,
   metrics:[{name:"Ground duels won",value:9},{name:"Ground duels contested",value:12},{name:"Ground duels won %",value:75}]},
 ];
 const o=buildHistoricalObservations({stats,players})[0];
 assert.equal(o.values.ground_duels_won_pct,50);
});
test("Porcentaje de duelos sin recuentos no se inventa",()=>{
 const stats=[
  {player_id:"h",season:"2022/2023",competition:"Premier League",minutes:900,
   metrics:[{name:"Ground duels won %",value:88}]}
 ];
 assert.equal(buildHistoricalObservations({stats,players})[0].values.ground_duels_won_pct,null);
});

test("una sola observación no genera falso percentil 100",()=>{
  assert.equal(historicalPercentile(.7,[.7]),null);
});
test("empates usan el promedio de las posiciones",()=>{
  assert.equal(historicalPercentile(2,[1,2,2,4]),50);
  assert.equal(historicalPercentile(4,[1,2,2,4]),100);
  assert.equal(historicalPercentile(1,[1,2,2,4]),0);
  assert.equal(historicalPercentile(2,[2,2]),50);
});
test("estadísticas internacionales quedan excluidas de los agregados de clubes",()=>{
 const stats=[record("h","2022/2023","Premier League",900,"xA",2),record("h","2022/2023","World Cup",500,"xA",900)];
 const o=buildHistoricalObservations({stats,players});
 assert.equal(o[0].values.xa_p90,.2);
});
test("excluye EURO y campeonatos juveniles de selecciones, manteniendo Europa League de clubes",()=>{
  assert.equal(historicalNationalCompetition("EURO"),true);
  assert.equal(historicalNationalCompetition("UEFA U19 Championship"),true);
  assert.equal(historicalNationalCompetition("EURO Qualification qualification"),true);
  assert.equal(historicalNationalCompetition("Europa League"),false);
  const rows=[
    record("h","2024/2025","Serie A",900,"xA",2),
    record("h","2024/2025","EURO",300,"xA",30),
    record("h","2024/2025","UEFA U19 Championship",400,"xA",20),
  ];
  const o=buildHistoricalObservations({stats:rows,players});
  assert.equal(o[0].values.xa_p90,.2);
});

test("no concede percentil ni aportación de FC si las 12 temporadas son del mismo jugador",()=>{
  const seasons=Array.from({length:12},(_,i)=>String(2014+i));
  const stats=seasons.map((season,i)=>record("h",season,"Premier League",900,"xA",1+i));
  const valuations=seasons.map((season,i)=>({player_id:"h",season,fifa_fc_overall:75+i,transfermarkt_value_eur:1000000*(i+1)}));
  const observations=buildHistoricalObservations({stats,players,valuations});
  const out=compareHistoricalObservation(observations[11],observations);
  const fc=out.rows.find(r=>r.key==="fc27_ovr");
  const market=out.rows.find(r=>r.key==="market_value");
  assert.equal(fc.n,12);
  assert.equal(fc.nPlayers,1);
  assert.equal(fc.percentile,null);
  assert.equal(fc.contribution,null);
  assert.equal(market.percentile,null);
  assert.equal(market.contribution,null);
});

test("con dos jugadores ST, los percentiles son calculables pero provisionales",()=>{
  const stats=[record("h","2022/2023","Premier League",900,"xA",4),
    record("k","2022/2023","Premier League",900,"xA",2)];
  const o=buildHistoricalObservations({stats,players});
  const peer=compareHistoricalObservation(o[0],o);
  const m=peer.rows.find(r=>r.key==="xa_p90");
  assert.equal(m.percentile,100);
  assert.equal(m.nPlayers,2);
  assert.equal(m.provisional,true);
});

test("valores FC y Transfermarkt solo de la misma temporada por player_id",()=>{
 const stats=[record("h","2022/2023","Premier League",900,"xA",2)];
 const valuations=[
  {player_id:"h",season:"2022/2023",fifa_fc_overall:88,transfermarkt_value_eur:180000000},
  {player_id:"h",season:"2021/2022",fifa_fc_overall:99,transfermarkt_value_eur:999},
 ];
 const o=buildHistoricalObservations({stats,players,valuations})[0];
 assert.equal(o.values.fc27_ovr,88);
 assert.equal(o.values.market_value,180000000);
});
test("duplicados en datos históricos no eligen aleatoriamente valores",()=>{
 const stats=[record("h","2022/2023","Premier League",900,"xA",2)];
 const valuations=[
  {player_id:"h",season:"2022/2023",fifa_fc_overall:88},
  {player_id:"h",season:"2022/2023",fifa_fc_overall:90},
 ];
 const o=buildHistoricalObservations({stats,players,valuations})[0];
 assert.equal(o.values.fc27_ovr,null);
});
test("una penalización mayor corresponde a mayor valor bruto de pérdidas",()=>{
 const stats=[
  record("h","2022/2023","Premier League",900,"Dispossessed",20),
  record("k","2022/2023","Premier League",900,"Dispossessed",2),
 ];
 const observations=buildHistoricalObservations({stats,players});
 const a=compareHistoricalObservation(observations[0],observations);
 const b=compareHistoricalObservation(observations[1],observations);
 assert.equal(a.rows.find(r=>r.key==="dispossessed_p90").contribution,-1);
 assert.equal(b.rows.find(r=>r.key==="dispossessed_p90").contribution,0);
});
test("Play Share requiere PJ Equipo conocido y utiliza equipo/temporada/competición",()=>{
 const stats=[
  record("h","2022/2023","Premier League",900,"xA",2,{team_id:"city",team_matches:null}),
  record("k","2022/2023","Premier League",900,"xA",2),
 ];
 const teamMatches=[{team_id:"city",season:"2022/2023",competition:"Premier League",team_matches:20}];
 const obs=buildHistoricalObservations({stats,players,teamMatches});
 assert.equal(obs.find(r=>r.playerId==="h").values.play_share,50);
 assert.equal(obs.find(r=>r.playerId==="k").values.play_share,null);
});
test("DM obtiene percentiles por posición pero no Composite sin ponderación propia",()=>{
 const stats=[record("x","2022/2023","Premier League",900,"xA",2)];
 const obs=buildHistoricalObservations({stats,players});
 const result=compareHistoricalObservation(obs[0],obs);
 assert.equal(result.role,"DM");
 assert.equal(result.composite,null);
});
test('Keylor Navas Pumas: participación provisional con 22/23 y 15/18 cuando faltan minutos',()=>{
 const stats=[
  {player_id:'h',season:'2025/2026',competition:'Liga MX Clausura',team_name:'Pumas',appearances:22,minutes:null,team_matches:23,metrics:[]},
  {player_id:'h',season:'2025/2026',competition:'Liga MX Apertura',team_name:'Pumas',appearances:15,minutes:null,team_matches:18,metrics:[]},
 ];
 const observations=buildHistoricalObservations({stats,players});
 const keylor=observations.find(o=>o.playerId==='h');
 assert.ok(keylor);
 assert.ok(Math.abs(keylor.values.play_share-(37/41*100))<1e-8);
 assert.equal(keylor.playShareEstimated,true);
 assert.deepEqual(keylor.playShareCoverage,{covered:2,total:2});
 assert.equal(stats[0].minutes,null);
});
test('La participación conserva prioridad de minutos oficiales sobre PJ estimados',()=>{
 const stats=[
  {player_id:'h',season:'2025/2026',competition:'Liga MX Clausura',team_name:'Pumas',appearances:22,minutes:1710,team_matches:23,metrics:[]},
  {player_id:'h',season:'2025/2026',competition:'Liga MX Apertura',team_name:'Pumas',appearances:15,minutes:1230,team_matches:18,metrics:[]},
 ];
 const keylor=buildHistoricalObservations({stats,players}).find(o=>o.playerId==='h');
 assert.ok(Math.abs(keylor.values.play_share-(2940/(41*90)*100))<1e-8);
 assert.equal(keylor.playShareEstimated,false);
});

test("Ter Stegen 25/26: saved Save percentage and season-wide xG Buildup are valued without official minutes",()=>{
 const keeper={id:"terstegen-test",name:"Marc-André ter Stegen",position:"GK"};
 const stats=[
  {player_id:keeper.id,player_name:keeper.name,season:"2025/2026",competition:"Copa del Rey",team_id:"barcelona",appearances:1,minutes:null,
   metrics:[{name:"Save percentage",value:66.7},{name:"Saves",value:3}]},
  {player_id:keeper.id,player_name:keeper.name,season:"2025/2026",competition:"LaLiga",team_id:"girona",appearances:2,minutes:null,
   metrics:[{name:"Save percentage",value:66.7},{name:"Saves",value:4},{name:"xG Buildup season /90",value:0.01}]}
 ];
 const [observation]=buildHistoricalObservations({stats,players:[keeper]});
 assert.equal(observation.role,"GK");
 assert.equal(observation.values.xg_buildup_p90,0.01);
 assert.equal(observation.values.save_pct,66.7);
 assert.equal(observation.savePctDetail.estimated,true);
 assert.equal(observation.savePctDetail.covered,2);
 assert.equal(observation.savePctDetail.total,2);
 assert.equal(stats[0].minutes,null);
 assert.equal(stats[1].minutes,null);
});
test("GK Save percentage prefers real minute weights, rejects missing and preserves zero",()=>{
 const keeper={id:"gk-test",name:"Portero",position:"GK"};
 const stats=[
  {player_id:keeper.id,season:"2025/2026",competition:"LaLiga",minutes:900,appearances:20,metrics:[{name:"Save percentage",value:80}]},
  {player_id:keeper.id,season:"2025/2026",competition:"Champions League",minutes:null,appearances:5,metrics:[{name:"Save percentage",value:50}]},
  {player_id:keeper.id,season:"2025/2026",competition:"Copa del Rey",minutes:null,appearances:2,metrics:[]}
 ];
 const [observation]=buildHistoricalObservations({stats,players:[keeper]});
 assert.equal(observation.values.save_pct,70);
 assert.equal(observation.savePctDetail.estimated,true);
 assert.equal(observation.savePctDetail.covered,2);
 assert.equal(observation.savePctDetail.total,3);
 const [zero]=buildHistoricalObservations({players:[keeper],stats:[{...stats[0],metrics:[{name:"Save percentage",value:0}]}]});
 assert.equal(zero.values.save_pct,0);
 const [missing]=buildHistoricalObservations({players:[keeper],stats:[{...stats[0],metrics:[]}]});
 assert.equal(missing.values.save_pct,null);
});

test("Each indicator uses only its competitions with valid inputs, independent of missing data for other metrics",()=>{
 const players=[{id:"w",name:"Extremo",position:"RW"}];
 const stats=[
  {player_id:"w",season:"2024/2025",competition:"Liga",minutes:900,appearances:10,metrics:[
   {name:"Dribbles",value:30},{name:"Dispossessed",value:10},{name:"Shots on target",value:15}
  ]},
  {player_id:"w",season:"2024/2025",competition:"Champions League",minutes:450,appearances:5,metrics:[
   {name:"xA",value:3},{name:"Dribbles",value:10},{name:"Dispossessed",value:5}
  ]},
  {player_id:"w",season:"2024/2025",competition:"Cup",minutes:90,appearances:1,metrics:[{name:"Assists",value:1}]}
 ];
 const [observation]=buildHistoricalObservations({players,stats});
 assert.equal(observation.values.successful_dribbles_p90,40*90/1350);
 assert.equal(observation.values.shots_on_target_p90,15*90/900);
 assert.equal(observation.values.xa_p90,3*90/450);
 assert.equal(observation.values.ball_security,Math.round((40+5)/(40+15+10)*10000)/100);
 assert.equal(observation.ballSecurityDetail.excluded,1);
 assert.equal(observation.ballSecurityDetail.eligible,true);
});
test("xA rate-only can contribute alongside other xA totals without all-competition completeness",()=>{
 const players=[{id:"w",name:"Extremo",position:"ED"}];
 const stats=[
  {player_id:"w",season:"2024/2025",competition:"Liga",minutes:900,appearances:10,metrics:[{name:"xA",value:3}]},
  {player_id:"w",season:"2024/2025",competition:"Champions League",minutes:null,appearances:5,metrics:[{name:"xA",per90:0.45,value:null}]},
  {player_id:"w",season:"2024/2025",competition:"Copa",minutes:100,metrics:[]}
 ];
 const [observation]=buildHistoricalObservations({players,stats});
 assert.ok(Math.abs(observation.values.xa_p90-(3+0.45*450/90)*90/1350)<1e-10);
 assert.equal(observation.xaRateEstimated,false); // no source total for the estimated-only row
});
test("PAdj mixes valid provider totals with reconstructed competition data, no double counting",()=>{
 const players=[{id:"c",name:"Medio",position:"CM"}];
 const stats=[
  {player_id:"c",season:"2024/2025",competition:"Liga",team_id:"club",minutes:900,metrics:[{name:"PAdj defensive actions",value:80}]},
  {player_id:"c",season:"2024/2025",competition:"Champions League",team_id:"club",minutes:450,metrics:[{name:"Defensive actions",value:15}]},
  {player_id:"c",season:"2024/2025",competition:"Copa",team_id:"club",minutes:120,metrics:[]}
 ];
 const possessions=[{team_id:"club",season:"2024/2025",competition:"Champions League",team_possession_pct:60}];
 const [observation]=buildHistoricalObservations({players,stats,teamPossessions:possessions});
 const expected=(80+15*50/(100-60))*90/1350;
 assert.ok(Math.abs(observation.values.def_actions_poss_adj_p90-expected)<1e-10);
 assert.equal(observation.pAdjCoverage.covered,2);
 assert.equal(observation.pAdjCoverage.total,3);
 assert.equal(observation.pAdjMethod,"mixed_provider_experimental");
});
