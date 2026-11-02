import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {directPlayerImageUrl} from "../src/components/players/playerPhotoSource.mjs";
test("GitHub player card images load directly from the raw image host",()=>{
 assert.equal(directPlayerImageUrl("https://github.com/Miguelpasitos98/My-Legacy/blob/main/Faces%20UT/Lionel%20Messi.png?raw=true"),
 "https://raw.githubusercontent.com/Miguelpasitos98/My-Legacy/main/Faces%20UT/Lionel%20Messi.png");
 assert.equal(directPlayerImageUrl("https://github.com/Miguelpasitos98/My-Legacy/blob/main/Faces%20UT/Kylian%20Mbapp%C3%A9.png?raw=true"),
 "https://raw.githubusercontent.com/Miguelpasitos98/My-Legacy/main/Faces%20UT/Kylian%20Mbapp%C3%A9.png");
});
test("other hosts, already raw images, data, and empty strings stay intact",()=>{
 for(const src of ["https://raw.githubusercontent.com/owner/repo/main/a.png","https://images.example.com/image.png",
  "data:image/png;base64,1234","blob:https://example.org/123",""]){
  assert.equal(directPlayerImageUrl(src),src);
 }
});
test("does not rewrite GitHub profile pages without a file path",()=>{
 for(const src of ["https://github.com/owner/repo","https://github.com/owner/repo/tree/main/photos",
 "https://github.com/owner/repo/blob/main"]){
  assert.equal(directPlayerImageUrl(src),src);
 }
});
test("SmartImage avoids HEAD probe storms and still offers fallback and retries",()=>{
 const component=fs.readFileSync("src/components/players/SmartImage.jsx","utf8");
 assert.match(component,/directPlayerImageUrl\(src\)/);
 assert.match(component,/src=\{directSrc\}/);
 assert.match(component,/BACKOFF_MS/);
 assert.match(component,/onError=\{handleError\}/);
 assert.doesNotMatch(component,/method: "HEAD"/);
 assert.doesNotMatch(component,/probeUrl/);
 assert.match(component,/return fallback/);
});
