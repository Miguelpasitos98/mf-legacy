import test from "node:test";
import assert from "node:assert/strict";
import {QueryClient,QueryObserver} from "@tanstack/react-query";
import {readCompleteRecords,completeStatsQueryOptions,createReadScheduler,retryDelay} from "../src/utils/entityRecords.js";
import {selectStatsRows,flattenStatsPages,patchStatsRowsPageData} from "../src/utils/statsRowsCache.js";
import {readStatsViewState,writeStatsViewState,STATS_VIEW_STATE_KEY} from "../src/utils/statsViewState.js";
import {metricName} from "../src/utils/compositeEngine.js";
import {metricsValue} from "../src/utils/statsViews.js";
const page=(items,next=null)=>({items,next_cursor:next,has_more:Boolean(next)});
const row=(id,season="2023/2024",competition="League")=>({id,season,competition,minutes:900});
const immediate={run:fn=>fn(),pause:()=>{}};

test("complete cursor walk retains all 1217 rows and sends only cursor parameters after page one",async()=>{
 const records=Array.from({length:1217},(_,i)=>row(String(i))),calls=[];
 const entity={list:async options=>{calls.push(options);const offset=options.cursor?Number(options.cursor):0;return page(records.slice(offset,offset+500),offset+500<records.length?String(offset+500):null);}};
 assert.deepEqual(await readCompleteRecords(entity),records);
 assert.deepEqual(calls,[{sort:"-created_date",limit:500},{cursor:"500",limit:500},{cursor:"1000",limit:500}]);
});
test("duplicate IDs, repeated/missing cursors and empty nonterminal pages reject partial snapshots",async()=>{
 for(const pages of [[page([row("x")],"next"),page([row("x")])],
  [page([row("x")],"next"),page([row("y")],"next")],
  [{items:[row("x")],has_more:true}], [page([],"next")], [{}]]){
  const copy=pages.slice();await assert.rejects(readCompleteRecords({list:async()=>copy.shift()},{gate:immediate}));
 }
 await assert.rejects(readCompleteRecords({list:async()=>[row("x")]},{pageSize:1,gate:immediate}),/última página/);
});
test("only a failed page is retried; earlier pages are retained and Retry-After is respected",async()=>{
 const calls=[],pauses=[];let attempts=0;
 const entity={list:async options=>{calls.push(options.cursor||"first");if(!options.cursor)return page([row("a")],"two");if(attempts++===0)throw Object.assign(Error("Rate limit; retry after 12 seconds"),{status:429});return page([row("b")]);}};
 assert.deepEqual((await readCompleteRecords(entity,{gate:{run:fn=>fn(),pause:ms=>pauses.push(ms)},wait:async()=>{}})).map(r=>r.id),["a","b"]);
 assert.deepEqual(calls,["first","two","two"]);assert.deepEqual(pauses,[12000]);
 assert.equal(retryDelay({status:403,message:"Forbidden"}),null);
});
test("cancellation after an in-flight page prevents publication and additional page reads",async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(readCompleteRecords({list:async()=>{calls++;controller.abort();return page([row("a")],"next");}},{signal:controller.signal,gate:immediate}),{name:"AbortError"});
 assert.equal(calls,1);
});
test("shared scheduler admits at most two simultaneous requests",async()=>{
 let active=0,max=0;const release=[];const gate=createReadScheduler();
 const work=Array.from({length:5},()=>gate.run(()=>new Promise(resolve=>{active++;max=Math.max(max,active);release.push(()=>{active--;resolve();});})));
 for(let i=0;i<5;i++){while(!release.length)await Promise.resolve();release.shift()();await Promise.resolve();}
 await Promise.all(work);assert.equal(max,2);
});
test("STATS and Composite readers share one in-flight query and filter cached data without reads",async()=>{
 const client=new QueryClient();let reads=0;
 const options=completeStatsQueryOptions({list:async()=>{reads++;return page([row("a"),row("b","2022/2023","Cup")]);}},["shared"]);
 const [stats,peers]=await Promise.all([client.fetchQuery(options),client.fetchQuery(options)]);
 assert.strictEqual(stats,peers);assert.equal(reads,1);
 const complete=flattenStatsPages(stats);
 for(let i=0;i<10;i++)assert.equal(selectStatsRows(complete,i%2?"2022/2023":"2023/2024","Todas").length,1);
 assert.strictEqual(selectStatsRows(complete,"Todas","Todas"),complete);assert.equal(reads,1);client.clear();
});
test("background refresh and failed later page retain the previous complete snapshot",async()=>{
 const client=new QueryClient();let release,refresh=false;
 const entity={list:async options=>{if(!refresh)return page([row("old")]);if(options.cursor)throw Error("offline");return new Promise(resolve=>{release=()=>resolve(page([row("new")],"next"));});}};
 const options=completeStatsQueryOptions(entity,["retain"]);const original=await client.fetchQuery(options);
 const observer=new QueryObserver(client,options),stop=observer.subscribe(()=>{});refresh=true;
 const pending=observer.refetch({throwOnError:true});await Promise.resolve();await Promise.resolve();
 assert.strictEqual(observer.getCurrentResult().data,original);release();await assert.rejects(pending,/offline/);
 assert.strictEqual(observer.getCurrentResult().data,original);assert.equal(observer.getCurrentResult().isError,true);
 stop();client.clear();
});
test("a local row edit cancels a stale refresh, keeps other row references and performs no extra reads",async()=>{
 const client=new QueryClient();let release,refresh=false,calls=0;
 const options=completeStatsQueryOptions({list:async()=>{calls++;return refresh?new Promise(resolve=>{release=resolve;}):page([row("a"),row("b")]);}},["edit"]);
 const original=await client.fetchQuery(options);refresh=true;
 const pending=client.fetchQuery({...options,staleTime:0}).catch(()=>{});await Promise.resolve();await Promise.resolve();
 await client.cancelQueries({queryKey:options.queryKey,exact:true});
 client.setQueryData(options.queryKey,old=>patchStatsRowsPageData(old,"a",{minutes:1200}));
 release(page([row("a"),row("b")]));await pending;
 const saved=client.getQueryData(options.queryKey);assert.equal(saved.pages[0].rows[0].minutes,1200);assert.strictEqual(saved.pages[0].rows[1],original.pages[0].rows[1]);assert.equal(calls,2);client.clear();
});
test("view settings and scroll survive remount; unavailable or corrupt storage is harmless",()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 writeStatsViewState({season:"2023/2024",competition:"Cup",search:"309328",scrollTop:420,scrollLeft:210,page:2},storage);
 assert.equal(readStatsViewState(storage).scrollLeft,210);assert.equal(readStatsViewState(storage).search,"309328");
 data.set(STATS_VIEW_STATE_KEY,"bad json");assert.deepEqual(readStatsViewState(storage),{});
 assert.doesNotThrow(()=>writeStatsViewState({}, {setItem:()=>{throw Error("blocked");}}));
});
test("normalization caching distinguishes percentages and never caches numeric values",()=>{
 const record={metrics:[{name:"Duels won",value:12},{name:"Duels won %",value:60}]};
 assert.notEqual(metricName("Duels won"),metricName("Duels won %"));
 assert.equal(metricsValue(record,"duelswon"),12);
 record.metrics[0].value=15;
 assert.equal(metricsValue(record,"duelswon"),15);
 for(let i=0;i<4200;i++)metricName("custom "+i);
 assert.equal(metricName("Dúels won %"),"duelswonpercent");
});
