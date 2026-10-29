import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {trophyReviewRows,filterTrophyReviews,validTrophyEvidenceUrl,prepareTrophyDecision,safeBulkTrophyPlan} from "../src/utils/trophyReview.js";

const teams=[{id:"t1",name:"FC Barcelona"},{id:"t2",name:"Real Madrid CF"}];
const players=[{id:"p1",name:"Jugador García"},{id:"p2",name:"Jugador Dos"},{id:"p3",name:"Jugador Tres"}];
const catalog=[{source_id:"L",name:"LaLiga"},{source_id:"C",name:"Copa del Rey"}];
const honours=[
 {id:"h1",recipient_type:"Team",recipient_id:"t1",season:"2024/2025",trophy_source_id:"L",verified:true,source_url:"https://laliga.com"},
 {id:"h2",recipient_type:"Team",recipient_id:"t1",season:"2024/2025",trophy_source_id:"C",verified:false},
 {id:"h3",recipient_type:"Player",recipient_id:"p1",season:"2024/2025",trophy_source_id:"L",verified:true}
];
const candidate=(id,player_id="p1",overrides={})=>({
 id,player_id,team_id:"t1",season:"2024/2025",trophy_source_id:"L",
 trophy_honour_id:"h1",status:"candidate",verified:false,evidence_type:"competition_appearance",
 evidence_note:"8 apariciones en la liga.",...overrides
});
const sample=credits=>trophyReviewRows({credits,honours,teams,players,catalog});

