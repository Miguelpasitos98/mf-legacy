import test from "node:test";
import assert from "node:assert/strict";
import esbuild from "esbuild";
import React from "react";
import {renderToString} from "react-dom/server";
import {createRequire} from "node:module";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
const require=createRequire(import.meta.url);
test("scouting cards render manual assignment actions without a calculated score",async()=>{
 const temp=mkdtempSync(path.join(process.cwd(),".manager-assignment-smoke-"));
 try{
  const output=path.join(temp,"cards.cjs");
  await esbuild.build({
   entryPoints:["src/components/managers/ManagerScoutingVisual.jsx"],outfile:output,
   bundle:true,format:"cjs",platform:"node",packages:"external",
   alias:{"@":path.resolve("src")},
   plugins:[{name:"ui-stubs",setup(build){
    build.onResolve({filter:/PlayerPortrait$/},()=>({path:"portrait",namespace:"stub"}));
    build.onLoad({filter:/.*/,namespace:"stub"},()=>({contents:"export default function Portrait(){return null}",loader:"js"}));
    build.onResolve({filter:/^lucide-react$/},()=>({path:"lucide",namespace:"icons"}));
    build.onLoad({filter:/.*/,namespace:"icons"},()=>({contents:"const Icon=()=>null; export {Icon as Activity,Icon as BarChart3,Icon as ChevronDown,Icon as ChevronUp,Icon as ClipboardList,Icon as Info,Icon as Layers3,Icon as Users};",loader:"js"}));
   }}]
  });
  const {ScoutingCandidateCard:Card}=require(output);
  const item={player:{id:"salah",name:"Mohamed Salah",position:"RW"},fit:95,quality:180};
  const shared={item,scoreMode:"position",selected:false,compareDisabled:false,onCompare:()=>{},onReport:()=>{},onLink:()=>{},onRelease:()=>{},onPreselect:()=>{},age:34,valueText:"—",currentManagerId:"ancelotti"};
  const other=renderToString(React.createElement(Card,{...shared,assignment:{manager_id:"klopp",status:"linked",role:"WG"},assignmentOwner:"Jürgen Klopp"}));
  assert.match(other,/Reasignar a este entrenador/);
  assert.match(other,/Jürgen Klopp/);
  const own=renderToString(React.createElement(Card,{...shared,currentManagerId:"klopp",assignment:{manager_id:"klopp",status:"linked",role:"WG"},assignmentOwner:"Jürgen Klopp"}));
  assert.match(own,/Desvincular/);
  const free=renderToString(React.createElement(Card,{...shared,assignment:null}));
  assert.match(free,/Preseleccionar/);
  assert.match(free,/Vincular a entrenador/);
 }finally{rmDir();}
 function rmDir(){rmSync(temp,{recursive:true,force:true})}
});
