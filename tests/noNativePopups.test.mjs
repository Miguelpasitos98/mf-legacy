import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync,readFileSync} from "node:fs";
import {join,resolve} from "node:path";

const srcRoot=resolve("src");
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>
 entry.isDirectory()?files(join(dir,entry.name)):/\.(?:jsx?|tsx?)$/.test(entry.name)?[join(dir,entry.name)]:[]);
const read=path=>readFileSync(join(srcRoot,path),"utf8");

test("MF LEGACY no utiliza alert/confirm/prompt nativos en ningún flujo",()=>{
 const found=[];
 for(const path of files(srcRoot)){
  const source=readFileSync(path,"utf8");
  const pattern=/(?:window\s*\.\s*|globalThis\s*\.\s*|\b)(?:alert|confirm|prompt)\s*\(/g;
  const matching=[...source.matchAll(pattern)];
  if(matching.length)found.push({path,occurrences:matching.length});
 }
 assert.deepEqual(found,[]);
});
test("La importación JSON de jugador ya no solicita confirmación duplicada y conserva vista previa",()=>{
 const jsx=read("components/stats/HistoricalJsonImporter.jsx");
 assert.match(jsx,/const selected = rows\.filter/);
 assert.match(jsx,/if \(!selected\.length \|\| busy \|\| saving\) return/);
 assert.match(jsx,/const liveRows = decorateRows/);
 assert.match(jsx,/setNotice\("Resultado confirmado:/);
 assert.doesNotMatch(jsx,/window\.confirm/);
});
test("Las valoraciones eliminadas aún requieren una confirmación dentro del modal",()=>{
 const jsx=read("components/stats/HistoricalValuationsTable.jsx");
 assert.match(jsx,/const \[confirmDelete, setConfirmDelete\] = useState\(false\)/);
 assert.match(jsx,/if \(!confirmDelete\) return/);
 assert.match(jsx,/Sí, eliminar definitivamente/);
 assert.match(jsx,/Cancelar eliminación/);
});
test("Los errores al guardar un club se muestran dentro del editor",()=>{
 const page=read("pages/Teams.jsx");
 const modal=read("components/teams/TeamFormComponents.jsx");
 assert.match(page,/setTeamFormError/);
 assert.match(page,/Error al guardar el equipo/);
 assert.match(modal,/formError&&<div role="alert"/);
});
