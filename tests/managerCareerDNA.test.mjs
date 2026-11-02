import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildManagerCareerPrompt,parseManagerCareerResponse,careerToProfilePayload,profileIdentity} from "../src/components/managers/managerCareerDNA.mjs";
import {cleanProfile,PROFILE_BLANK} from "../src/components/managers/managerModel.mjs";
const roles={GK:"Salida y cobertura",CB:"Central potente",FB:"Lateral profundo",DM:"Pivote",AM:"Interior",WG:"Extremo",ST:"Falso nueve"};
const base=(name,scope,club,start,end,stats={})=>({
 model_id:name.toLowerCase().replace(/\s/g,"_"),profile_scope:scope,reference_club:club,
 period_start:start,period_end:end,season:"",suggested_name:name,
 formation:"4-3-3",possession:60,pressing:80,tempo:75,defensive_line:70,attacking_width:80,risk_taking:68,
 build_up:"mixed",transition:"counter_press",defensive_block:"high",
 player_role_priorities:roles,profile_notes:"Presión alta y transiciones rápidas con juego colectivo variable.",
 source_urls:["https://www.premierleague.com"],...stats
});
const early=base("Dortmund 2010–2013","period","Borussia Dortmund","2010/2011","2012/2013",{
 success_tier:"very_successful",results_summary:"Ligas alemanas documentadas y una final continental, contextualizando rivales y recursos.",
 verified_honours:[{competition:"Bundesliga",season:"2010/2011",source_url:"https://www.bundesliga.com"}],
 main_changes:"Evolución a transiciones y contrapresión sistemática"
});
const later=base("Liverpool 2018–2020","period","Liverpool","2018/2019","2019/2020",{
 success_tier:"very_successful",results_summary:"Título continental y Premier League documentados con equilibrio defensivo.",
 verified_honours:[{competition:"Premier League",season:"2019/2020",source_url:"https://www.premierleague.com"}],
 main_changes:"Bloque defensivo más equilibrado y amplitud ofensiva de los laterales"
});
const general=base("Filosofía general","general","","","",{model_id:"general",profile_scope:"general",reference_club:"",source_urls:["https://www.premierleague.com"]});
const bundle={
 format:"mf_legacy_manager_career_dna_v1",identifiable:true,confidence:"high",models:[later,early],
 best_supported_model_id:later.model_id,
 comparative_reason:"Liverpool 2018–2020 destacó por los grandes títulos y el equilibrio; Dortmund tuvo un impacto táctico notable.",
 general_philosophy:general
};

test("prompt requires period-to-period history, qualitative evidence and separate synthesis",()=>{
 const prompt=buildManagerCareerPrompt({name:"Jürgen Klopp",manager_kind:"real"},"Liverpool y Dortmund");
 assert.match(prompt,/EVOLUCIÓN COMPLETA/);
 assert.match(prompt,/resultados/);
 assert.match(prompt,/best_supported_model_id/);
 assert.match(prompt,/general_philosophy/);
 assert.match(prompt,/no es automáticamente el mejor tácticamente/);
 assert.match(prompt,/Liverpool y Dortmund/);
 assert.throws(()=>buildManagerCareerPrompt({name:""}),/entrenador/);
});
test("career JSON classifies and orders different eras, identifies most successful and creates separate general DNA",()=>{
 const parsed=parseManagerCareerResponse(JSON.stringify(bundle));
 assert.equal(parsed.models.length,2);
 assert.equal(parsed.models[0].profile.reference_club,"Borussia Dortmund");
 assert.equal(parsed.models[1].profile.reference_club,"Liverpool");
 assert.equal(parsed.models[1].successTier,"very_successful");
 assert.equal(parsed.bestId,later.model_id);
 assert.equal(parsed.general.profile.profile_scope,"general");
 assert.equal(parsed.general.profile.period_start,"");
 assert.equal(parsed.general.profile.name,"Filosofía general");
 const saved=careerToProfilePayload(parsed.models[1],"mgr",{defaultProfile:false});
 assert.equal(saved.is_default,false);
 assert.equal(saved.period_start,"2018/2019");
 assert.equal(saved.period_end,"2019/2020");
 assert.equal(saved.success_tier,"very_successful");
 assert.match(saved.profile_notes,/EVALUACIÓN DE RESULTADOS/);
 const genSaved=careerToProfilePayload(parsed.general,"mgr",{defaultProfile:true});
 assert.equal(genSaved.is_default,true);
 assert.equal(genSaved.profile_scope,"general");
 assert.equal(genSaved.season,"");
});
test("profile identity prevents duplicate periods but preserves different seasons and clubs",()=>{
 const x=cleanProfile({...PROFILE_BLANK,name:"A",profile_scope:"period",reference_club:"Liverpool",period_start:"2018/2019",period_end:"2019/2020"},"mgr");
 const y={...x,name:"Different name"};
 assert.equal(profileIdentity(x),profileIdentity(y));
 const z={...x,reference_club:"Dortmund"};
 assert.notEqual(profileIdentity(x),profileIdentity(z));
});
test("reject bad identifiers, false honours, unsupported results and missing general synthesis",()=>{
 assert.throws(()=>parseManagerCareerResponse({...bundle,models:[{...early,model_id:"same"},{...later,model_id:"same"}]}),/repetido/);
 assert.throws(()=>parseManagerCareerResponse({...bundle,models:[{...early,verified_honours:[{competition:"Bundesliga",season:"2010/2011",source_url:"fake"}]}]}),/carece de temporada o URL/);
 assert.throws(()=>parseManagerCareerResponse({...bundle,models:[{...early,success_tier:"almost perfect"}]}),/clasificación cualitativa/);
 assert.throws(()=>parseManagerCareerResponse({...bundle,general_philosophy:null}),/filosofía general/);
 assert.throws(()=>parseManagerCareerResponse({...bundle,best_supported_model_id:"nonexistent"}),/no aparece/);
 assert.throws(()=>parseManagerCareerResponse({...bundle,models:[]}),/entre 1 y 6/);
 assert.throws(()=>parseManagerCareerResponse({format:"mf_legacy_manager_career_dna_v1",identifiable:false,reason:"No puedo identificarlo"}),/identificarlo/);
});
test("UI offers optional import after review and does not overwrite existing profiles",()=>{
 const source=fs.readFileSync("src/pages/Managers.jsx","utf8");
 assert.match(source,/Investigar trayectoria completa/);
 assert.match(source,/Guardar modelos seleccionados/);
 assert.match(source,/Filosofía general del entrenador/);
 assert.match(source,/profileIdentity\(item.profile\)/);
 assert.match(source,/ManagerTacticalProfile\.create\(payload\)/);
 assert.match(source,/Promise\.allSettled\(created\.map/);
 assert.match(source,/profileScopeLabel\(item.profile\)/);
 assert.match(source,/profileIdentity\(profile\)/);
});
