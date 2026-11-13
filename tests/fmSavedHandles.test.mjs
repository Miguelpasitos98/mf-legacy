import test from "node:test";
import assert from "node:assert/strict";
import { sortRememberedFmSaves, getRememberedFmFile } from "../src/utils/fmSavedHandles.mjs";

test("ordena partidas recordadas por último uso sin mutar la entrada", () => {
  const original=[{id:"a",lastOpened:1},{id:"b",lastOpened:9},{id:"c",lastOpened:4}];
  assert.deepEqual(sortRememberedFmSaves(original).map(x=>x.id),["b","c","a"]);
  assert.deepEqual(original.map(x=>x.id),["a","b","c"]);
});
test("reabre automáticamente si el permiso sigue concedido",async()=>{
  let requested=0;
  const entry={handle:{queryPermission:async()=> "granted",requestPermission:async()=>{requested++;return "granted";},getFile:async()=>({name:"Miguel - Sevilla.fm",size:1})}};
  const file=await getRememberedFmFile(entry);
  assert.equal(file.name,"Miguel - Sevilla.fm");
  assert.equal(requested,0);
});
test("sin permiso, la apertura automática nunca solicita acceso silencioso",async()=>{
  let requested=0;
  const entry={handle:{queryPermission:async()=> "prompt",requestPermission:async()=>{requested++;return "granted";},getFile:async()=>({name:"Miguel - Sevilla.fm"})}};
  await assert.rejects(getRememberedFmFile(entry),error=>error.code==="FM_PERMISSION_REQUIRED");
  assert.equal(requested,0);
  assert.equal((await getRememberedFmFile(entry,{interactive:true})).name,"Miguel - Sevilla.fm");
  assert.equal(requested,1);
});
test("deniega archivos que ya no son partidas .fm",async()=>{
  const entry={handle:{queryPermission:async()=> "granted",getFile:async()=>({name:"otro.txt"})}};
  await assert.rejects(getRememberedFmFile(entry),/ya no es una partida/);
});
