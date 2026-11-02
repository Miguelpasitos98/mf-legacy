import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {mkdtempSync,rmSync} from "node:fs";
import esbuild from "esbuild";
import React from "react";
import {renderToString} from "react-dom/server";
import {MemoryRouter} from "react-router-dom";
import {MANAGER_BLANK,PROFILE_BLANK,cleanManager,cleanProfile,decodeRoleText,isCustomTeam,chooseAssignment,clampAxis} from "../src/components/managers/managerModel.mjs";

test("real and fictional coach entries validate provenance",()=>{
 assert.throws(()=>cleanManager({...MANAGER_BLANK,name:"A",manager_kind:"real"}),/nombre/);
 assert.throws(()=>cleanManager({...MANAGER_BLANK,name:"Test Coach",source_status:"verified"}),/fuente/);
 const c=cleanManager({...MANAGER_BLANK,name:" Example Coach ",manager_kind:"fictional"});
 assert.equal(c.name,"Example Coach");
 assert.equal(c.manager_kind,"fictional");
 assert.equal(c.source_status,"manual");
});
test("tactical profiles stay independent, validate values, and preserve preferences",()=>{
 assert.equal(clampAxis(110),100);
 assert.equal(clampAxis(-8),0);
 const p=cleanProfile({...PROFILE_BLANK,name:"  Control posicional ",possession:78,pressing:88},"coach-123",{FB:"Lateral invertido y pase progresivo",ST:"Movilidad"});
 assert.equal(p.manager_id,"coach-123");
 assert.equal(p.possession,78);
 assert.deepEqual(decodeRoleText(p.player_role_priorities).FB,"Lateral invertido y pase progresivo");
 assert.throws(()=>cleanProfile({...PROFILE_BLANK,profile_scope:"season",season:"2025/2025"},"coach-123"),/temporada/);
});
test("only custom teams can be selected and primary assignment found by season",()=>{
 assert.equal(isCustomTeam({data_source:"Manual"}),false);
 assert.equal(isCustomTeam({is_custom_club:true}),true);
 const assignments=[
  {id:"1",team_type:"club",team_id:"c",season:"2026/2027",is_primary:false},
  {id:"2",team_type:"club",team_id:"c",season:"2026/2027",is_primary:true},
  {id:"3",team_type:"club",team_id:"c",season:"2025/2026",is_primary:true}
 ];
 assert.equal(chooseAssignment(assignments,"c","2026/2027").id,"2");
});
test("Base44 coach entity schemas exist with admin-only writes and separated relationships",()=>{
 for(const entity of ["Manager","ManagerTacticalProfile","TeamManagerAssignment"]){
  const schema=JSON.parse(fs.readFileSync("base44/entities/"+entity+".jsonc","utf8"));
  assert.equal(schema.name,entity);
  assert.equal(schema.rls.create.user_condition.role,"admin");
  assert.equal(schema.rls.update.user_condition.role,"admin");
 }
 const schema=JSON.parse(fs.readFileSync("base44/entities/TeamManagerAssignment.jsonc","utf8"));
 assert.ok(schema.properties.team_id&&schema.properties.manager_id&&schema.properties.season);
});
test("Managers page renders without data using a mocked Base44 client",async()=>{
 const dir=mkdtempSync(path.join(process.cwd(),".manager-ssr-"));
 const outfile=path.join(dir,"entry.cjs");
 const require=createRequire(import.meta.url);
 try{
  await esbuild.build({
   entryPoints:["src/pages/Managers.jsx"],outfile,bundle:true,format:"cjs",platform:"node",packages:"external",
   alias:{"@":path.resolve("src")},
   plugins:[{name:"sdk-icons-test",setup(build){
    build.onResolve({filter:/base44Client/},()=>({path:"client",namespace:"sdk-test"}));
    build.onLoad({filter:/.*/,namespace:"sdk-test"},()=>({contents:"export const base44={entities:{},auth:{}};",loader:"js"}));
    build.onResolve({filter:/^lucide-react$/},()=>({path:"icons",namespace:"icons-test"}));
    build.onLoad({filter:/.*/,namespace:"icons-test"},()=>({
     contents:"const Icon=()=>null;export {Icon as Search,Icon as Plus,Icon as Save,Icon as Sparkles,Icon as Copy,Icon as UserRoundCog,Icon as SlidersHorizontal,Icon as ShieldCheck,Icon as ArrowUpRight,Icon as BookOpen,Icon as Check,Icon as ChevronsUpDown,Icon as Globe2,Icon as X};",
     loader:"js"
    }));
   }}]
  });
  const Managers=require(outfile).default;
  const html=renderToString(React.createElement(MemoryRouter,{initialEntries:["/managers"]},React.createElement(Managers)));
  assert.doesNotMatch(html,/Base de datos de entrenadores/);
  assert.match(html,/Entrenadores/);
  assert.match(html,/Crear ficha/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
