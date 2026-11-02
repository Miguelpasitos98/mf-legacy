import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateManagerAIRequest,normalizeAIGenerationResult} from "../base44/functions/manager-ai/core.mjs";
const id="6ae8c8581be7a18288ab476c";
const name="Jürgen Klopp";
const validPrompt="Eres analista táctico para MF LEGACY. Entrenador: "+name+". Investiga su modelo de juego y elabora un informe con fuentes oficiales verificadas. ".repeat(2);
test("backend requires valid role and does not write entities",()=>{
 const src=readFileSync("base44/functions/manager-ai/entry.js","utf8");
 assert.match(src,/user.role|me.role/);
 assert.match(src,/me.role!=="admin"/);
 assert.match(src,/asServiceRole\.integrations\.Core\.InvokeLLM/);
 assert.doesNotMatch(src,/\.entities\.Manager\.(create|update|delete)/);
 assert.doesNotMatch(src,/\.entities\.ManagerTacticalProfile\.(create|update|delete)/);
 assert.match(src,/action==="health"/);
});
test("backend only admits validated coach-specific requests",()=>{
 const request=validateManagerAIRequest({mode:"tactical",manager_id:id,name,prompt:validPrompt});
 assert.equal(request.mode,"tactical");
 assert.equal(request.manager_id,id);
 assert.throws(()=>validateManagerAIRequest({mode:"tactical",manager_id:"",name,prompt:validPrompt}),/entrenador guardado/);
 assert.throws(()=>validateManagerAIRequest({mode:"unknown",name,prompt:validPrompt}),/no admitido/);
 assert.throws(()=>validateManagerAIRequest({mode:"biography",name:"A",prompt:validPrompt}),/Nombre de entrenador inválido/);
 assert.throws(()=>validateManagerAIRequest({mode:"biography",name,prompt:"no"}),/12\.500 caracteres/);
});
test("server normalizes both text and structured AI output",()=>{
 assert.equal(normalizeAIGenerationResult({response:"hola"}),"hola");
 assert.deepEqual(normalizeAIGenerationResult({response:{identifiable:true}}),{identifiable:true});
 assert.throws(()=>normalizeAIGenerationResult(" "),/no devolvió contenido/);
});
test("browser uses backend in both actions, never calls blocked Core directly",()=>{
 const source=readFileSync("src/pages/Managers.jsx","utf8");
 assert.equal((source.match(/base44\.functions\.invoke\("manager-ai"/g)||[]).length,2);
 assert.doesNotMatch(source,/base44\.integrations\.Core\.InvokeLLM/);
});
