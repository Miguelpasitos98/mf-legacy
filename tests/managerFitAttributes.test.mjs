import test from "node:test";
import assert from "node:assert/strict";
import {managerFitAttributes} from "../src/components/managers/managerFitAttributes.mjs";
const player={id:"1",position:"LD",ca:170,position_ratings:{defensa_derecho:18},
 stats:{physical:{resistencia:17,velocidad:16,aceleracion:15},technical:{centros:16,pases:14,control:13},mental:{sacrificio:18,trabajo_de_equipo:17,decisiones:15}}};
test("manager fit adds explainable attribute dimensions and CA stays independent",()=>{
 const p=managerFitAttributes(player,"FB",{pressing:90,possession:72,tempo:45});
 assert.ok(p.score>0&&p.score<=100);
 assert.equal(p.quality,170);
 assert.ok(p.styleDimensions.includes("pressing"));
 assert.ok(p.styleDimensions.includes("possession"));
 assert.equal(p.confidence,"medium");
});
test("missing stats never become zero or fake tactical fit",()=>{
 const p=managerFitAttributes({id:"2",position:"LD",ca:180},"FB",{pressing:96});
 assert.equal(p.score,null);assert.equal(p.quality,180);
 assert.equal(p.attributes,null);
 assert.equal(p.confidence,"insufficient");
});
test("same player responds to manager philosophy without overwriting the player",()=>{
 const original=JSON.stringify(player);
 const a=managerFitAttributes(player,"FB",{pressing:98,possession:50});
 const b=managerFitAttributes(player,"FB",{pressing:50,possession:98});
 assert.notEqual(a.style,b.style);
 assert.equal(JSON.stringify(player),original);
});
