import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trophyViewGroups,trophyScope,reputationTier,groupTrophyHonoursForClub,TROPHY_CATALOG_VIEW_MODES} from '../src/utils/trophyViews.js';

const countries=[{id:'es',name:'España',code:'ESP'},{id:'en',name:'Inglaterra',code:'ENG'}];
const items=[
 {source_id:'1301394',name:'UEFA Champions League',category:'International',country_resolution:'international',reputation:195},
 {source_id:'67',name:'LaLiga EA Sports',category:'League',country_id:'es',country_resolution:'verified',reputation:183},
 {source_id:'pr',name:'Premier League',category:'League',country_id:'en',country_resolution:'verified',reputation:190},
 {source_id:'cu',name:'Copa del Rey',category:'Cup',country_id:'es',country_resolution:'verified',reputation:169},
 {source_id:'carr',name:'Trofeo Ramón de Carranza',category:'Other',country_id:'es',region:'Cádiz',reputation:100},
 {source_id:'reg',name:'Copa provincial de Asturias',category:'Cup',country_id:'es',region:'Asturias',reputation:58},
 {source_id:'unknown',name:'Unknown historic award',reputation:38}
];
test('Six view modes are available and do not change trophy source_id',()=>{
 assert.deepEqual(TROPHY_CATALOG_VIEW_MODES,['gallery','reputation','scope','leagues','countries','clubs']);
 for(const mode of TROPHY_CATALOG_VIEW_MODES.filter(x=>x!=='clubs')){
  const groups=trophyViewGroups(items,mode,[],countries);
  const ids=groups.flatMap(g=>g.items.map(x=>x.source_id));
  assert.equal(new Set(ids).size,ids.length,'duplicates in '+mode);
  assert.ok(ids.every(id=>items.some(x=>x.source_id===id)));
 }
});
test('Reputation is split into editorial descending bands including low tiers',()=>{
 const groups=trophyViewGroups(items,'reputation',[],countries);
 assert.equal(groups[0].key,'rep180');
 assert.deepEqual(groups[0].items.map(x=>x.source_id),['1301394','pr','67']);
 assert.equal(reputationTier(items.at(-1)).key,'rep0');
});
test('The scope recognizes global, national, regional, friendly, and unclassified without conflating categories',()=>{
 assert.equal(trophyScope({source_id:'1301385',name:'FIFA World Cup'},[],countries).key,'world');
 assert.equal(trophyScope(items[0],[],countries).key,'continental');
 assert.equal(trophyScope(items[1],[],countries).key,'national');
 assert.equal(trophyScope(items[4],[],countries).key,'friendly');
 assert.equal(trophyScope(items[5],[],countries).key,'regional');
 assert.equal(trophyScope(items[6],[],countries).key,'unknown');
});
test('Leagues mode includes only explicitly classified league trophies',()=>{
 const groups=trophyViewGroups(items,'leagues',[],countries);
 const ids=groups.flatMap(x=>x.items.map(t=>t.source_id));
 assert.deepEqual(new Set(ids),new Set(['67','pr']));
 assert.equal(groups[0].title,'Inglaterra');
 assert.equal(groups[1].title,'España');
});
test('Countries group includes linked countries and a separate international region',()=>{
 const groups=trophyViewGroups(items,'countries',[],countries);
 assert.ok(groups.some(g=>g.title==='España'&&g.items.some(x=>x.source_id==='cu')));
 assert.ok(groups.some(g=>g.title==='Internacionales / multinacionales'&&g.items.some(x=>x.source_id==='1301394')));
 assert.ok(groups.some(g=>g.title==='País no confirmado'));
});
test('Team winners are deduplicated by trophy; verified honours and provisional Rob remain independent',()=>{
 const honours=[
  {trophy_source_id:'67',recipient_type:'Team',recipient_id:'team1',verified:true,season:'2022/23'},
  {trophy_source_id:'67',recipient_type:'Team',recipient_id:'team1',verified:true,season:'2023/24'},
  {trophy_source_id:'cup',recipient_type:'Team',recipient_id:'team1',verified:false,season:'2023/24'},
  {trophy_source_id:'67',recipient_type:'Team',recipient_id:'team2',verified:true,season:'2023/24'}
 ];
 const editions=[
  {trophy_source_id:'1301394',champion_team_id:'team1',season:'2023/24',verification_status:'source_extracted'},
  {trophy_source_id:'1301394',champion_team_id:'team1',season:'2022/23',verification_status:'source_extracted'},
  {trophy_source_id:'1301394',champion_team_id:'team2',season:'2021/22',verification_status:'source_extracted'}
 ];
 const result=groupTrophyHonoursForClub(honours,editions,'team1');
 assert.equal(result.verified.length,2);
 assert.equal(result.historical.length,2);
 assert.deepEqual(result.verifiedTrophies,['67']);
 assert.deepEqual(result.historicalTrophies,['1301394']);
});
test('Catalog view selection and search integrated in Trophies without duplicate teams widgets',()=>{
 const page=readFileSync(new URL('../src/pages/Trophies.jsx',import.meta.url),'utf8');
 const club=readFileSync(new URL('../src/components/trophies/TrophyClubCatalogView.jsx',import.meta.url),'utf8');
 const sidebar=readFileSync(new URL("../src/components/Sidebar.jsx",import.meta.url),"utf8");
 assert.match(sidebar,/aria-label="Vistas de trofeos"/);
 assert.match(sidebar,/TROPHY_SIDEBAR_VIEWS/);
 assert.match(sidebar,/handleTrophyViewChange/);
 assert.match(page,/useSearchParams/);
 assert.doesNotMatch(page,/aria-label="Vistas de la biblioteca de trofeos"/);
 assert.match(page,/TrophyClubCatalogView/);
 assert.match(page,/visibleModeGroups/);
 assert.match(page,/setTab\("all"\)/);
 assert.match(club,/TrophyEdition\.filter\(\{champion_team_id:teamId\}/);
 assert.match(club,/verified===true/);
 assert.doesNotMatch(club,/TrophyHonour\.(create|update|delete)/);
});
