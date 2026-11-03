import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {trophyImageUrl} from "../src/utils/trophyCatalog.js";
import {trophyImageShouldHide,prepareTrophyImageUpdate,isImageUrl,trophyImageSummary,overrideFor} from "../src/utils/trophyImages.js";

const manifest={byId:{"13109924":"https://legacy.example/premier-wrong.png"}};
const premier={source_id:"13109924",name:"Premier League",image_status:"auto"};
test("Image override takes priority over catalog legacy URL and source URL",()=>{
 const target={...premier,image_override_url:"https://cdn.example/premier-correct.png",image_url:"https://legacy.example/old.png",source_path:"Trofeos identificados/Premier League.png",image_status:"verified"};
 assert.equal(trophyImageUrl(target,manifest),"https://cdn.example/premier-correct.png");
 assert.equal(trophyImageSummary(target).source,"manual");
});
test("Restoring automatic selection keeps original image and legacy fallback",()=>{
 assert.equal(trophyImageUrl(premier,manifest),"https://legacy.example/premier-wrong.png");
 assert.equal(trophyImageUrl({...premier,image_override_url:"",image_status:"auto"},manifest),"https://legacy.example/premier-wrong.png");
});
test("Wrong or missing artwork has no active image, but retains unmodified catalog source",()=>{
 assert.equal(trophyImageUrl({...premier,image_status:"wrong"},manifest),"");
 assert.equal(trophyImageShouldHide({...premier,image_status:"wrong"}),true);
 assert.equal(trophyImageUrl({...premier,image_status:"missing"},manifest),"");
 assert.equal(trophyImageUrl({...premier,image_status:"auto"},manifest),"https://legacy.example/premier-wrong.png");
});
test("Safe image metadata accepts valid URL, notes and exact override values",()=>{
 const draft={image_override_url:"https://cdn.example/trophy.png",image_status:"verified",image_source_type:"manual_upload",image_source_reference:"federation photo",image_notes:"corresponds to 2024 version"};
 const payload=prepareTrophyImageUpdate(draft,{timestamp:"2026-11-03T12:00:00Z"});
 assert.deepEqual(payload,{...draft,image_last_reviewed_at:"2026-11-03T12:00:00Z"});
 assert.equal(overrideFor(draft),"https://cdn.example/trophy.png");
});
test("Invalid URLs and impossible review statuses cannot be saved",()=>{
 assert.equal(isImageUrl("javascript:alert(1)"),false);
 assert.equal(isImageUrl("data:image/svg+xml,..."),false);
 assert.equal(isImageUrl("//evil.example/file.png"),false);
 assert.equal(isImageUrl("https://valid.example/trophy.png"),true);
 assert.throws(()=>prepareTrophyImageUpdate({image_override_url:"javascript:alert(1)",image_status:"provisional"}),/URL/);
 assert.throws(()=>prepareTrophyImageUpdate({image_status:"verified",image_override_url:""}),/verificar/);
 assert.throws(()=>prepareTrophyImageUpdate({image_status:"wrong",image_override_url:"https://cdn.example/trophy.png"}),/incorrecta/);
});
test("Trophy editor exposes one-click image saving even without an existing Trophy entity",()=>{
 const page=readFileSync(new URL("../src/pages/Trophies.jsx",import.meta.url),"utf8");
 const manager=readFileSync(new URL("../src/components/trophies/TrophyImageManager.jsx",import.meta.url),"utf8");
 const queue=readFileSync(new URL("../src/components/trophies/TrophyImageReviewQueue.jsx",import.meta.url),"utf8");
 assert.match(page,/TrophyImageManager/);
 assert.match(page,/base44\.entities\.Trophy\.create\(\{\.\.\.others,\.\.\.imageData\}\)/);
 assert.match(page,/TrophyImageReviewQueue/);
 assert.match(manager,/UploadFile\(\{file\}\)/);
 assert.match(manager,/Guardar imagen/);
 assert.match(manager,/Restaurar automática/);
 assert.match(manager,/Marcar automática incorrecta/);
 assert.match(queue,/Revisión de imágenes/);
});
