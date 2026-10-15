import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/pages/ImportUnified.jsx",import.meta.url),"utf8");
const ui=source.slice(source.indexOf("  const runAgain=async()=>"));
test("La experiencia por defecto se reduce a subida automática, progreso y resultado",()=>{
 assert.match(ui,/Seleccionar archivo JSON/);
 assert.match(ui,/Importación completada/);
 assert.match(ui,/Detalles técnicos y auditoría/);
 assert.match(ui,/Incidencias/);
 assert.match(ui,/No cierres esta ventana/);
 assert.doesNotMatch(ui,/He revisado la vista previa y autorizo/);
 assert.doesNotMatch(ui,/Verificar duplicados y preparar importación/);
 assert.doesNotMatch(ui,/Guardar también snapshots/);
 assert.doesNotMatch(ui,/Resultado y revisión opcional/);
});
test("La importación automática no salta validación de IDs ni actualiza métricas previas",()=>{
 assert.match(source,/if\(existingLinks\.length>1\)throw Error/);
 assert.match(source,/if\(candidates\.length>1\)throw Error/);
 assert.match(source,/if\(otherLinks\.some/);
 assert.match(source,/if\(normalized\(player\.name\)!==normalized\(snapshotName\)\)/);
 assert.match(source,/assessHistoricalEnrichment\(old,x,x\.linkedId\)/);
 assert.match(source,/queue=sourcePlan\.filter\(r=>\["crear","enriquecer"\]\.includes\(r\.action\)\)/);
 assert.match(source,/analysis\.added\?"enriquecer":"existente"/);
 assert.match(source,/group\.forEach\(row=>reportItems\.push/);
});
test("Vincular jugador desbloquea la importación en el mismo paso",()=>{
 assert.match(source,/setIdentityNotice\("Jugador vinculado\. Continuando la importación…"/);
 assert.match(source,/await autoImport\(batch,fileName,fullSource\)/);
});
test("Los avisos están plegados sin exigir corroboración ni perder visibilidad",()=>{
 assert.match(ui,/<details className="rounded-xl border border-amber-200/);
 assert.match(ui,/importWarnings\.map/);
 assert.match(ui,/fileErrors\.map/);
 assert.match(ui,/failures\.map/);
 assert.match(ui,/Descargar informe/);
});
