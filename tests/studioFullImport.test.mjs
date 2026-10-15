import test from "node:test";
import assert from "node:assert/strict";
import {studioImportManifest,splitStudioArchive,recoverStudioArchive,selectStudioWrites,studioPlayerId} from "../src/utils/studioFullImport.js";
const hash="f".repeat(64);
const original={
 schema:"mf_legacy_external_batch_v1",batch:"jugador_654096",snapshot_date:"2026-10-14",
 records:[{kind:"player",fotmob_id:"654096",data:{identity:{name:"Declan Rice"}}},
 {kind:"season",fotmob_id:"654096",data:{fotmob_player_id:"654096",season:"2024/2025",competition:"Premier League",metrics:[]}}],
 fotmob_market_value_history:[{record_id:"fotmob_market:654096:1",date:"2024-06-30",value_eur:90000000,lower_bound:70000000,upper_bound:110000000,
  valuation_type:"model_estimate",provider:"fotmob",model_provider:"scisports"}],
 historical_valuations:[{season:"2024/2025",fifa_fc_overall:null,transfermarkt_value_eur:null,fotmob_scisports_value_eur:80000000}],
 all_season_records:[{profile_season_id:"2-0",season:"2024/2025",competition:"Premier League",metrics:[]}],
 pending_team_review:[{external_record_id:"pending:1",season:"2024/2025",competition:"EURO",team_candidates:[{team_name:"England"}]}],
 source_observations:[{observation_id:"understat:manual:654096:1",season:"2024/2025",statistics:{original:{xG:1.2}},
  quality:{authenticity:"manual_not_independently_verified"}}],
 understat_season_summaries:[{season:"2024/2025",competition:{understat_league:"EPL"},totals:{xG:1.2},
  published_per90:{xG:{value:.2,provider_field:"xG90",source:"Understat"}}}],
 understat_coverage_report:{manual_observations:1,note:"keep complete source"},
 fotmob_market_value_receipt:{profile_sha256:"a".repeat(64)},
 sources:{understat:"manual"},custom_unexpected_field:{nested:{retain:[0,null,"á💚"]}},
 extra_future_rows:[{id:11,any_new_thing:"unchanged"}]
};
test("Identificación externa del JSON unificado",()=>{
 assert.equal(studioPlayerId(original),"654096");
 assert.throws(()=>studioImportManifest({...original,summary:{fotmob_id:"wrong"}}),/ID FotMob/);
});
test("Importa todas las secciones como registros fuente sin contaminar FIFA y Transfermarkt",()=>{
 const result=studioImportManifest(original,{playerId:"base44-rice",fileHash:hash});
 assert.equal(result.records.length,7);
 assert.equal(result.records.filter(r=>r.record_kind==="market_point").length,1);
 assert.equal(result.records.filter(r=>r.record_kind==="extra_source").length,1);
 const mv=result.records.find(r=>r.record_kind==="market_point");
 assert.equal(mv.market_value_eur,90000000);
 assert.equal(mv.status,"model_estimate");
 assert.equal(result.records.find(r=>r.record_kind==="understat_summary").status,"manual_identity_unverified");
 const valuation=result.records.find(r=>r.record_kind==="historical_valuation");
 assert.equal(JSON.parse(valuation.payload_json).transfermarkt_value_eur,null);
 assert.equal(JSON.parse(valuation.payload_json).fotmob_scisports_value_eur,80000000);
 assert.equal(result.records.find(r=>r.record_kind==="pending_team").status,"pending_review");
});
test("Archivo JSON íntegro reconstruido literalmente, incluidos campos desconocidos",()=>{
 const chunks=splitStudioArchive(original,{playerId:"rice",fileHash:hash,sourceFile:"Declan Rice.json",maxChunk:40});
 assert.ok(chunks.length>5);
 assert.deepEqual(recoverStudioArchive([...chunks].reverse()),original);
 assert.throws(()=>recoverStudioArchive(chunks.slice(1)),/incompleto/);
 assert.equal(chunks[0].file_hash,hash);
});
test("La reimportación conserva idempotencia y actualiza solo la fuente",()=>{
 const manifest=studioImportManifest(original,{playerId:"rice",fileHash:hash}).records;
 const existing=manifest.map((x,i)=>({...x,id:"db"+i}));
 assert.equal(selectStudioWrites(manifest,existing).unchanged.length,manifest.length);
 const updated=[...manifest];updated[0]={...updated[0],payload_json:"{}"};
 const plan=selectStudioWrites(updated,existing);
 assert.equal(plan.update.length,1);
 assert.equal(plan.create.length,0);
 assert.equal(plan.unchanged.length,manifest.length-1);
});
