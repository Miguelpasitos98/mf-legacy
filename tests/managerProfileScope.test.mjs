import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {PROFILE_BLANK,cleanProfile,profileScope,profileScopeLabel} from "../src/components/managers/managerModel.mjs";
import {inferManagerProfileContext,parseManagerTacticalResponse,previewManagerTacticalDraft} from "../src/components/managers/managerTacticalAI.mjs";

const legacyKloppNotes="ENTRENADOR: Jürgen Norbert Klopp, alemán.\n\nETAPA REPRESENTADA: Liverpool FC, temporadas 2018/2019 y 2019/2020. Se selecciona este periodo.\n\nDIFERENCIAS HISTÓRICAS: Dortmund 2010/2011 y Liverpool 2023/2024 son otras etapas.";
test("legacy Klopp's text identifies a multi-season Liverpool period without mixing history",()=>{
 const scope=inferManagerProfileContext({profile_notes:legacyKloppNotes});
 assert.deepEqual(scope,{scope:"period",reference_club:"Liverpool",season:"",period_start:"2018/2019",period_end:"2019/2020",suggested_name:"Liverpool 2018–2020",origin:"explicit_notes"});
});
test("new JSON scope metadata takes precedence over incidental dates in notes",()=>{
 const x=inferManagerProfileContext({profile_scope:"general",profile_notes:legacyKloppNotes});
 assert.equal(x.scope,"general");
 assert.equal(x.period_start,"");
 const y=inferManagerProfileContext({profile_scope:"season",season:"2023/2024",reference_club:"Liverpool",suggested_name:"Liverpool 2023/24",profile_notes:legacyKloppNotes});
 assert.equal(y.scope,"season");
 assert.equal(y.season,"2023/2024");
});
test("general vs single season vs period are independent from the main ADN flag",()=>{
 const general=cleanProfile({...PROFILE_BLANK,name:"Filosofía general",is_default:true,season:"2020/2021"},"mgr");
 assert.equal(general.profile_scope,"general");assert.equal(general.season,"");assert.equal(general.is_default,true);
 const season=cleanProfile({...PROFILE_BLANK,name:"Liverpool 2019/20",profile_scope:"season",season:"2019/2020",reference_club:"Liverpool",is_default:true},"mgr");
 assert.equal(season.season,"2019/2020"); assert.equal(season.period_start,"");assert.equal(season.is_default,true);
 const period=cleanProfile({...PROFILE_BLANK,name:"Liverpool 2018–2020",profile_scope:"period",period_start:"2018/2019",period_end:"2019/2020",reference_club:"Liverpool",is_default:false},"mgr");
 assert.equal(period.profile_scope,"period");assert.equal(period.season,"");assert.equal(period.is_default,false);
 assert.equal(profileScope({season:"2015/2016"}),"season");
 assert.match(profileScopeLabel(period),/2018\/2019/);
 assert.throws(()=>cleanProfile({...PROFILE_BLANK,name:"Wrong",profile_scope:"period",period_start:"2024/2025",period_end:"2023/2024"},"mgr"),/ordenad/);
 assert.throws(()=>cleanProfile({...PROFILE_BLANK,name:"Wrong",profile_scope:"period",period_start:"2018/2019",period_end:"2018/2019"},"mgr"),/única temporada/);
});
test("legacy AI JSON fills in historical context without touching stored profile until save",()=>{
 const example={
 identifiable:true,confidence:"high",formation:"4-3-3",possession:65,pressing:89,tempo:85,
 defensive_line:84,attacking_width:82,risk_taking:76,build_up:"mixed",transition:"counter_press",
 defensive_block:"high",player_role_priorities:{GK:"Portero líbero",CB:"Central rápido",FB:"Lateral profundo",DM:"Ancla",AM:"Entre líneas",WG:"Extremo vertical",ST:"Falso nueve"},
 profile_notes:legacyKloppNotes,source_urls:[]
 };
 const parsed=parseManagerTacticalResponse(example);
 const previous={...PROFILE_BLANK,name:"Modelo principal",is_default:true};
 const draft=previewManagerTacticalDraft(previous,parsed);
 assert.equal(previous.name,"Modelo principal");
 assert.equal(previous.period_start,"");
 assert.equal(draft.name,"Liverpool 2018–2020");
 assert.equal(draft.profile_scope,"period");
 assert.equal(draft.reference_club,"Liverpool");
 assert.equal(draft.period_start,"2018/2019");
 assert.equal(draft.period_end,"2019/2020");
 assert.equal(draft.season,"");
 assert.equal(draft.is_default,true);
 assert.equal(cleanProfile(draft,"mgr",parsed.roleText).profile_scope,"period");
 const specific=previewManagerTacticalDraft({...previous,name:"Liverpool (personalizado)"},parsed);
 assert.equal(specific.name,"Liverpool (personalizado)");
});
test("profile data schema includes type and date range with no migration of records",()=>{
 const schema=JSON.parse(fs.readFileSync("base44/entities/ManagerTacticalProfile.jsonc","utf8"));
 assert.deepEqual(schema.properties.profile_scope.enum,["general","period","season"]);
 for(const k of ["period_start","period_end","reference_club","season","is_default"])assert.ok(schema.properties[k]);
 const source=fs.readFileSync("src/pages/Managers.jsx","utf8");
 assert.match(source,/Identificación del modelo táctico/);
 assert.match(source,/profileScopeLabel\(profileDraft\)/);
 assert.match(source,/Temporada inicial del periodo/);
 assert.match(source,/Usar como ADN principal \(independiente del periodo\)/);
});
