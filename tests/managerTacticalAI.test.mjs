import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildManagerTacticalPrompt,parseManagerTacticalResponse,previewManagerTacticalDraft} from "../src/components/managers/managerTacticalAI.mjs";
const valid={
 identifiable:true,confidence:"medium",formation:"4-3-3",
 possession:70,pressing:90,tempo:76,defensive_line:83,attacking_width:70,risk_taking:66,
 build_up:"mixed",transition:"counter_press",defensive_block:"high",
 player_role_priorities:{GK:"Portero con juego de pies",CB:"Central rápido",FB:"Lateral profundo",DM:"Organizador",AM:"Interior creativo",WG:"Extremo intenso",ST:"Delantero que presiona"},
 profile_notes:"Presión alta y transiciones verticales características de la etapa estudiada.",source_urls:["https://www.liverpoolfc.com","javascript:alert(1)"]
};
test("prompt independently researches coach by name, period, and warns estimates aren't official stats",()=>{
 const prompt=buildManagerTacticalPrompt({name:"Jürgen Klopp",manager_kind:"real",biography:"Entrenó al Liverpool"},{season:"2019/2020"},"Liverpool 2018-2024");
 assert.match(prompt,/Jürgen Klopp/);
 assert.match(prompt,/2019\/2020/);
 assert.match(prompt,/Liverpool 2018-2024/);
 assert.match(prompt,/NO estadísticas observadas/);
 assert.match(prompt,/Si el nombre es ambiguo/);
 assert.match(prompt,/CB, FB, DM, AM, WG y ST/);
 assert.throws(()=>buildManagerTacticalPrompt({name:""}),/nombre válido/);
 const fict=buildManagerTacticalPrompt({name:"Entrenador Inventado",manager_kind:"fictional"});
 assert.match(fict,/FICTICIO/);
});
test("AI output JSON is parsed and mapped to editable profile without persistence",()=>{
 const parsed=parseManagerTacticalResponse({response:"```json\n"+JSON.stringify(valid)+"\n```"});
 assert.equal(parsed.values.pressing,90);
 assert.equal(parsed.roleText.FB,"Lateral profundo");
 assert.deepEqual(parsed.sourceUrls,["https://www.liverpoolfc.com"]);
 const previous={name:"Modelo principal",season:"2019/2020",is_default:true,pressing:50,profile_notes:"anterior"};
 const result=previewManagerTacticalDraft(previous,parsed);
 assert.equal(previous.pressing,50);
 assert.equal(result.pressing,90);
 assert.equal(result.name,"Modelo principal");
 assert.equal(result.season,"2019/2020");
 assert.equal(result.is_default,true);
 assert.match(result.profile_notes,/confianza media/);
 assert.match(result.profile_notes,/pendientes de revisión/);
});
test("missing or unsupported values refuse instead of guessing numeric parameters",()=>{
 assert.throws(()=>parseManagerTacticalResponse({identifiable:false,reason:"Sin evidencia suficiente"}),/Sin evidencia/);
 assert.throws(()=>parseManagerTacticalResponse({...valid,pressing:undefined}),/Falta una estimación/);
 assert.throws(()=>parseManagerTacticalResponse({...valid,pressing:"90"}),/Falta una estimación/);
 assert.throws(()=>parseManagerTacticalResponse({...valid,formation:"2-2-6"}),/formación/);
 assert.throws(()=>parseManagerTacticalResponse({...valid,player_role_priorities:{GK:""}}),/rol CB/);
 assert.throws(()=>parseManagerTacticalResponse({...valid,profile_notes:"corto"}),/justificación/);
 assert.throws(()=>parseManagerTacticalResponse("texto incorrecto"),/JSON/);
});
test("Manager DNA UI supports independent AI, copy and paste without auto save",()=>{
 const s=fs.readFileSync("src/pages/Managers.jsx","utf8");
 assert.match(s,/Investigar ADN individual/);
 assert.match(s,/Investigar trayectoria completa/);
 assert.match(s,/Copiar prompt para ChatGPT/);
 assert.match(s,/Interpretar JSON y mostrar borrador/);
 assert.match(s,/previewManagerTacticalDraft/);
 assert.match(s,/base44\.functions\.invoke\("manager-ai"/);
 assert.match(s,/setProfileDraft\(prev=>previewManagerTacticalDraft/);
});
