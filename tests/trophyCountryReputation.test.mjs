import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateTrophyReputation,inferTrophyCountry,recommendedTrophyCategory} from '../src/utils/trophyResearch.js';
import {groupTrophies} from '../src/utils/trophyGrouping.js';
import {filterCountryOptions} from '../src/utils/trophyCatalogFilters.js';
const countries=[
 {id:'es',name:'España',code:'ESP'},
 {id:'gb',name:'Inglaterra',code:'ENG'},
 {id:'se',name:'Suecia',code:'SWE'},
 {id:'ca',name:'Canadá',code:'CAN'},
 {id:'ru',name:'Rusia',code:'RUS'},
];
test('El vínculo del país utiliza Country.id real, no códigos ni supuestos sobre el campeón',()=>{
 assert.deepEqual(inferTrophyCountry({name:'Corinthian Bowl (1906-1913)',source_id:'2000335360'},countries).country_id,'se');
 assert.deepEqual(inferTrophyCountry({name:'League1 Ontario Cup'},countries).country_id,'ca');
 assert.deepEqual(inferTrophyCountry({name:'Trofeo Ramón de Carranza',source_id:'2000335178'},countries).country_id,'es');
 assert.deepEqual(inferTrophyCountry({name:'Soviet Komsomol Cup'},countries).country_id,'');
 assert.equal(inferTrophyCountry({name:'Superliga Africana',source_id:'2000289984'},countries).resolution,'international');
});
test('Categorías históricas: no tratar todas las Gold Cup como CONCACAF ni superligas continentales como ligas nacionales',()=>{
 assert.equal(recommendedTrophyCategory({name:'Nepali Budha Subba Gold Cup'}),'Cup');
 assert.equal(recommendedTrophyCategory({name:'Superliga Africana',source_id:'2000289984'}),'International');
 assert.equal(recommendedTrophyCategory({name:'Central American Cup'}),'International');
 assert.equal(recommendedTrophyCategory({name:'LaLiga',source_id:'67'}),'League');
 assert.equal(recommendedTrophyCategory({name:'Copa Campeonato'}),'League');
});
test('Los valores editoriales se mantienen entre 0-200 y se distinguen las estimaciones de la edición manual',()=>{
 const estimated=estimateTrophyReputation({source_id:'1301385',name:'FIFA World Cup'});
 assert.equal(estimated.score,200);
 assert.equal(estimated.estimated,true);
 assert.deepEqual(estimateTrophyReputation({reputation:126,reputation_method:'manual_editorial'}).estimated,false);
 assert.deepEqual(estimateTrophyReputation({reputation:100,reputation_method:'mf_legacy_reputation_editorial_v1_2026_11'}).estimated,true);
});
test('Los grupos respetan el país vinculado y permiten ordenar por reputación',()=>{
 const items=[
 {source_id:'1',name:'Torneo provincial',country_id:'es',reputation:45},
 {source_id:'2',name:'Liga superior',country_id:'es',reputation:140},
 {source_id:'3',name:'Trofeo local',country_id:'ca',reputation:72}
 ];
 const groups=groupTrophies(items,[],countries,'reputation_desc');
 assert.equal(groups[0].title,'España');
 assert.equal(groups[0].items[0].source_id,'2');
});
test('El buscador de países permite buscar por nombre acentuado o código',()=>{
 const opts=[{label:'España',code:'ESP'},{label:'Canadá',code:'CAN'}];
 assert.equal(filterCountryOptions(opts,'esp')[0].label,'España');
 assert.equal(filterCountryOptions(opts,'canada')[0].label,'Canadá');
});