test("Candidate reviews resolve exact Base44 teams, player identities and competitions",()=>{
 const rows=sample([candidate("a"),candidate("b","p2",{trophy_honour_id:"h2",trophy_source_id:"C"})]);
 assert.equal(rows.length,2);
 assert.equal(rows[0].player_name,"Jugador García");
 assert.equal(rows[0].team_name,"FC Barcelona");
 assert.equal(rows[0].trophy_name,"LaLiga");
 assert.equal(rows[0].pending,true);
 assert.equal(rows[0].blocked,false);
 assert.equal(rows[1].blocked,true);
 assert.match(rows[1].reasons.join(" "),/pendiente de verificar/);
});
test("Missing, mismatched or individual champions are blocked from approval",()=>{
 const rows=sample([
  candidate("missing","p1",{trophy_honour_id:"nonexistent"}),
  candidate("wrong-team","p2",{team_id:"t2"}),
  candidate("wrong-season","p3",{season:"2023/2024"}),
  candidate("individual","p3",{trophy_honour_id:"h3"}),
  candidate("missing-player","p999"),
  candidate("wrong-trophy","p2",{trophy_source_id:"C"})
 ]);
 assert.equal(rows.every(row=>row.blocked),true);
 for(const row of rows)assert.throws(
  ()=>prepareTrophyDecision(row,{status:"confirmed",source:"https://uefa.com/squad",acknowledged:true}),
  /inconsistencias/
 );
});
test("Duplicated candidate credits cannot be reviewed independently or counted twice",()=>{
 const rows=sample([candidate("a"),candidate("b")]);
 assert.equal(rows.length,2);
 assert.equal(rows.every(row=>row.blocked),true);
 assert.equal(rows.every(row=>row.reasons.some(reason=>reason.includes("duplicada"))),true);
});
test("Approval requires valid HTTPS evidence and an explicit individual attestation",()=>{
 const row=sample([candidate("ok")])[0];
 const bad=["", "http://uefa.com/player", "javascript:alert(1)", "https://localhost/x", "https://x", "https://x.com/@space in URL", "https://username:secret@official.com/x"];
 for(const u of bad)assert.equal(validTrophyEvidenceUrl(u),false,u);
 assert.equal(validTrophyEvidenceUrl("https://www.uefa.com/history/club/squad"),true);
 assert.throws(()=>prepareTrophyDecision(row,{status:"confirmed",source:"https://www.uefa.com/history/club",acknowledged:false}),/expresamente/);
 assert.throws(()=>prepareTrophyDecision(row,{status:"confirmed",source:"http://www.uefa.com",acknowledged:true}),/URL HTTPS/);
 const payload=prepareTrophyDecision(row,{status:"confirmed",source:"https://www.uefa.com/history/club",acknowledged:true});
 assert.equal(payload.status,"confirmed");
 assert.equal(payload.verified,true);
 assert.equal(payload.source_url,"https://www.uefa.com/history/club");
 assert.match(payload.evidence_note,/8 apariciones/);
});
test("Excluded winners never become verified and original source is not destroyed",()=>{
 const row=sample([candidate("ok","p1",{source_url:"https://rfef.es/stats"})])[0];
 const payload=prepareTrophyDecision(row,{status:"excluded"});
 assert.equal(payload.status,"excluded");
 assert.equal(payload.verified,false);
 assert.equal(Object.hasOwn(payload,"source_url"),false);
});
test("Bulk review rejects any selected missing source or unchecked evidence BEFORE mutations",()=>{
 const rows=sample([candidate("a"),candidate("b","p2")]);
 const decisions={
  a:{status:"confirmed",source:"https://www.uefa.com/squad",acknowledged:true},
  b:{status:"confirmed",source:"",acknowledged:true}
 };
 assert.throws(()=>safeBulkTrophyPlan(rows,decisions),/URL HTTPS/);
 decisions.b.source="https://www.rfef.es/plantilla";
 decisions.b.acknowledged=false;
 assert.throws(()=>safeBulkTrophyPlan(rows,decisions),/expresamente/);
 decisions.b.acknowledged=true;
 const plan=safeBulkTrophyPlan(rows,decisions);
 assert.equal(plan.length,2);
 assert.equal(plan.every(p=>p.payload.verified),true);
 assert.notEqual(plan[0].payload.source_url,plan[1].payload.source_url);
});
test("Filters independently select one club, trophy, season, status and accented player name",()=>{
 const rows=sample([
  candidate("a"),candidate("b","p2",{trophy_honour_id:"h2",trophy_source_id:"C"}),
  candidate("c","p3",{status:"excluded"})
 ]);
 assert.equal(filterTrophyReviews(rows,{query:"garcia"}).length,1);
 assert.equal(filterTrophyReviews(rows,{team:"t2"}).length,0);
 assert.equal(filterTrophyReviews(rows,{trophy:"C"}).length,1);
 assert.equal(filterTrophyReviews(rows,{season:"2023/2024"}).length,0);
 assert.equal(filterTrophyReviews(rows,{status:"excluded"}).length,1);
 assert.equal(filterTrophyReviews(rows,{status:"candidate",blocked:"ready"}).length,1);
 assert.equal(filterTrophyReviews(rows,{status:"candidate",blocked:"blocked"}).length,1);
});
test("Review center is a real independent Trophies tab linked back to player sync",()=>{
 const page=readFileSync(new URL("../src/pages/Trophies.jsx",import.meta.url),"utf8");
 const view=readFileSync(new URL("../src/components/trophies/TrophyReviewCenter.jsx",import.meta.url),"utf8");
 const picker=readFileSync(new URL("../src/components/trophies/TeamSearchPicker.jsx",import.meta.url),"utf8");
 assert.match(page,/\["review","Revisar"\]/);
 assert.match(page,/<TrophyReviewCenter/);
 assert.match(page,/setSyncPhase\("players"\)/);
 assert.match(page,/initialPhase=\{syncPhase\}/);
 assert.match(view,/safeBulkTrophyPlan/);
 assert.match(view,/qc\.fetchQuery\(/);
 assert.match(view,/status:"confirmed"/);
 assert.match(view,/Candidatos pendientes|Candidatos|Pendientes/);
 assert.match(picker,/aria-label=\{ariaLabel\}/);
});
