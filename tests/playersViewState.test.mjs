import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  PLAYERS_VIEW_KEY,DEFAULT_PLAYERS_VIEW,readPlayersViewState,
  savePlayersViewState,sanitizePlayersViewState
} from "../src/utils/playersViewState.js";

const memoryStore=()=>{
  const entries=new Map();
  return {
    getItem:key=>entries.has(key)?entries.get(key):null,
    setItem:(key,value)=>entries.set(key,String(value))
  };
};

test("Players remembers Barcelona club, Top CP sorting, search, list mode and exact scroll",()=>{
  const storage=memoryStore();
  const state={view:"teams",teamFilterId:"barca-id",positionFilter:"defensa_central",
    sortBy:"cp",search:"Cubarsí",searchOpen:true,scrollTop:1447};
  assert.equal(savePlayersViewState(state,storage),true);
  assert.equal(storage.getItem(PLAYERS_VIEW_KEY).includes("barca-id"),true);
  assert.deepEqual(readPlayersViewState(storage),state);
});
test("Players never loses the intended name ordering or chosen position filter",()=>{
  const storage=memoryStore();
  savePlayersViewState({view:"all",sortBy:"name_desc",teamFilterId:"barca-id",positionFilter:"portero",scrollTop:851},storage);
  assert.equal(readPlayersViewState(storage).sortBy,"name_desc");
  assert.equal(readPlayersViewState(storage).positionFilter,"portero");
  assert.equal(readPlayersViewState(storage).scrollTop,851);
});
test("Corrupted browser cache or inaccessible localStorage cannot crash Players",()=>{
  const store=memoryStore();
  store.setItem(PLAYERS_VIEW_KEY,"{invalid JSON");
  assert.deepEqual(readPlayersViewState(store),DEFAULT_PLAYERS_VIEW);
  const blocked={getItem(){throw Error("blocked");},setItem(){throw Error("blocked");}};
  assert.deepEqual(readPlayersViewState(blocked),DEFAULT_PLAYERS_VIEW);
  assert.equal(savePlayersViewState(DEFAULT_PLAYERS_VIEW,blocked),false);
});
test("Invalid view, order and scroll are safely sanitized",()=>{
  assert.deepEqual(sanitizePlayersViewState({
    view:"nonexistent",sortBy:"__proto__",scrollTop:-800,teamFilterId:12,positionFilter:null,search:"b"
  }),{...DEFAULT_PLAYERS_VIEW,search:"b",searchOpen:true});
  assert.equal(sanitizePlayersViewState({scrollTop:Infinity}).scrollTop,0);
});
test("Players list actually integrates storage, in-page back and its scroll container",()=>{
  const source=readFileSync(new URL("../src/pages/Players.jsx",import.meta.url),"utf8");
  assert.match(source,/useMemo\(\(\) => readPlayersViewState\(\), \[\]\)/);
  assert.match(source,/onScroll=\{rememberListScroll\}/);
  assert.match(source,/data-mf-players-scroll ref=\{listScrollRef\}/);
  assert.match(source,/restoreScrollPending\.current = true;\s*setSelectedPlayer\(player\)/);
});
