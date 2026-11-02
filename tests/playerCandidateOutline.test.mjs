import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {candidateOutlineClass} from "../src/components/players/playerCandidateOutline.mjs";

test("the normal catalogue NEVER outlines candidates in green",()=>{
 const candidate={manager_fit_candidate:true};
 assert.equal(candidateOutlineClass(candidate), "border-slate-200 hover:border-slate-300");
 assert.equal(candidateOutlineClass(candidate,false,false),"border-slate-200 hover:border-slate-300");
 assert.equal(candidateOutlineClass({manager_fit_candidate:false},false,true),"border-slate-200 hover:border-slate-300");
});
test("dedicated candidate view uses a soft emerald border and subtle ring",()=>{
 const style=candidateOutlineClass({manager_fit_candidate:true},false,true);
 assert.match(style,/border-\[#8FAF9C\]/);
 assert.match(style,/ring-1 ring-\[#DDEAE0\]/);
 assert.doesNotMatch(style,/ring-2 ring-emerald-300/);
});
test("the blue bulk selection remains clearly different within either view",()=>{
 assert.match(candidateOutlineClass({},true),/border-blue-700 ring-2 ring-blue-300/);
 const both=candidateOutlineClass({manager_fit_candidate:true},true,true);
 assert.match(both,/border-\[#8FAF9C\]/);
 assert.match(both,/ring-2 ring-blue-300/);
});
test("only saved boolean true is eligible, even in candidate view",()=>{
 assert.equal(candidateOutlineClass({manager_fit_candidate:"true"},false,true),"border-slate-200 hover:border-slate-300");
 assert.equal(candidateOutlineClass({manager_fit_candidate:null},false,true),"border-slate-200 hover:border-slate-300");
});
test("candidate view passes the scope prop, not the ordinary catalogue",()=>{
 const card=fs.readFileSync("src/components/players/PlayerCard.jsx","utf8");
 const players=fs.readFileSync("src/pages/Players.jsx","utf8");
 assert.match(card,/candidateOutlineClass\(player,selected,candidateView\)/);
 assert.match(players,/candidateView hasStats=/);
 assert.match(players,/viewMode === "candidates"/);
 assert.match(players,/viewMode === "all"/);
 assert.match(players,/const normalizePlayer = \(player\) => \(\{\s*\.\.\.player,/);
});
