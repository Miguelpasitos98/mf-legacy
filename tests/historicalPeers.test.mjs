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
