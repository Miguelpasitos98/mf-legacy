import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {consumeQuickJsonFile} from "../src/utils/quickJsonFilePicker.mjs";

test("choosing a JSON returns the original File object and clears native picker for same-file reselection",()=>{
 const file={name:"fm26.json",size:1024,text:async()=>"[]"};
 const input={files:[file],value:"C:\\fakepath\\fm26.json"};
 assert.equal(consumeQuickJsonFile({currentTarget:input}),file);
 assert.equal(input.value,"");
 input.value="C:\\fakepath\\fm26.json";
 assert.equal(consumeQuickJsonFile({currentTarget:input}),file);
 assert.equal(input.value,"");
});
test("cancelled picker never reports a file or leaves a stale selection",()=>{
 const input={files:[],value:""};
 assert.equal(consumeQuickJsonFile({currentTarget:input}),null);
 assert.equal(input.value,"");
 assert.equal(consumeQuickJsonFile(null),null);
 assert.equal(consumeQuickJsonFile({target:{files:[],value:""}}),null);
});
test("both PLAYERS import buttons synchronously invoke native pickers without opening the empty modal",()=>{
 const page=fs.readFileSync("src/pages/Players.jsx","utf8");
 assert.match(page,/ref=\{fm26QuickFileRef\} type="file"/);
 assert.match(page,/ref=\{tacticalRoleQuickFileRef\} type="file"/);
 assert.match(page,/onClick=\{\(\) => fm26QuickFileRef\.current\?\.click\(\)\}/);
 assert.match(page,/onClick=\{\(\) => tacticalRoleQuickFileRef\.current\?\.click\(\)\}/);
 assert.match(page,/const chooseFm26File = \(event\) => \{[\s\S]*?if\(!file\)return;[\s\S]*?setFm26ImportOpen\(true\);[\s\S]*?void handleFm26File\(file\)/);
 assert.match(page,/const chooseTacticalRoleFile = \(event\) => \{[\s\S]*?if\(!file\)return;[\s\S]*?setTacticalRoleInitialFile\(file\);[\s\S]*?setTacticalRoleImportOpen\(true\)/);
 assert.doesNotMatch(page,/onClick=\{\(\) => setFm26ImportOpen\(true\)\}/);
});
test("modal previews chosen role JSON automatically and reuses file parser, maintaining manual import confirmation",()=>{
 const modal=fs.readFileSync("src/components/players/TacticalRoleImportModal.jsx","utf8");
 const page=fs.readFileSync("src/pages/Players.jsx","utf8");
 assert.match(modal,/initialFile=null/);
 assert.match(page,/initialFile=\{tacticalRoleInitialFile\}/);
 assert.match(modal,/if \(open && initialFile\) void loadFile\(initialFile\)/);
 assert.match(modal,/parseTacticalRoleImport\(JSON\.parse\(text\), allowedRoles\)/);
 assert.match(modal,/if \(!activeRef\.current \|\| sequence!==readSequence\.current\) return/);
 assert.match(modal,/onClick=\{run\}/);
 assert.match(modal,/onChange=\{load\}/);
 assert.match(page,/onClose=\{closeTacticalRoleImport\}/);
});
test("FM26 reader still validates JSON and requires confirmation after picker",()=>{
 const page=fs.readFileSync("src/pages/Players.jsx","utf8");
 const modal=fs.readFileSync("src/components/players/Fm26ImportModal.jsx","utf8");
 assert.match(page,/const handleFm26File = async \(eventOrFile\) =>/);
 assert.match(page,/JSON\.parse\(content\)/);
 assert.match(page,/setFm26Import\(payload\)/);
 assert.match(modal,/disabled=\{!fm26Preview \|\| fm26Preview\.unmapped > 0/);
 assert.match(modal,/onClick=\{handleFm26Import\}/);
});
