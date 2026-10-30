import test from "node:test";
import assert from "node:assert/strict";
import {buildPossessionAudit,suggestPossessionTeam,planPossessionAssociation,resolveImportedPossession} from "../src/utils/possessionAssociations.js";
import {matchingPossessionRecord,createPossessionLookup} from "../src/utils/teamPossession.js";

const teams=[
 {id:"marseille",name:"Olympique de Marseille",fotmob_id:"8592"},
 {id:"psg",name:"Paris Saint-Germain",fotmob_id:"9847"},
 {id:"nice",name:"OGC Nice",fotmob_id:"9874"}
];
const possessions=[
 {id:"a",team_id:"",team_name:"Marseille",season:"2023/2024",competition:"Ligue 1",team_possession_pct:57.4,source:"FotMob"},
 {id:"b",team_id:"",team_name:"Marseille",season:"2024/2025",competition:"Ligue 1",team_possession_pct:63.6,source:"FotMob"},
 {id:"c",team_id:"psg",team_name:"Paris Saint-Germain",season:"2024/2025",competition:"Ligue 1",team_possession_pct:68.4,source:"FotMob"}
];
test("Audita registros guardados por nombre y todas las temporadas sin inventar valores",()=>{
 const result=buildPossessionAudit(possessions,teams);
 assert.equal(result.records,3);assert.equal(result.linked,1);assert.equal(result.pending,2);
 assert.equal(result.seasons,2);
 assert.equal(result.groups.find(g=>g.name==="Marseille").seasonCount,2);
 assert.equal(result.groups.find(g=>g.name==="Marseille").status,"pending");
});
test("Una asociación manual cambia solo identidad y alias en todas las temporadas",()=>{
 const plan=planPossessionAssociation(possessions,teams,"Marseille","marseille");
 assert.equal(plan.total,2);assert.equal(plan.updates.length,2);
 assert.deepEqual(plan.conflicts,[]);
 const linked=possessions.map(row=>({...row,...plan.updates.find(x=>x.id===row.id)?.changes}));
 assert.deepEqual(linked.slice(0,2).map(r=>r.team_id),["marseille","marseille"]);
 assert.deepEqual(linked.slice(0,2).map(r=>r.team_possession_pct),[57.4,63.6]);
 assert.deepEqual(linked.slice(0,2).map(r=>r.source),["FotMob","FotMob"]);
 assert.equal(linked[0].team_name,"Olympique de Marseille");
 assert.equal(linked[0].source_team_name,"Marseille");
 const future=resolveImportedPossession({team_name:"Marseille",season:"2025/2026",competition:"Ligue 1",team_possession_pct:58},linked,teams);
 assert.equal(future.team_id,"marseille");
 assert.equal(future.source_team_name,"Marseille");
 assert.equal(future.fotmob_team_id,"8592");
 assert.strictEqual(matchingPossessionRecord(linked,future),null);
 const repeated=resolveImportedPossession({team_name:"Marseille",season:"2024/2025",competition:"Ligue 1",team_possession_pct:63.6},linked,teams);
 assert.equal(matchingPossessionRecord(linked,repeated)?.id,"b");
 const get=createPossessionLookup(linked,teams);
 assert.equal(get({team_id:"marseille",season:"2024/2025",competition:"Ligue 1"}),63.6);
});
test("No reemplaza asociaciones preexistentes incompatibles ni crea duplicados",()=>{
 const conflicted=[...possessions,{...possessions[0],id:"d",team_id:"nice",team_name:"Marseille",season:"2022/2023"}];
 assert.ok(planPossessionAssociation(conflicted,teams,"Marseille","marseille").conflicts.length);
 const duplicate=[...possessions,{...possessions[0],id:"e",team_id:"marseille"}];
 assert.ok(planPossessionAssociation(duplicate,teams,"Marseille","marseille").conflicts.length);
 const occupied=[...possessions,{id:"f",team_id:"marseille",team_name:"Olympique de Marseille",season:"2024/2025",competition:"Ligue 1",team_possession_pct:60}];
 assert.ok(planPossessionAssociation(occupied,teams,"Marseille","marseille").conflicts.length);
});
test("ID FotMob contradictorio impide asociación y propuesta automática",()=>{
 const rows=[{...possessions[0],fotmob_team_id:"999999"}];
 const audit=buildPossessionAudit(rows,teams);
 assert.equal(suggestPossessionTeam(audit.groups[0],teams),null);
 assert.ok(planPossessionAssociation(rows,teams,"Marseille","marseille").conflicts.some(x=>x.includes("FotMob")));
 const linked=[{...possessions[0],team_id:"marseille",team_name:"Olympique de Marseille",source_team_name:"Marseille",fotmob_team_id:"8592"}];
 const incoming=resolveImportedPossession({team_name:"Marseille",fotmob_team_id:"123",season:"2026/2027"},linked,teams);
 assert.equal(incoming.team_id,undefined);
});
test("Solo se sugieren coincidencias unívocas, no nombres ambiguos",()=>{
 const rows=[{id:"x",team_id:"",team_name:"Paris Saint-Germain",season:"2024/2025",competition:"Ligue 1",team_possession_pct:60}];
 const audit=buildPossessionAudit(rows,teams);
 assert.equal(suggestPossessionTeam(audit.groups[0],teams)?.id,"psg");
 assert.equal(suggestPossessionTeam(audit.groups[0],[...teams,{id:"psg2",name:"Paris Saint-Germain"}]),null);
});
