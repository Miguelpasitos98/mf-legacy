import test from "node:test";
import assert from "node:assert/strict";
import {nationalLinkPlan,nationalCategoryForCompetition} from "../src/utils/nationalAutoLink.js";
test("Vincula Mundial y Finalissima a selección absoluta del país del jugador",()=>{
 const player={id:"p",country_id:"arg"};
 const nationalTeams=[{id:"arg-senior",country_id:"arg",category:"senior",name:"Argentina"},{id:"arg-u20",country_id:"arg",category:"u20",name:"Argentina Sub-20"}];
 const rows=[{id:"a",player_id:"p",season:"2021/2022",competition:"World Cup"},{id:"b",player_id:"p",season:"2021/2022",competition:"Finalissima"},{id:"c",player_id:"p",season:"2021/2022",competition:"Premier League"}];
 const plan=nationalLinkPlan({player,records:rows,nationalTeams});
 assert.equal(plan.length,2);assert.ok(plan.every(x=>x.patch.national_team_id==="arg-senior"));
});
test("No cambia equipo ya vinculado y distingue sub-20, olímpicos y categoría ambigua",()=>{
 const player={id:"p",country_id:"arg"};
 const teams=[{id:"senior",country_id:"arg",category:"senior",name:"Argentina"},{id:"u20",country_id:"arg",category:"u20",name:"Argentina Sub-20"}];
 assert.equal(nationalCategoryForCompetition("U20 World Cup"),"u20");
 const rows=[{id:"a",player_id:"p",competition:"U20 World Cup"},{id:"b",player_id:"p",competition:"Olympic Games"},{id:"c",player_id:"p",competition:"Copa America",national_team_id:"existing"}];
 const plan=nationalLinkPlan({player,records:rows,nationalTeams:teams});
 assert.deepEqual(plan.map(x=>x.patch.national_team_id),["u20"]);
 assert.equal(nationalLinkPlan({player:{id:"p"},records:rows,nationalTeams:teams}).length,0);
});
