import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {STATS_ROWS_KEY,STATS_DETAIL_KEY,STATS_ROWS_STALE_MS,STATS_CACHE_GC_MS,statsRowsKey,statsDetailKey,flattenStatsPages,patchStatsRowsPageData,patchStatsDetailData,patchStatsCaches} from "../src/utils/statsRowsCache.js";

const mk=(id,season="2020/2021")=>({id,season,minutes:1800,metrics:[{name:"xG",value:3}]});
const dataset={
  pages:[{rows:[mk("x"),mk("y")],nextCursor:"cursor-2"},
         {rows:[mk("z"),mk("x")],nextCursor:null}],
  pageParams:[null,"cursor-2"]
};
test("La cache se identifica por temporada y competición; no mezcla filtros",()=>{
  assert.deepEqual(statsRowsKey("Todas","Todas"),[...STATS_ROWS_KEY,"Todas","Todas"]);
  assert.notDeepEqual(statsRowsKey("Todas","Todas"),statsRowsKey("2020/2021","Todas"));
  assert.deepEqual(statsDetailKey("player","abc"),[...STATS_DETAIL_KEY,"player","abc"]);
  assert.notDeepEqual(statsDetailKey("fotmob","abc"),statsDetailKey("player","abc"));
  assert.ok(STATS_ROWS_STALE_MS>=15*60*1000);
  assert.ok(STATS_CACHE_GC_MS>STATS_ROWS_STALE_MS);
});
test("Páginas retenidas se muestran sin duplicar jugadores ni alterar el orden",()=>{
  assert.deepEqual(flattenStatsPages(dataset).map(x=>x.id),["x","y","z"]);
  assert.deepEqual(flattenStatsPages(null),[]);
});
test("Modificar una estadística afecta a todas las vistas cacheadas sin recargar",()=>{
  const updated=patchStatsRowsPageData(dataset,"x",{minutes:2200,metrics:[{name:"xG",value:9}]});
  assert.equal(updated.pages[0].rows[0].minutes,2200);
  assert.equal(updated.pages[1].rows[1].minutes,2200);
  assert.equal(dataset.pages[0].rows[0].minutes,1800);
  assert.equal(dataset.pages[0].rows[0].metrics[0].value,3);
  assert.equal(updated.pages[0].rows[1],dataset.pages[0].rows[1]);
});
test("Un registro que no existe no se inventa ni añade al ranking",()=>{
  assert.equal(patchStatsRowsPageData(dataset,"unknown",{minutes:999}),dataset);
  assert.equal(patchStatsRowsPageData(null,"x",{minutes:999}),null);
});
test("Fichas de jugador conservan modificaciones reales y el resto intacto",()=>{
  const old=[mk("x"),mk("y")],updated=patchStatsDetailData(old,"x",{minutes:2200});
  assert.equal(updated[0].minutes,2200);
  assert.equal(updated[1],old[1]);
  assert.equal(old[0].minutes,1800);
});
test("Una modificación comunica la actualización a cada filtro STATS y a los detalles en memoria",()=>{
  const store=new Map([["all",dataset],["season",{pages:[{rows:[mk("x")],nextCursor:null}],pageParams:[null]}],["detail",[mk("x")]]]);
  let reads=0;
  const client={
    setQueriesData({queryKey},fn){
      assert.ok([STATS_ROWS_KEY,STATS_DETAIL_KEY].includes(queryKey));
      for(const [name,value] of store){
        if(queryKey===STATS_ROWS_KEY&&name==="detail")continue;
        if(queryKey===STATS_DETAIL_KEY&&name!=="detail")continue;
        store.set(name,fn(value));
      }
    },
    fetchQuery(){reads++;throw Error("No debe haber descarga");}
  };
  patchStatsCaches(client,"x",{minutes:2400});
  assert.equal(flattenStatsPages(store.get("all"))[0].minutes,2400);
  assert.equal(flattenStatsPages(store.get("season"))[0].minutes,2400);
  assert.equal(store.get("detail")[0].minutes,2400);
  assert.equal(reads,0);
});
test("El STATS reutiliza React Query al volver y no invalida solo por cerrar importador",()=>{
  const page=readFileSync(new URL("../src/pages/Stats.jsx",import.meta.url),"utf8");
  const hook=readFileSync(new URL("../src/hooks/useStatsRows.js",import.meta.url),"utf8");
  const imported=readFileSync(new URL("../src/pages/ImportUnified.jsx",import.meta.url),"utf8");
  assert.match(page,/useStatsRows\(season,competition\)/);
  assert.doesNotMatch(page,/const useStatsRows=/);
  assert.match(page,/fetchQuery\(\{/);
  assert.match(page,/queryKey:statsDetailKey|const key=statsDetailKey/);
  assert.match(hook,/useInfiniteQuery\(\{/);
  assert.match(hook,/gcTime:STATS_CACHE_GC_MS/);
  assert.match(hook,/staleTime:STATS_ROWS_STALE_MS/);
  assert.match(hook,/flattenStatsPages\(query.data\)/);
  assert.match(page,/onClick=\{\(\)=>setUnifiedOpen\(false\)\}/);
  assert.match(page,/<ImportUnified onImported=\{importComplete\}/);
  assert.match(imported,/onImported\?\.\(\)/);
  const control=readFileSync(new URL("../src/components/stats/StatsControlBar.jsx",import.meta.url),"utf8");
  assert.match(control,/Actualizar datos/);
  assert.match(page,/onRefresh=/);
});
