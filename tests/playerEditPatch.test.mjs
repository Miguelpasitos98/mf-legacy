import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {changedPlayerFields,playerEditHasChanges,applyPlayerEditPatch,updatePlayerCacheRows} from "../src/utils/playerEditPatch.js";

const initial={
 name:"Lionel Messi",photoUrl:"https://old.example/image.png",
 cardPhotoUrl:"https://old.example/card.png",nationalCardPhotoUrl:"",teamId:"club",
 careerStatus:"active",lastTeamId:"",retirementYear:"",
 countryId:"arg",secondaryCountryId:"",dateOfBirth:"1987-06-24",
 ca:180,cp:190,positionRatings:{delantero:18},
 stats:{mental:{vision:19}},description:"A",shirtNumber:10,
 salary:20000000,formPosition:""
};
const full={
 name:"Lionel Messi",photo_url:"https://new.example/image.png",
 card_photo_url:"https://old.example/card.png",national_card_photo_url:"",
 ca:180,cp:190,position_ratings:{delantero:18},
 stats:{mental:{vision:19}},salary:20000000,shirt_number:10,
 team_id:"club",career_status:"active",last_team_id:"",
 date_of_birth:"1987-06-24",country_id:"arg",secondary_country_id:""
};
test("Una URL nueva guarda exclusivamente photo_url; no reescribe FM26, salario, estadísticas ni equipo",()=>{
 const patch=changedPlayerFields({...initial,photoUrl:"https://new.example/image.png"},initial,full);
 assert.deepEqual(patch,{photo_url:"https://new.example/image.png"});
 assert.equal(playerEditHasChanges(patch),true);
});
test("Una foto de carta solo escribe card_photo_url",()=>{
 const patch=changedPlayerFields({...initial,cardPhotoUrl:"https://new.example/card.png"},initial,{...full,card_photo_url:"https://new.example/card.png"});
 assert.deepEqual(patch,{card_photo_url:"https://new.example/card.png"});
});
test("Modificar foto y dorsal guarda exactamente esos dos cambios",()=>{
 const patch=changedPlayerFields({...initial,photoUrl:"https://new.example/image.png",shirtNumber:9},initial,{...full,shirt_number:9});
 assert.deepEqual(patch,{shirt_number:9,photo_url:"https://new.example/image.png"});
});
test("Un cambio en campos FM26 complejos conserva los demás sin tocarlos",()=>{
 const patch=changedPlayerFields({...initial,positionRatings:{delantero:17},stats:{mental:{vision:20}}},initial,
   {...full,position_ratings:{delantero:17},stats:{mental:{vision:20}}});
 assert.deepEqual(patch,{position_ratings:{delantero:17},stats:{mental:{vision:20}}});
 assert.equal("photo_url" in patch,false);
});
test("Guardar sin cambios no manda una petición",()=>{
 assert.deepEqual(changedPlayerFields(initial,structuredClone(initial),full),{});
 assert.equal(playerEditHasChanges({}),false);
});
test("La caché local y el detalle usan inmediatamente el nuevo enlace en snake/camel",()=>{
 const original={id:"messi",photo_url:"https://old.example/image.png",photoUrl:"https://old.example/image.png",ca:180};
 const changed=applyPlayerEditPatch(original,{photo_url:"https://new.example/image.png"});
 assert.equal(changed.photo_url,"https://new.example/image.png");
 assert.equal(changed.photoUrl,"https://new.example/image.png");
 assert.equal(changed.ca,180);
 assert.equal(original.photo_url,"https://old.example/image.png");
 const rows=[original,{id:"other",name:"Other"}];
 const after=updatePlayerCacheRows(rows,"messi",{photo_url:"https://new.example/image.png"});
 assert.equal(after[0].photoUrl,"https://new.example/image.png");
 assert.equal(after[1],rows[1]);
 assert.equal(updatePlayerCacheRows(rows,"absent",{photo_url:"a"}),rows);
});
test("Editor aplica patch únicamente tras actualizar el servidor y la lista no dispara refetch global",()=>{
 const detail=readFileSync(new URL("../src/pages/PlayerDetail.jsx",import.meta.url),"utf8");
 const players=readFileSync(new URL("../src/pages/Players.jsx",import.meta.url),"utf8");
 assert.match(detail,/const patch=changedPlayerFields\(form,initialForm,fullPayload\)/);
 assert.match(detail,/await base44\.entities\.Player\.update\(editablePlayer\.id,patch\)/);
 assert.match(detail,/onPlayerUpdated\(updatedPlayer,patch\)/);
 assert.doesNotMatch(detail,/Player\.update\(editablePlayer\.id,\s*\{/);
 assert.match(players,/queryClient\.setQueryData\(\["mf-legacy","players"\]/);
 const callback=players.slice(players.indexOf('onPlayerUpdated={(updatedPlayer, patch) => {'));
 assert.doesNotMatch(callback.slice(0,600),/invalidateQueries/);
});
